import { Effect, Layer, Ref, Stream } from 'effect'
import { AppConfig } from '../config/AppConfig'
import {
  type BulkGreeksParams,
  BulkGreeksProcessor,
  BulkProcessingError,
  ExpirationFilterError,
  type ExpirationResult,
  type ProcessingMetrics,
} from '../services/BulkGreeksProcessor'
import {
  type BulkOptionsGreeksParams,
  type ExpirationDate,
  ThetaDataApiClient,
} from '../services/ThetaDataApiClient'

/**
 * Live implementation of BulkGreeksProcessor that uses ThetaDataApiClient
 * to fetch real options Greeks data in parallel by expiration
 */
export const BulkGreeksProcessorLive = Layer.effect(
  BulkGreeksProcessor,
  Effect.gen(function* (_) {
    const apiClient = yield* _(ThetaDataApiClient)
    const config = yield* _(AppConfig)

    // State for tracking progress
    const progressRef = yield* _(
      Ref.make<{ current: number; total: number; currentExpiration?: string } | undefined>(
        undefined,
      ),
    )

    return BulkGreeksProcessor.of({
      processBulkGreeks: (params: BulkGreeksParams) =>
        Effect.gen(function* (_) {
          const startTime = new Date()

          // Get list of available expirations
          const allExpirations = yield* _(
            apiClient.listExpirations().pipe(
              Effect.catchAll((error) =>
                Effect.fail(
                  new BulkProcessingError({
                    message: `Failed to list expirations: ${error.message}`,
                    cause: error,
                  }),
                ),
              ),
            ),
          )

          // Filter expirations based on trade date and maxDTE
          const filteredExpirations = yield* _(
            filterExpirationsInternal(allExpirations, params.tradeDate, params.maxDTE).pipe(
              Effect.catchAll((error) =>
                Effect.fail(
                  new BulkProcessingError({
                    message: error.message,
                    cause: error,
                  }),
                ),
              ),
            ),
          )

          if (filteredExpirations.length === 0) {
            return {
              totalExpirations: 0,
              successfulExpirations: 0,
              failedExpirations: 0,
              totalRecords: 0,
              totalProcessingTimeMs: 0,
              averageProcessingTimeMs: 0,
              startTime,
              endTime: new Date(),
              results: [],
            }
          }

          // Set initial progress
          yield* _(
            Ref.set(progressRef, {
              current: 0,
              total: filteredExpirations.length,
              currentExpiration: undefined,
            }),
          )

          // Process each expiration, capturing both successes and failures
          const concurrency = params.concurrency ?? config.thetaData.maxConcurrentRequests ?? 2

          const processExpiration = (
            exp: ExpirationDate,
            index: number,
          ): Effect.Effect<ExpirationResult, never> =>
            Effect.gen(function* (_) {
              const expDateStr = exp.date.replace(/-/g, '')

              // Update progress
              yield* _(
                Ref.update(progressRef, (p) =>
                  p ? { ...p, current: index + 1, currentExpiration: expDateStr } : p,
                ),
              )

              const processingStart = Date.now()

              // Prepare parameters for bulk Greeks request
              const bulkParams: BulkOptionsGreeksParams = {
                root: params.root,
                expiration: expDateStr,
                startDate: params.tradeDate,
                endDate: params.tradeDate,
                interval: params.interval, // Optional interval for data points
                rth: params.rth ?? true, // Default to regular trading hours
              }

              // Fetch data with error handling
              const result = yield* _(
                apiClient.getBulkOptionsGreeks(bulkParams).pipe(
                  Effect.map((data) => ({
                    expiration: expDateStr,
                    success: true as const,
                    data,
                    recordCount: data.length,
                    processingTimeMs: Date.now() - processingStart,
                  })),
                  Effect.catchAll((error) =>
                    Effect.succeed({
                      expiration: expDateStr,
                      success: false as const,
                      error: error instanceof Error ? error : new Error(String(error)),
                      recordCount: 0,
                      processingTimeMs: Date.now() - processingStart,
                    }),
                  ),
                ),
              )

              return result
            })

          // Process all expirations with specified concurrency
          const results = yield* _(
            Effect.all(
              filteredExpirations.map((exp, idx) => processExpiration(exp, idx)),
              { concurrency },
            ),
          )

          // Clear progress
          yield* _(Ref.set(progressRef, undefined))

          // Calculate metrics
          const endTime = new Date()
          const totalProcessingTimeMs = endTime.getTime() - startTime.getTime()
          const successfulResults = results.filter((r) => r.success)
          const totalRecords = successfulResults.reduce((sum, r) => sum + r.recordCount, 0)

          const metrics: ProcessingMetrics = {
            totalExpirations: results.length,
            successfulExpirations: successfulResults.length,
            failedExpirations: results.filter((r) => !r.success).length,
            totalRecords,
            totalProcessingTimeMs,
            averageProcessingTimeMs:
              results.length > 0 ? totalProcessingTimeMs / results.length : 0,
            startTime,
            endTime,
            results,
          }

          // Log summary
          yield* _(
            Effect.log(
              `Bulk Greeks processing completed: ${metrics.successfulExpirations}/${metrics.totalExpirations} successful, ` +
                `${metrics.totalRecords} records, ${metrics.totalProcessingTimeMs}ms`,
            ),
          )

          return metrics
        }),

      filterExpirations: (expirations, tradeDate, maxDTE) =>
        filterExpirationsInternal(expirations, tradeDate, maxDTE),

      getProgress: () => Ref.get(progressRef),

      streamBulkGreeks: (params: BulkGreeksParams) =>
        Stream.unwrap(
          Effect.gen(function* (_) {
            // Get list of available expirations
            const allExpirations = yield* _(
              apiClient.listExpirations().pipe(
                Effect.catchAll((error) =>
                  Effect.fail(
                    new BulkProcessingError({
                      message: `Failed to list expirations: ${error.message}`,
                      cause: error,
                    }),
                  ),
                ),
              ),
            )

            // Filter expirations based on trade date and maxDTE
            const filteredExpirations = yield* _(
              filterExpirationsInternal(allExpirations, params.tradeDate, params.maxDTE).pipe(
                Effect.catchAll((error) =>
                  Effect.fail(
                    new BulkProcessingError({
                      message: error.message,
                      cause: error,
                    }),
                  ),
                ),
              ),
            )

            if (filteredExpirations.length === 0) {
              return Stream.empty
            }

            // Set initial progress
            yield* _(
              Ref.set(progressRef, {
                current: 0,
                total: filteredExpirations.length,
                currentExpiration: undefined,
              }),
            )

            const concurrency = params.concurrency ?? config.thetaData.maxConcurrentRequests ?? 2

            // Create a function to process a single expiration
            const processExpiration = (
              exp: ExpirationDate,
              index: number,
            ): Effect.Effect<ExpirationResult, never> =>
              Effect.gen(function* (_) {
                const expDateStr = exp.date.replace(/-/g, '')

                // Update progress
                yield* _(
                  Ref.update(progressRef, (p) =>
                    p ? { ...p, current: index + 1, currentExpiration: expDateStr } : p,
                  ),
                )

                const processingStart = Date.now()

                // Prepare parameters for bulk Greeks request
                const bulkParams: BulkOptionsGreeksParams = {
                  root: params.root,
                  expiration: expDateStr,
                  startDate: params.tradeDate,
                  endDate: params.tradeDate,
                  interval: params.interval,
                  rth: params.rth ?? true,
                }

                // Fetch data with error handling
                const result = yield* _(
                  apiClient.getBulkOptionsGreeks(bulkParams).pipe(
                    Effect.map((data) => ({
                      expiration: expDateStr,
                      success: true as const,
                      data,
                      recordCount: data.length,
                      processingTimeMs: Date.now() - processingStart,
                    })),
                    Effect.catchAll((error) =>
                      Effect.succeed({
                        expiration: expDateStr,
                        success: false as const,
                        error: error instanceof Error ? error : new Error(String(error)),
                        recordCount: 0,
                        processingTimeMs: Date.now() - processingStart,
                      }),
                    ),
                  ),
                )

                return result
              })

            // Stream expirations with concurrent processing
            return Stream.fromIterable(filteredExpirations).pipe(
              Stream.zipWithIndex,
              Stream.mapEffect(([exp, index]) => processExpiration(exp, index), { concurrency }),
              Stream.tap(() =>
                Effect.gen(function* (_) {
                  const progress = yield* _(Ref.get(progressRef))
                  if (progress && progress.current === progress.total) {
                    yield* _(Ref.set(progressRef, undefined))
                  }
                }),
              ),
            )
          }),
        ),
    })
  }),
)

/**
 * Internal helper to filter expirations
 */
function filterExpirationsInternal(
  expirations: ReadonlyArray<ExpirationDate>,
  tradeDate: string,
  maxDTE?: number,
): Effect.Effect<ReadonlyArray<ExpirationDate>, ExpirationFilterError> {
  return Effect.gen(function* (_) {
    // Validate trade date format
    if (!/^\d{8}$/.test(tradeDate)) {
      return yield* _(
        Effect.fail(
          new ExpirationFilterError({
            message: `Invalid trade date format: ${tradeDate}. Expected YYYYMMDD`,
            tradeDate,
          }),
        ),
      )
    }

    // Parse trade date
    const year = parseInt(tradeDate.slice(0, 4))
    const month = parseInt(tradeDate.slice(4, 6)) - 1 // JavaScript months are 0-indexed
    const day = parseInt(tradeDate.slice(6, 8))
    const tradeDateObj = new Date(year, month, day)

    // Filter expirations based on trade date and maxDTE
    const filtered = expirations.filter((exp) => {
      // Parse expiration date
      const expDateObj = new Date(exp.date)

      // Expiration must be on or after trade date
      if (expDateObj < tradeDateObj) {
        return false
      }

      // Calculate days to expiration from trade date
      const msPerDay = 24 * 60 * 60 * 1000
      const daysFromTradeDate = Math.floor(
        (expDateObj.getTime() - tradeDateObj.getTime()) / msPerDay,
      )

      // Apply maxDTE filter if specified
      if (maxDTE !== undefined && daysFromTradeDate > maxDTE) {
        return false
      }

      return true
    })

    yield* _(
      Effect.log(
        `Filtered expirations: ${filtered.length} of ${expirations.length} ` +
          `(trade date: ${tradeDate}, maxDTE: ${maxDTE ?? 'unlimited'})`,
      ),
    )

    return filtered
  })
}
