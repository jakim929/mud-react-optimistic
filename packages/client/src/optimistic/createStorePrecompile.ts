import { createContract, definePrecompile, defineCall, Hex } from 'tevm'
import { IStoreKernelAbi } from './IStoreKernelAbi'
import { IStoreReadAbi } from './IStoreReadAbi'
import { Address, hexToBytes } from 'viem'
import { IStoreAbi } from './IStoreAbi'
import { FieldLayout } from './FieldLayout'
import { StoreCore } from './StoreCore'

export const createStorePrecompile = ({ address }: { address: Address }) => {
  const contract = createContract({
    abi: IStoreAbi,
    address: address,
  })
  // const testCall = ({ data, gasLimit }) => {
  //   console.log('called testCall', data, gasLimit)
  //   return {
  //     returnValue: hexToBytes('0x' as Hex),
  //     executionGasUsed: 0n,
  //     logs: [],
  //   }
  // }
  const call = defineCall(IStoreKernelAbi, {
    getRecord: async ({ args }) => {
      console.log('StorePrecompile: getRecord called with args:', args)
      return {
        returnValue: '0x' as Hex,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    getDynamicField: async ({ args }) => {
      console.log('StorePrecompile: getDynamicField called with args:', args)
      return {
        returnValue: '0x' as Hex,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    getDynamicFieldLength: async ({ args }) => {
      console.log(
        'StorePrecompile: getDynamicFieldLength called with args:',
        args,
      )
      return {
        returnValue: 0n,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    getDynamicFieldSlice: async ({ args }) => {
      console.log(
        'StorePrecompile: getDynamicFieldSlice called with args:',
        args,
      )
      return {
        returnValue: '0x' as Hex,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    getField: async ({ args }) => {
      console.log('StorePrecompile: getField called with args:', args)
      return {
        returnValue: '0x' as Hex,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    getFieldLayout: async ({ args }) => {
      console.log('StorePrecompile:  getFieldLayout called with args:', args)
      return {
        returnValue: '0x' as Hex,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    getFieldLength: async ({ args }) => {
      console.log('StorePrecompile: getFieldLength called with args:', args)
      return {
        returnValue: 0n,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    getKeySchema: async ({ args }) => {
      console.log('StorePrecompile:getKeySchema called with args:', args)
      return {
        returnValue: '0x' as Hex,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    getStaticField: async ({ args }) => {
      console.log('StorePrecompile: getStaticField called with args:', args)
      return {
        returnValue: '0x' as Hex,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    getValueSchema: async ({ args }) => {
      console.log('StorePrecompile: getValueSchema called with args:', args)
      return {
        returnValue: '0x' as Hex,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    deleteRecord: async ({ args }) => {
      console.log('StorePrecompile: deleteRecord called with args:', args)

      const [tableId, keyTuple] = args

      const { logs } = await new StoreCore(address).deleteRecord(
        tableId,
        keyTuple,
      )

      return {
        returnValue: undefined,
        executionGasUsed: 0n,
        logs,
      }
    },
    popFromDynamicField: async ({ args }) => {
      console.log(
        'StorePrecompile: popFromDynamicField called with args:',
        args,
      )
      return {
        returnValue: undefined,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    pushToDynamicField: async ({ args }) => {
      console.log('StorePrecompile: pushToDynamicField called with args:', args)
      return {
        returnValue: undefined,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    setDynamicField: async ({ args }) => {
      console.log('StorePrecompile: setDynamicField called with args:', args)
      return {
        returnValue: undefined,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    setField: async ({ args }) => {
      console.log('StorePrecompile: setField called with args:', args)

      const [tableId, keyTuple, fieldIndex, data, fieldLayoutHex] = args

      if (!fieldLayoutHex) {
        throw new Error('fieldLayoutHex is required')
        // TODO: we should be able to get fieldLayout from the tableId
      }

      const fieldLayout = new FieldLayout(fieldLayoutHex)

      const { logs } = await new StoreCore(address).setField(
        tableId,
        keyTuple,
        fieldIndex,
        data,
        fieldLayout,
      )

      return {
        returnValue: undefined,
        executionGasUsed: 0n,
        logs: logs,
      }
    },
    setRecord: async ({ args }) => {
      console.log('StorePrecompile: setRecord called with args:', args)

      const [tableId, keyTuple, staticData, encodedLengths, dynamicData] = args

      const { logs } = await new StoreCore(address).setRecord(
        tableId,
        keyTuple,
        staticData,
        encodedLengths,
        dynamicData,
      )

      return {
        returnValue: undefined,
        executionGasUsed: 0n,
        logs,
      }
    },
    setStaticField: async ({ args }) => {
      console.log('StorePrecompile: setStaticField called with args:', args)

      const [tableId, keyTuple, fieldIndex, data, fieldLayoutHex] = args

      if (!fieldLayoutHex) {
        throw new Error('fieldLayoutHex is required')
        // TODO: we should be able to get fieldLayout from the tableId
      }

      const fieldLayout = new FieldLayout(fieldLayoutHex)

      const { logs } = await new StoreCore(address).setStaticField(
        tableId,
        keyTuple,
        fieldIndex,
        data,
        fieldLayout,
      )

      return {
        returnValue: undefined,
        executionGasUsed: 0n,
        logs: logs,
      }
    },
    spliceDynamicData: async ({ args }) => {
      console.log('StorePrecompile: spliceDynamicData called with args:', args)
      return {
        returnValue: undefined,
        executionGasUsed: 0n,
        logs: [],
      }
    },
    spliceStaticData: async ({ args }) => {
      console.log('StorePrecompile: setStaticField called with args:', args)

      const [tableId, keyTuple, start, data] = args

      const { logs } = await new StoreCore(address).spliceStaticData(
        tableId,
        keyTuple,
        start,
        data,
      )

      return {
        returnValue: undefined,
        executionGasUsed: 0n,
        logs: logs,
      }
    },
    storeVersion: async () => {
      throw new Error('StorePrecompile: storeVersion unimplemented')
      console.log('StorePrecompile: storeVersion called')
      return {
        returnValue: '0x' as Hex,
        executionGasUsed: 0n,
        logs: [],
      }
    },
  })

  return definePrecompile({
    contract,
    call: call,
  })
}
