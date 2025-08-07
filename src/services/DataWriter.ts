import { Context, Data, type Effect } from 'effect'
import type { OptionsGreeksData } from './ThetaDataApiClient'

/**
 * Error type for DataWriter operations
 */
export class DataWriterError extends Data.TaggedError('DataWriterError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Metadata for write operations
 */
export interface WriteMetadata {
  readonly expiration: string
  readonly isFirstChunk: boolean
  readonly isLastChunk: boolean
  readonly chunkIndex: number
  readonly totalRecords?: number
}

/**
 * Result of a completed write operation
 */
export interface WriteResult {
  readonly filesCreated: ReadonlyArray<string>
  readonly totalRecordsWritten: number
  readonly totalBytesWritten: number
  readonly format: string
}

/**
 * Service abstraction for writing options data to different formats
 */
export class DataWriter extends Context.Tag('DataWriter')<
  DataWriter,
  {
    /**
     * Write a chunk of data
     * @param chunk Array of options data records to write
     * @param metadata Information about the chunk being written
     * @returns Effect that completes when chunk is written
     */
    readonly writeChunk: (
      chunk: ReadonlyArray<OptionsGreeksData>,
      metadata: WriteMetadata,
    ) => Effect.Effect<void, DataWriterError>

    /**
     * Finalize the write operation and close resources
     * @returns Result summary of the write operation
     */
    readonly finalize: () => Effect.Effect<WriteResult, DataWriterError>

    /**
     * Get the output format of this writer
     * @returns Format name (e.g., 'csv', 'parquet')
     */
    readonly getFormat: () => string
  }
>() {}
