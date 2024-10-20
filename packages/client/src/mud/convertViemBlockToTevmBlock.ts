import {
  Block as ViemBlock,
  Hash,
  Hex,
  Transaction,
  Withdrawal,
  hexToBytes,
} from 'viem'
import {
  Block as TevmBlock,
  BlockHeader,
  ClRequest,
  VerkleExecutionWitness,
} from 'tevm/block'
import { TransactionFactory, TypedTransaction } from 'tevm/tx'
import { Common } from 'tevm/common'
import { serializeTransaction } from 'viem'

export function convertViemBlockToTevmBlock(
  viemBlock: ViemBlock,
  common: Common,
): TevmBlock {
  // Create a BlockHeader from the viemBlock properties
  // const header = new BlockHeader(
  //   {
  //     // Map necessary properties from viemBlock to BlockHeader
  //     number: viemBlock.number,
  //     parentHash: viemBlock.parentHash,
  //     stateRoot: viemBlock.stateRoot,
  //     // Add other necessary mappings
  //   },
  //   { common },
  // )

  // Convert transactions
  const transactions: TypedTransaction[] = viemBlock.transactions.map((tx) => {
    if (typeof tx === 'string') {
      throw Error('full tx required')
    }

    const serializedTx = serializeTransaction(tx)
    const typedTx = TransactionFactory.fromSerializedData(
      hexToBytes(serializedTx),
    )
    return typedTx
  })

  console.log({ transactions })

  // Create the TevmBlock instance
  const tevmBlock = new TevmBlock(
    { common },
    {},
    transactions,
    [], // Assuming no uncle headers
    [],
    [], // Assuming no requests
    null, // Assuming no execution witness
  )

  return null
}
