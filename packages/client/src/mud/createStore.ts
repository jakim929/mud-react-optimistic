import { StoreApi, UseBoundStore, create } from "zustand";
import { Hex } from "viem";
import { encodeKey, getKeySchema, getSchemaTypes } from "@latticexyz/protocol-parser/internal";
import { Table, Tables } from "@latticexyz/config";
import { getId, RawRecord } from "@latticexyz/store-sync/zustand";
import { StoreEventsLog, SyncStep, TableRecord } from "@latticexyz/store-sync";

type TableRecords<table extends Table> = {
  readonly [id: string]: TableRecord<table>;
};

// TODO: split this into distinct stores and combine (https://docs.pmnd.rs/zustand/guides/typescript#slices-pattern)?

export type ZustandState<tables extends Tables> = {
  // optimistic state
  readonly pendingLogs: Map<string, StoreEventsLog>
  // cannonical state
  readonly syncProgress: {
    readonly step: SyncStep;
    readonly message: string;
    readonly percentage: number;
    readonly latestBlockNumber: bigint;
    readonly lastBlockNumberProcessed: bigint;
  };
  /** Tables derived from table registration store events */
  readonly tables: {
    readonly [tableId: Hex]: Table;
  };
  /** Raw records (bytes) derived from store events */
  readonly rawRecords: {
    readonly [id: string]: RawRecord;
  };
  /** Decoded table records derived from raw records */
  readonly records: {
    readonly [id: string]: TableRecord<tables[keyof tables]>;
  };
  readonly getRecords: <table extends Table>(table: table) => TableRecords<table>;
  readonly getRecord: <table extends Table>(
    table: table,
    key: TableRecord<table>["key"],
  ) => TableRecord<table> | undefined;
  readonly getValue: <table extends Table>(
    table: table,
    key: TableRecord<table>["key"],
  ) => TableRecord<table>["value"] | undefined;
};

export type ZustandStore<tables extends Tables> = UseBoundStore<StoreApi<ZustandState<tables>>>;

export type CreateStoreOptions<tables extends Tables> = {
  tables: tables;
};

export function createStore<tables extends Tables>(opts: CreateStoreOptions<tables>): ZustandStore<tables> {
  return create<ZustandState<tables>>((set, get) => ({
    pendingLogs: new Map(),
    syncProgress: {
      step: SyncStep.INITIALIZE,
      message: "Connecting",
      percentage: 0,
      latestBlockNumber: 0n,
      lastBlockNumberProcessed: 0n,
    },
    tables: Object.fromEntries(Object.entries(opts.tables).map(([, table]) => [table.tableId, table])),
    rawRecords: {},
    records: {},
    getRecords: <table extends Table>(table: table): TableRecords<table> => {
      console.log('might blow up because we are ts expect erroring')
      const records = get().records;
      return Object.fromEntries(
        // @ts-expect-error
        Object.entries(records).filter(([id, record]) => record.table.tableId === table.tableId),
      ) as unknown as TableRecords<table>;
    },
    getRecord: <table extends Table>(table: table, key: TableRecord<table>["key"]): TableRecord<table> | undefined => {
      // TODO: update encodeKey to use more recent types
      const keyTuple = encodeKey(getSchemaTypes(getKeySchema(table)) as never, key as never);
      const id = getId({ tableId: table.tableId, keyTuple });
      return get().pendingLogs.get(id) ?? get().records[id] as unknown as TableRecord<table> | undefined;
    },
    getRecordOptimistic: <table extends Table>(table: table, key: TableRecord<table>["key"]): TableRecord<table> | undefined => {
      const keyTuple = encodeKey(getSchemaTypes(getKeySchema(table)) as never, key as never);
      const recordId = getId({ tableId: table.tableId, keyTuple })
        ;[...get().pendingLogs.entries()].find(([]))


      const id = getId({ tableId: table.tableId, keyTuple });
      const log = get().pendingLogs.get(id)
      if (log) {
        // const logAsRecord: TableRecord<table> = 
        if (log.eventName === ) {

        }

      }
      return as unknown as TableRecord<table> | undefined;
    },
    getValue: <table extends Table>(
      table: table,
      key: TableRecord<table>["key"],
    ): TableRecord<table>["value"] | undefined => {
      return get().getRecord(table, key)?.value;
    },
  }));
}
