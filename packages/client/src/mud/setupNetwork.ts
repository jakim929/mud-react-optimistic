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
  createPublicClient,
  hexToBytes,
  Transaction,
  serializeTransaction,
  toHex,
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
import { Block as TevmBlock } from 'tevm/block'
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
import { TransactionFactory } from 'tevm/tx'
// import { createStore } from './createStore'

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>

const storePrecompileAddress =
  '0x5cfe08587E1fbDc2C0e8e50ba4B5f591F45B1849' as const

export async function setupNetwork() {
  const networkConfig = await getNetworkConfig()

  const storePrecompile = createStorePrecompile({
    address: storePrecompileAddress as Hex,
  })

  const chainCommon = createCommon(networkConfig.chain)

  console.log('chainCommon', chainCommon)
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

  // const publicClient = memoryClient

  /*
   * Create a viem public (read only) client
   * (https://viem.sh/docs/clients/public.html)
   */
  const clientOptions = {
    chain: networkConfig.chain,
    transport: transportObserver(fallback([webSocket(), http()])),
    pollingInterval: 1000,
  } as const satisfies ClientConfig

  const publicClient = createPublicClient(clientOptions)

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

  latestBlock$.subscribe(async (block) => {
    const vm = await memoryClient.tevm.getVm()
    console.log('new block', block.hash, block.number, block)

    const newTevmBlock = TevmBlock.fromBlockData(
      {
        transactions: [], // Transactions returned in latestBlock doesn't include full tx payload
        header: {
          parentHash: hexToBytes(block.parentHash, { size: 32 }),
          uncleHash: hexToBytes(block.sha3Uncles, { size: 32 }),
          coinbase: hexToBytes(block.miner, { size: 20 }),
          stateRoot: hexToBytes(block.stateRoot, { size: 32 }),
          transactionsTrie: hexToBytes(block.transactionsRoot, { size: 32 }),
          receiptTrie: hexToBytes(block.receiptsRoot, { size: 32 }),
          logsBloom: hexToBytes(block.logsBloom as Hex, { size: 256 }),
          difficulty: block.difficulty as bigint,
          number: block.number as bigint,
          gasLimit: block.gasLimit as bigint,
          gasUsed: block.gasUsed as bigint,
          timestamp: BigInt(block.timestamp),
          extraData: hexToBytes(block.extraData),
          mixHash: hexToBytes(block.mixHash, { size: 32 }),
          nonce: hexToBytes(block.nonce as Hex, { size: 8 }),
          baseFeePerGas: block.baseFeePerGas as bigint,
          blobGasUsed: block.blobGasUsed,
          excessBlobGas: block.excessBlobGas,
          parentBeaconBlockRoot: undefined,
          withdrawalsRoot: undefined,
        },
      },
      {
        common: chainCommon,
        freeze: false,
      },
    )

    // Hack to make the block hash match the block hash from the forked chain
    // Tevm doesn't know which EIP / hardforks are activated on the remote chain
    // so we need to manually set the hash here
    newTevmBlock.hash = () => hexToBytes(block.hash!)
    newTevmBlock.header.hash = () => hexToBytes(block.hash!)

    await vm.blockchain.putBlock(newTevmBlock)
  })

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
