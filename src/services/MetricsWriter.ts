import { Context, Data, type Effect } from 'effect'

/**
 * Error type for MetricsWriter operations
 */
export class MetricsWriterError extends Data.TaggedError('MetricsWriterError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Comprehensive metrics for a pipeline run
 */
export interface PipelineRunMetrics {
  readonly runId: string
  readonly startTime: Date
  readonly endTime: Date
  readonly totalDuration: number // seconds

  // Volume metrics
  readonly totalExpirations: number
  readonly successfulExpirations: number
  readonly failedExpirations: number
  readonly totalRecords: number
  readonly totalDataSize: number // bytes written

  // Performance metrics
  readonly averageThroughput: number // records/sec
  readonly peakThroughput: number // records/sec
  readonly averageExpirationTime: number // seconds

  // Resource metrics
  readonly peakMemoryUsage: number // MB
  readonly averageMemoryUsage: number // MB

  // Output metrics
  readonly filesCreated: ReadonlyArray<string> // paths to output files
  readonly outputFormat: string // 'csv' or 'parquet'
  readonly compressionUsed: boolean

  // Error summary
  readonly errors: ReadonlyArray<{
    readonly expiration: string
    readonly errorType: string
    readonly message: string
  }>
}

/**
 * Query parameters for retrieving metrics
 */
export interface MetricsQuery {
  readonly startDate?: Date
  readonly endDate?: Date
  readonly runId?: string
  readonly limit?: number
}

/**
 * Service abstraction for persisting and retrieving pipeline metrics
 */
export class MetricsWriter extends Context.Tag('MetricsWriter')<
  MetricsWriter,
  {
    /**
     * Write pipeline run metrics to persistent storage
     * @param metrics The metrics to persist
     * @returns Effect that completes when metrics are written
     */
    readonly writeMetrics: (metrics: PipelineRunMetrics) => Effect.Effect<void, MetricsWriterError>

    /**
     * Read historical metrics from storage
     * @param query Optional query parameters to filter results
     * @returns Array of historical pipeline run metrics
     */
    readonly readMetrics: (
      query?: MetricsQuery,
    ) => Effect.Effect<ReadonlyArray<PipelineRunMetrics>, MetricsWriterError>

    /**
     * Get the storage type of this writer
     * @returns Storage type identifier
     */
    readonly getStorageType: () => 'json' | 'sqlite' | 'postgres'
  }
>() {}
