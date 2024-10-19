import { spliceHex } from '@latticexyz/common'
import { getId } from '@latticexyz/store-sync/zustand'
import { size } from 'viem'

import { StoreEventsLog } from '@latticexyz/store-sync'

import { RawRecord, TableRecord } from '@latticexyz/store-sync/zustand'
import { Table } from '@latticexyz/config'
import {
  decodeKey,
  decodeValueArgs,
  getKeySchema,
  getSchemaTypes,
  getValueSchema,
  KeySchema,
} from '@latticexyz/protocol-parser/internal'

type MutableRawRecord = {
  -readonly [K in keyof RawRecord]: RawRecord[K]
}

function convertToTableRecord(rawRecord: RawRecord, table: Table): TableRecord {
  // TODO: update decodeKey to use more recent types
  const key = decodeKey(
    getSchemaTypes(getKeySchema(table)) as KeySchema,
    rawRecord.keyTuple,
  )
  // TODO: update decodeValueArgs to use more recent types
  const value = decodeValueArgs(
    getSchemaTypes(getValueSchema(table)),
    rawRecord,
  )

  return {
    id: rawRecord.id,
    table,
    keyTuple: rawRecord.keyTuple,
    key,
    value,
    fields: { ...key, ...value },
  } satisfies TableRecord
}

export const applyLogsToSingleRecord = <TTable extends Table>({
  existingRawRecord,
  table,
  logs,
}: {
  existingRawRecord?: RawRecord
  table: TTable
  logs: StoreEventsLog[] // assumes these are all for the same record
}): TableRecord<TTable> | null => {
  const id = getId(logs[0].args)
  const tableId = logs[0].args.tableId
  const keyTuple = logs[0].args.keyTuple

  const initialRecord: RawRecord = {
    id: id,
    tableId: tableId,
    keyTuple: keyTuple,
    staticData: '0x',
    encodedLengths: '0x',
    dynamicData: '0x',
  }

  let updatedRecord: MutableRawRecord = existingRawRecord || {
    ...initialRecord,
  }

  for (const log of logs) {
    if (log.eventName === 'Store_SetRecord') {
      updatedRecord = {
        id: getId(log.args),
        tableId: log.args.tableId,
        keyTuple: log.args.keyTuple,
        staticData: log.args.staticData,
        encodedLengths: log.args.encodedLengths,
        dynamicData: log.args.dynamicData,
      }
    } else if (log.eventName === 'Store_SpliceStaticData' && updatedRecord) {
      updatedRecord.staticData = spliceHex(
        updatedRecord.staticData,
        log.args.start,
        size(log.args.data),
        log.args.data,
      )
    } else if (log.eventName === 'Store_SpliceDynamicData' && updatedRecord) {
      updatedRecord.encodedLengths = log.args.encodedLengths
      updatedRecord.dynamicData = spliceHex(
        updatedRecord.dynamicData,
        log.args.start,
        log.args.deleteCount,
        log.args.data,
      )
    } else if (log.eventName === 'Store_DeleteRecord') {
      updatedRecord = { ...initialRecord } // Reinitialize param
    }
  }

  // if the record is back to its initial state, return null
  if (JSON.stringify(updatedRecord) === JSON.stringify(initialRecord)) {
    return null
  }

  return updatedRecord ? convertToTableRecord(updatedRecord, table) : null
}
