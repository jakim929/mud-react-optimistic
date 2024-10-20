/*
 * Create the system calls that the client can use to ask
 * for changes in the World state (using the System contracts).
 */

import {
  Address,
  Hex,
  Log,
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseEventLogs,
  toBytes,
} from 'viem'
import { v4 } from 'uuid'
import { SetupNetworkResult } from './setupNetwork'
import { storeEventsAbi } from '@latticexyz/store'

// 0x629a4c26e296b22a8e0856e9f6ecb2d1008d7e00081111962cd175fa7488e175
const STORAGE_SLOT = keccak256(toBytes('mud.store.storage.StoreSwitch'))

const storePrecompileAddress =
  '0x5cfe08587E1fbDc2C0e8e50ba4B5f591F45B1849' as const as Address

const precompileStateOverrideSet = {
  // app__task system
  ['0xCf04B0E16D674e29043e861F971C5A1c04FeDc44']: {
    state: {
      [STORAGE_SLOT]: storePrecompileAddress,
    },
  },

  [storePrecompileAddress]: {
    code: '0x6068', // hack to bypass EXTCODESIZE check when making external calls to the store precompile
  },
} as const

export type SystemCalls = ReturnType<typeof createSystemCalls>

export function createSystemCalls(
  /*
   * The parameter list informs TypeScript that:
   *
   * - The first parameter is expected to be a
   *   SetupNetworkResult, as defined in setupNetwork.ts
   *
   *   Out of this parameter, we only care about two fields:
   *   - worldContract (which comes from getContract, see
   *     https://github.com/latticexyz/mud/blob/main/templates/react/packages/client/src/mud/setupNetwork.ts#L63-L69).
   *
   *   - waitForTransaction (which comes from syncToRecs, see
   *     https://github.com/latticexyz/mud/blob/main/templates/react/packages/client/src/mud/setupNetwork.ts#L77-L83).
   *
   * - From the second parameter, which is a ClientComponent,
   *   we only care about Counter. This parameter comes to use
   *   through createClientComponents.ts, but it originates in
   *   syncToRecs
   *   (https://github.com/latticexyz/mud/blob/main/templates/react/packages/client/src/mud/setupNetwork.ts#L77-L83).
   */
  {
    tables,
    useStore,
    worldContract,
    walletClient,
    waitForTransaction,

    memoryClient,
  }: SetupNetworkResult,
) {
  const applyToStore = async (marker: string, logs: Log[]) => {
    const parsedLogs = parseEventLogs({
      abi: storeEventsAbi,
      // @ts-ignore
      logs,
    })

    useStore.getState().addPendingLogs(marker, parsedLogs)
  }

  const addTask = async (label: string) => {
    const tevmCallResult = await memoryClient.tevmContract({
      to: worldContract.address,
      abi: worldContract.abi,
      functionName: 'app__addTask',
      args: [label],
      from: walletClient.account.address,
      throwOnFail: false,
      stateOverrideSet: precompileStateOverrideSet,
    })

    console.log('add tevmCallResult', tevmCallResult)

    const marker = v4()
    await applyToStore(marker, (tevmCallResult.logs as Log[]) ?? [])
    ;(async () => {
      const tx = await worldContract.write.app__addTask([label])
      await waitForTransaction(tx)
      useStore.getState().removePendingLogsForMarker(marker)
    })()
  }

  const toggleTask = async (id: Hex) => {
    const isComplete =
      (useStore.getState().getValueOptimistic(tables.Tasks, { id })
        ?.completedAt ?? 0n) > 0n

    const fnName = isComplete ? 'app__resetTask' : 'app__completeTask'
    const functionData = encodeFunctionData({
      abi: worldContract.abi,
      functionName: fnName,
      args: [id],
    })

    console.log('action', fnName)

    // TODO: figure out: state override seems to persist between calls
    // delete when https://github.com/evmts/tevm-monorepo/pull/1481 lands
    const tevmCallResult = await memoryClient.tevmCall({
      to: worldContract.address,
      data: functionData,
      from: walletClient.account.address,
      stateOverrideSet: precompileStateOverrideSet,
    })

    console.log('toggle tevmCallResult', tevmCallResult)

    const marker = v4()
    await applyToStore(marker, (tevmCallResult.logs as Log[]) ?? [])
    ;(async () => {
      const tx = isComplete
        ? await worldContract.write.app__resetTask([id])
        : await worldContract.write.app__completeTask([id])
      await waitForTransaction(tx)
      useStore.getState().removePendingLogsForMarker(marker)
    })()
  }

  const deleteTask = async (id: Hex) => {
    const tevmCallResult = await memoryClient.tevmContract({
      to: worldContract.address,
      abi: worldContract.abi,
      functionName: 'app__deleteTask',
      args: [id],
      from: walletClient.account.address,
      throwOnFail: false,
      stateOverrideSet: precompileStateOverrideSet,
    })
    console.log('delete tevmCallResult', tevmCallResult)

    const marker = v4()
    await applyToStore(marker, (tevmCallResult.logs as Log[]) ?? [])
    ;(async () => {
      const tx = await worldContract.write.app__deleteTask([id])
      await waitForTransaction(tx)
      useStore.getState().removePendingLogsForMarker(marker)
    })()
  }

  const appendToTaskDescription = async (id: Hex, text: String) => {
    const tevmCallResult = await memoryClient.tevmContract({
      to: worldContract.address,
      abi: worldContract.abi,
      functionName: 'app__appendToTaskDescription',
      args: [id, text],
      from: walletClient.account.address,
      throwOnFail: false,
      stateOverrideSet: precompileStateOverrideSet,
    })
    console.log('append tevmCallResult', tevmCallResult)

    const marker = v4()
    await applyToStore(marker, (tevmCallResult.logs as Log[]) ?? [])
    ;(async () => {
      const tx = await worldContract.write.app__appendToTaskDescription([
        id,
        text,
      ])
      await waitForTransaction(tx)
      useStore.getState().removePendingLogsForMarker(marker)
    })()
  }

  return {
    addTask,
    toggleTask,
    deleteTask,
    appendToTaskDescription,
  }
}
