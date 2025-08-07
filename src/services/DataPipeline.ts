import { Context, Data, type Effect, type Stream } from 'effect'
import type { ExpirationResult } from './BulkGreeksProcessor'

/**
 * Error type for DataPipeline operations
 */
export class DataPipelineError extends Data.TaggedError('DataPipelineError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Configuration for the data pipeline
 */
export interface PipelineConfig {
  readonly outputDir: string // Default: ./data/greeks
  readonly chunkSize: number // Default: 1000
  readonly compression: boolean // Default: false for CSV
  readonly fileNamePattern: string // e.g., "SPXW_{expiration}.csv"
}

/**
 * Real-time progress information for the pipeline
 */
export interface PipelineProgress {
  readonly totalExpirations: number
  readonly processedExpirations: number
  readonly currentExpiration?: string
  readonly totalRecords: number
  readonly recordsPerSecond: number
  readonly memoryUsageMB: number
  readonly startTime: Date
  readonly estimatedCompletionTime?: Date
}

/**
 * Service for orchestrating streaming data processing and writing
 */
export class DataPipeline extends Context.Tag('DataPipeline')<
  DataPipeline,
  {
    /**
     * Process a stream of expiration results and write to configured output
     * @param dataStream Stream of expiration results to process
     * @param config Pipeline configuration
     * @returns Effect that completes when all data is processed
     */
    readonly process: (
      dataStream: Stream.Stream<ExpirationResult, never>,
      config: PipelineConfig,
    ) => Effect.Effect<void, DataPipelineError>

    /**
     * Get current progress of the pipeline
     * @returns Current progress information or undefined if not processing
     */
    readonly getProgress: () => Effect.Effect<PipelineProgress | undefined, never>
  }
>() {}
