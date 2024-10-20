import { StoreApi, UseBoundStore, create } from 'zustand'
import { Hex } from 'viem'
import {
  encodeKey,
  getKeySchema,
  getSchemaTypes,
} from '@latticexyz/protocol-parser/internal'
import { Table, Tables } from '@latticexyz/config'
import { getId, RawRecord } from '@latticexyz/store-sync/zustand'
import { StoreEventsLog, SyncStep } from '@latticexyz/store-sync'
import { TableRecord } from '@latticexyz/store-sync/zustand'
import { applyLogsToSingleRecord } from './applyLogsToSingleRecord'

type TableRecords<table extends Table> = {
  readonly [id: string]: TableRecord<table>
}

// Ideally txHash should be the marker, but that is hard to pre-calc without an RPC call
type StoreEventWithMarker = {
  marker: string
  log: StoreEventsLog
}

// TODO: split this into distinct stores and combine (https://docs.pmnd.rs/zustand/guides/typescript#slices-pattern)?

export type ZustandStateOptimistic<tables extends Tables> = {
  // optimistic state
  readonly pendingLogs: Map<string, StoreEventWithMarker[]>
  // cannonical state
  readonly syncProgress: {
    readonly step: SyncStep
    readonly message: string
    readonly percentage: number
    readonly latestBlockNumber: bigint
    readonly lastBlockNumberProcessed: bigint
  }
  /** Tables derived from table registration store events */
  readonly tables: {
    readonly [tableId: Hex]: Table
  }
  /** Raw records (bytes) derived from store events */
  readonly rawRecords: {
    readonly [id: string]: RawRecord
  }
  /** Decoded table records derived from raw records */
  readonly records: {
    readonly [id: string]: TableRecord<tables[keyof tables]>
  }
  readonly getRecords: <table extends Table>(
    table: table,
  ) => TableRecords<table>
  readonly getRecord: <table extends Table>(
    table: table,
    key: TableRecord<table>['key'],
  ) => TableRecord<table> | undefined
  readonly getValue: <table extends Table>(
    table: table,
    key: TableRecord<table>['key'],
  ) => TableRecord<table>['value'] | undefined
  readonly getValueOptimistic: <table extends Table>(
    table: table,
    key: TableRecord<table>['key'],
  ) => TableRecord<table>['value'] | undefined
  readonly getRecordsOptimistic: <table extends Table>(
    table: table,
  ) => TableRecords<table>
  readonly getRecordOptimistic: <table extends Table>(
    table: table,
    key: TableRecord<table>['key'],
  ) => TableRecord<table> | undefined
  readonly addPendingLogs: (marker: string, logs: StoreEventsLog[]) => void
  readonly removePendingLogsForMarker: (marker: string) => void
}

export type ZustandStoreOptimistic<tables extends Tables> = UseBoundStore<
  StoreApi<ZustandStateOptimistic<tables>>
>

export type CreateStoreOptimisticOptions<tables extends Tables> = {
  tables: tables
}

export function createStoreOptimistic<tables extends Tables>(
  opts: CreateStoreOptimisticOptions<tables>,
): ZustandStoreOptimistic<tables> {
  return create<ZustandStateOptimistic<tables>>((set, get) => ({
    pendingLogs: new Map(),
    syncProgress: {
      step: SyncStep.INITIALIZE,
      message: 'Connecting',
      percentage: 0,
      latestBlockNumber: 0n,
      lastBlockNumberProcessed: 0n,
    },
    tables: Object.fromEntries(
      Object.entries(opts.tables).map(([, table]) => [table.tableId, table]),
    ),
    rawRecords: {},
    records: {},
    getRecords: <table extends Table>(table: table): TableRecords<table> => {
      console.log('might blow up because we are ts expect erroring')
      const records = get().records
      return Object.fromEntries(
        Object.entries(records).filter(
          ([id, record]) => record.table.tableId === table.tableId,
        ),
      ) as unknown as TableRecords<table>
    },
    getRecordsOptimistic: <table extends Table>(
      table: table,
    ): TableRecords<table> => {
      const rawRecords = get().rawRecords
      const pendingLogs = get().pendingLogs

      const updatedRecordsEntries = Array.from(pendingLogs.entries()).map(
        ([id, logs]) => {
          const existingRecord = rawRecords[id]
          const updatedRecord = applyLogsToSingleRecord<table>({
            existingRawRecord: existingRecord,
            table,
            logs: logs.map((x) => x.log),
          })

          return [id, updatedRecord]
        },
      )

      const updatedRecords = Object.fromEntries(updatedRecordsEntries)

      const records = get().records
      const existing = Object.fromEntries(
        Object.entries(records).filter(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ([id, record]) => record.table.tableId === table.tableId,
        ),
      ) as unknown as TableRecords<table>

      const result = { ...existing, ...updatedRecords }

      // Remove entries where updatedRecords has null values
      Object.keys(updatedRecords).forEach((key) => {
        if (updatedRecords[key] === null) {
          delete result[key]
        }
      })

      return result
    },
    getRecord: <table extends Table>(
      table: table,
      key: TableRecord<table>['key'],
    ): TableRecord<table> | undefined => {
      const keyTuple = encodeKey(
        getSchemaTypes(getKeySchema(table)) as never,
        key as never,
      )
      const id = getId({ tableId: table.tableId, keyTuple })
      return get().records[id] as unknown as TableRecord<table> | undefined
    },
    getRecordOptimistic: <table extends Table>(
      table: table,
      key: TableRecord<table>['key'],
    ): TableRecord<table> | undefined => {
      const keyTuple = encodeKey(
        getSchemaTypes(getKeySchema(table)) as never,
        key as never,
      )
      const id = getId({ tableId: table.tableId, keyTuple })
      const logs = get().pendingLogs.get(id)
      const existingRawRecord = get().rawRecords[id]
      const tableRecord =
        logs &&
        applyLogsToSingleRecord<table>({
          existingRawRecord,
          table,
          logs: logs.map((x) => x.log),
        })
      return (
        tableRecord ??
        (get().records[id] as unknown as TableRecord<table> | undefined)
      )
    },
    getValue: <table extends Table>(
      table: table,
      key: TableRecord<table>['key'],
    ): TableRecord<table>['value'] | undefined => {
      return get().getRecord(table, key)?.value
    },

    getValueOptimistic: <table extends Table>(
      table: table,
      key: TableRecord<table>['key'],
    ): TableRecord<table>['value'] | undefined => {
      return get().getRecordOptimistic(table, key)?.value
    },

    addPendingLogs: (marker: string, logs: StoreEventsLog[]) => {
      const pendingLogs = get().pendingLogs
      logs.forEach((log) => {
        const id = getId(log.args)
        if (pendingLogs.has(id)) {
          pendingLogs.get(id)!.push({ marker, log })
        } else {
          pendingLogs.set(id, [{ marker, log }])
        }
      })
      set({ pendingLogs })
    },

    removePendingLogsForMarker: (markerToRemove: string) => {
      const pendingLogs = get().pendingLogs
      const updatedLogs = new Map(
        Array.from(pendingLogs.entries())
          .map(([key, logsWithMarker]) => {
            return [
              key,
              logsWithMarker.filter(({ marker }) => marker !== markerToRemove),
            ] as [string, StoreEventWithMarker[]]
          })
          .filter(([, logs]) => logs.length > 0),
      )
      set({ pendingLogs: updatedLogs })
    },
  }))
}
