/*
 * The MUD client code is built on top of viem
 * (https://viem.sh/docs/getting-started.html).
 * This line imports the functions we need from it.
 */
import {
  fallback,
  webSocket,
  http,
  createWalletClient,
  Hex,
  ClientConfig,
  getContract,
} from 'viem'
import {
  createStorageAdapter,
  syncToZustand,
} from '@latticexyz/store-sync/zustand'
import { getNetworkConfig } from './getNetworkConfig'
import IWorldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json'
import {
  createBurnerAccount,
  transportObserver,
  ContractWrite,
} from '@latticexyz/common'
import { transactionQueue, writeObserver } from '@latticexyz/common/actions'
import { Subject, share } from 'rxjs'
import { createMemoryClient } from 'tevm'
import { createCommon } from 'tevm/common'
import { syncToZustandOptimistic } from '../optimistic/syncToZustandOptimistic'

/*
 * Import our MUD config, which includes strong types for
 * our tables and other config options. We use this to generate
 * things like RECS components and get back strong types for them.
 *
 * See https://mud.dev/templates/typescript/contracts#mudconfigts
 * for the source of this information.
 */
import mudConfig from 'contracts/mud.config'
import { createStorePrecompile } from '../optimistic/createStorePrecompile'
// import { createStore } from './createStore'

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>

const storePrecompileAddress =
  '0x5cfe08587E1fbDc2C0e8e50ba4B5f591F45B1849' as const

export async function setupNetwork() {
  const networkConfig = await getNetworkConfig()

  const storePrecompile = createStorePrecompile({
    address: storePrecompileAddress as Hex,
  })

  const memoryClient = createMemoryClient({
    fork: {
      transport: http(networkConfig.chain.rpcUrls.default.http[0])({
        chain: networkConfig.chain,
      }),
      blockTag: 'latest',
    },
    customPrecompiles: [storePrecompile.precompile()],
    // a tevm common is an extension of a viem chain
    common: createCommon(networkConfig.chain),
    // loggingLevel: 'debug',
  })

  const publicClient = memoryClient

  const vm = await memoryClient.tevm.getVm()
  memoryClient.tevm.on('message', (data) => {
    console.log('message', data)
  })
  vm.evm.events.on('step', (data, next) => {
    console.log('data', data)
    next?.()
  })

  // const testCallResult = await memoryClient.tevmCall({
  //   to: storePrecompileAddress,
  //   data: '0x12312',
  //   throwOnFail: false,
  //   createTrace: true,
  // })

  // console.log('testCallResult', testCallResult)

  // Setup auto mining
  // setInterval(async () => {
  //   const result = await memoryClient.tevmMine()
  //   console.log('mined block', result)
  // }, 1000)

  /*
   * Create a viem public (read only) client
   * (https://viem.sh/docs/clients/public.html)
   */
  const clientOptions = {
    chain: networkConfig.chain,
    transport: transportObserver(fallback([webSocket(), http()])),
    pollingInterval: 1000,
  } as const satisfies ClientConfig

  // const publicClient = createPublicClient(clientOptions)

  /*
   * Create an observable for contract writes that we can
   * pass into MUD dev tools for transaction observability.
   */
  const write$ = new Subject<ContractWrite>()

  /*
   * Create a temporary wallet and a viem client for it
   * (see https://viem.sh/docs/clients/wallet.html).
   */
  const burnerAccount = createBurnerAccount(networkConfig.privateKey as Hex)
  const burnerWalletClient = createWalletClient({
    ...clientOptions,
    account: burnerAccount,
  })
    .extend(transactionQueue())
    .extend(writeObserver({ onWrite: (write) => write$.next(write) }))

  /*
   * Create an object for communicating with the deployed World.
   */
  const worldContract = getContract({
    address: networkConfig.worldAddress as Hex,
    abi: IWorldAbi,
    client: {
      public: publicClient,
      wallet: burnerWalletClient,
    },
  })

  /*
   * Sync on-chain state into RECS and keeps our client in sync.
   * Uses the MUD indexer if available, otherwise falls back
   * to the viem publicClient to make RPC calls to fetch MUD
   * events from the chain.
   */
  const {
    tables,
    useStore,
    latestBlock$,
    storedBlockLogs$,
    waitForTransaction,
  } = await syncToZustandOptimistic({
    config: mudConfig,
    address: networkConfig.worldAddress as Hex,
    publicClient: publicClient,
    startBlock: BigInt(networkConfig.initialBlockNumber),
  })
  // const optimisticStore = createStore({ tables })

  // const storageAdapter = createStorageAdapter({ store: useStore })

  return {
    tables,
    useStore,
    publicClient,
    walletClient: burnerWalletClient,
    latestBlock$,
    storedBlockLogs$,
    waitForTransaction,
    worldContract,
    write$: write$.asObservable().pipe(share()),
    memoryClient,
    storePrecompileAddress,
  }
}
