import { Hex, hexToBigInt, toHex } from 'viem'

// Constants
const BYTE_TO_BITS = 8n
const ACC_BITS = 7n * BYTE_TO_BITS
const VAL_BITS = 5n * BYTE_TO_BITS
const MAX_VAL = 2n ** 40n - 1n

// Custom error type
class EncodedLengthsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EncodedLengthsError'
  }
}

export class EncodedLengths {
  private value: bigint

  constructor(encodedLengths: Hex) {
    this.value = hexToBigInt(encodedLengths)
  }

  static pack(...values: bigint[]): EncodedLengths {
    if (values.length > 5) {
      throw new EncodedLengthsError('EncodedLengths_TooManyValues')
    }

    let encodedLengths = 0n
    let accumulator = 0n

    for (let i = 0; i < values.length; i++) {
      const value = values[i]
      if (value > MAX_VAL) {
        throw new EncodedLengthsError(`EncodedLengths_InvalidLength: ${value}`)
      }
      accumulator += value
      encodedLengths |= value << (ACC_BITS + VAL_BITS * BigInt(i))
    }

    encodedLengths |= accumulator

    return new EncodedLengths(
      `0x${encodedLengths.toString(16).padStart(64, '0')}`,
    )
  }

  total(): bigint {
    return this.value & ((1n << ACC_BITS) - 1n)
  }

  atIndex(index: number): bigint {
    if (index < 0 || index > 4) {
      throw new EncodedLengthsError(`EncodedLengths_InvalidIndex: ${index}`)
    }
    return (this.value >> (ACC_BITS + VAL_BITS * BigInt(index))) & MAX_VAL
  }

  setAtIndex(index: number, newValueAtIndex: bigint): EncodedLengths {
    if (index < 0 || index > 4) {
      throw new EncodedLengthsError(`EncodedLengths_InvalidIndex: ${index}`)
    }
    if (newValueAtIndex > MAX_VAL) {
      throw new EncodedLengthsError(
        `EncodedLengths_InvalidLength: ${newValueAtIndex}`,
      )
    }

    let accumulator = this.total()
    const currentValueAtIndex = this.atIndex(index)

    // Update accumulator
    accumulator = accumulator - currentValueAtIndex + newValueAtIndex

    // Clear the old value and set the new value
    const mask = MAX_VAL << (ACC_BITS + VAL_BITS * BigInt(index))
    let newValue =
      (this.value & ~mask) |
      (newValueAtIndex << (ACC_BITS + VAL_BITS * BigInt(index)))

    // Set the new accumulator
    newValue = (newValue & ~((1n << ACC_BITS) - 1n)) | accumulator

    return new EncodedLengths(`0x${newValue.toString(16).padStart(64, '0')}`)
  }

  unwrap(): Hex {
    return toHex(this.value, { size: 32 })
  }
}
