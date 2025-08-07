import { Context, Data, type Effect, type Stream } from 'effect'
import type { ExpirationDate, OptionsGreeksData } from './ThetaDataApiClient'

/**
 * Error types for bulk processing operations
 */
export class BulkProcessingError extends Data.TaggedError('BulkProcessingError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ExpirationFilterError extends Data.TaggedError('ExpirationFilterError')<{
  readonly message: string
  readonly tradeDate: string
}> {}

/**
 * Represents the result of processing a single expiration
 */
export interface ExpirationResult {
  readonly expiration: string
  readonly success: boolean
  readonly data?: ReadonlyArray<OptionsGreeksData>
  readonly error?: Error
  readonly recordCount: number
  readonly processingTimeMs: number
}

/**
 * Metrics collected during bulk processing
 */
export interface ProcessingMetrics {
  readonly totalExpirations: number
  readonly successfulExpirations: number
  readonly failedExpirations: number
  readonly totalRecords: number
  readonly totalProcessingTimeMs: number
  readonly averageProcessingTimeMs: number
  readonly startTime: Date
  readonly endTime: Date
  readonly results: ReadonlyArray<ExpirationResult>
}

/**
 * Parameters for bulk Greeks processing
 */
export interface BulkGreeksParams {
  readonly root: string
  readonly tradeDate: string // YYYYMMDD format
  readonly maxDTE?: number // Maximum days to expiration to include
  readonly concurrency?: number // Parallel processing limit (2-4)
  readonly interval?: number // Interval in milliseconds for data points (e.g., 3600000 for 1 hour)
  readonly rth?: boolean // Regular trading hours only
}

/**
 * Service for processing bulk options Greeks data in parallel by expiration
 */
export class BulkGreeksProcessor extends Context.Tag('BulkGreeksProcessor')<
  BulkGreeksProcessor,
  {
    /**
     * Process bulk Greeks data for all expirations on a trade date
     * @param params Processing parameters including root symbol and trade date
     * @returns Processing metrics including success/failure details per expiration
     */
    readonly processBulkGreeks: (
      params: BulkGreeksParams,
    ) => Effect.Effect<ProcessingMetrics, BulkProcessingError>

    /**
     * Filter expirations based on trade date and max DTE
     * @param expirations List of available expirations
     * @param tradeDate The trade date in YYYYMMDD format
     * @param maxDTE Maximum days to expiration (optional)
     * @returns Filtered list of expirations
     */
    readonly filterExpirations: (
      expirations: ReadonlyArray<ExpirationDate>,
      tradeDate: string,
      maxDTE?: number,
    ) => Effect.Effect<ReadonlyArray<ExpirationDate>, ExpirationFilterError>

    /**
     * Get progress of current processing (if any)
     * @returns Current processing progress or undefined if not processing
     */
    readonly getProgress: () => Effect.Effect<
      { current: number; total: number; currentExpiration?: string } | undefined,
      never
    >

    /**
     * Stream bulk Greeks data for all expirations on a trade date
     * Results are yielded as each expiration completes processing
     * @param params Processing parameters including root symbol and trade date
     * @returns Stream of expiration results as they complete
     */
    readonly streamBulkGreeks: (
      params: BulkGreeksParams,
    ) => Stream.Stream<ExpirationResult, BulkProcessingError>
  }
>() {}
