import { Hex, hexToBigInt, toHex } from 'viem'

// Constants
const WORD_SIZE = 32n
const WORD_LAST_INDEX = 31n
const BYTE_TO_BITS = 8n
const MAX_TOTAL_FIELDS = 28n
const MAX_DYNAMIC_FIELDS = 5n

const LayoutOffsets = {
  TOTAL_LENGTH: 240n,
  NUM_STATIC_FIELDS: 232n,
  NUM_DYNAMIC_FIELDS: 224n,
} as const

// Custom error types
class FieldLayoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FieldLayoutError'
  }
}

export class FieldLayout {
  private value: bigint

  constructor(fieldLayout: Hex) {
    this.value = hexToBigInt(fieldLayout)
  }

  static encode(
    staticFieldLengths: bigint[],
    numDynamicFields: bigint,
  ): FieldLayout {
    let fieldLayout = 0n
    let totalLength = 0n
    const totalFields = BigInt(staticFieldLengths.length) + numDynamicFields

    if (totalFields > MAX_TOTAL_FIELDS) {
      throw new FieldLayoutError(
        `FieldLayout_TooManyFields: ${totalFields} > ${MAX_TOTAL_FIELDS}`,
      )
    }
    if (numDynamicFields > MAX_DYNAMIC_FIELDS) {
      throw new FieldLayoutError(
        `FieldLayout_TooManyDynamicFields: ${numDynamicFields} > ${MAX_DYNAMIC_FIELDS}`,
      )
    }

    // Encode static field lengths
    for (let i = 0n; i < BigInt(staticFieldLengths.length); i++) {
      const staticByteLength = staticFieldLengths[Number(i)]
      if (staticByteLength === 0n) {
        throw new FieldLayoutError(`FieldLayout_StaticLengthIsZero: ${i}`)
      } else if (staticByteLength > WORD_SIZE) {
        throw new FieldLayoutError(
          `FieldLayout_StaticLengthDoesNotFitInAWord: ${i}`,
        )
      }

      totalLength += staticByteLength
      fieldLayout |=
        staticByteLength << ((WORD_LAST_INDEX - 4n - i) * BYTE_TO_BITS)
    }

    // Encode metadata
    fieldLayout |= totalLength << LayoutOffsets.TOTAL_LENGTH
    fieldLayout |=
      BigInt(staticFieldLengths.length) << LayoutOffsets.NUM_STATIC_FIELDS
    fieldLayout |= numDynamicFields << LayoutOffsets.NUM_DYNAMIC_FIELDS

    return new FieldLayout(`0x${fieldLayout.toString(16).padStart(64, '0')}`)
  }

  atIndex(index: bigint): bigint {
    return BigInt(
      Number(
        (this.value >> ((WORD_LAST_INDEX - 4n - index) * BYTE_TO_BITS)) & 0xffn,
      ),
    )
  }

  staticDataLength(): bigint {
    return this.value >> LayoutOffsets.TOTAL_LENGTH
  }

  numStaticFields(): bigint {
    return BigInt(
      Number((this.value >> LayoutOffsets.NUM_STATIC_FIELDS) & 0xffn),
    )
  }

  numDynamicFields(): bigint {
    return BigInt(
      Number((this.value >> LayoutOffsets.NUM_DYNAMIC_FIELDS) & 0xffn),
    )
  }

  numFields(): bigint {
    return this.numStaticFields() + this.numDynamicFields()
  }

  isEmpty(): boolean {
    return this.value === 0n
  }

  validate(): void {
    if (this.isEmpty()) {
      throw new FieldLayoutError('FieldLayout_Empty')
    }

    const _numDynamicFields = this.numDynamicFields()
    if (_numDynamicFields > MAX_DYNAMIC_FIELDS) {
      throw new FieldLayoutError(
        `FieldLayout_TooManyDynamicFields: ${_numDynamicFields} > ${MAX_DYNAMIC_FIELDS}`,
      )
    }

    const _numStaticFields = this.numStaticFields()
    const _numTotalFields = _numStaticFields + _numDynamicFields
    if (_numTotalFields > MAX_TOTAL_FIELDS) {
      throw new FieldLayoutError(
        `FieldLayout_TooManyFields: ${_numTotalFields} > ${MAX_TOTAL_FIELDS}`,
      )
    }

    // Validate static lengths
    let _staticDataLength = 0n
    for (let i = 0n; i < _numStaticFields; i++) {
      const staticByteLength = this.atIndex(i)
      if (staticByteLength === 0n) {
        throw new FieldLayoutError(`FieldLayout_StaticLengthIsZero: ${i}`)
      } else if (staticByteLength > WORD_SIZE) {
        throw new FieldLayoutError(
          `FieldLayout_StaticLengthDoesNotFitInAWord: ${i}`,
        )
      }
      _staticDataLength += staticByteLength
    }

    // Check if static length sums match
    if (_staticDataLength !== this.staticDataLength()) {
      throw new FieldLayoutError(
        `FieldLayout_InvalidStaticDataLength: ${this.staticDataLength()} != ${_staticDataLength}`,
      )
    }

    // Check if unused fields are zero
    for (let i = _numStaticFields; i < MAX_TOTAL_FIELDS; i++) {
      const staticByteLength = this.atIndex(i)
      if (staticByteLength !== 0n) {
        throw new FieldLayoutError(`FieldLayout_StaticLengthIsNotZero: ${i}`)
      }
    }
  }

  unwrap(): Hex {
    return toHex(this.value, { size: 32 })
  }
}
