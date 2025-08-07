import { Effect, Layer, Ref, Stream } from 'effect'
import {
  BulkGreeksProcessor,
  ExpirationFilterError,
  type ExpirationResult,
  type ProcessingMetrics,
} from '../services/BulkGreeksProcessor'
import type { ExpirationDate, OptionsGreeksData } from '../services/ThetaDataApiClient'

/**
 * Test implementation of BulkGreeksProcessor for unit testing
 * Provides controllable mock behavior for testing various scenarios
 */
export const BulkGreeksProcessorTest = Layer.effect(
  BulkGreeksProcessor,
  Effect.gen(function* (_) {
    // State for tracking progress
    const progressRef = yield* _(
      Ref.make<{ current: number; total: number; currentExpiration?: string } | undefined>(
        undefined,
      ),
    )

    // Mock data generation
    const generateMockGreeksData = (
      _expiration: string,
      count: number,
    ): ReadonlyArray<OptionsGreeksData> => {
      const data: OptionsGreeksData[] = []
      const basePrice = 4500 // Approximate SPX price
      const now = new Date()

      for (let i = 0; i < count; i++) {
        const strike = 3000 + i * 5
        const isCall = i % 2 === 0

        const bidPrice = 10 + Math.random() * 100
        const spread = 0.5 + Math.random() * 2 // Ensure ask > bid

        data.push({
          strike,
          right: isCall ? 'C' : 'P',
          bid: bidPrice,
          ask: bidPrice + spread,
          delta: Math.random() * (isCall ? 1 : -1),
          theta: -Math.random() * 10,
          vega: Math.random() * 50,
          rho: Math.random() * 10,
          epsilon: Math.random() * 0.1,
          lambda: Math.random() * 0.5,
          impliedVolatility: 0.15 + Math.random() * 0.35,
          ivError: Math.random() * 0.01,
          underlyingPrice: basePrice + (Math.random() - 0.5) * 10,
          timestamp: now,
        })
      }
      return data
    }

    return BulkGreeksProcessor.of({
      processBulkGreeks: (params) =>
        Effect.gen(function* (_) {
          const startTime = new Date()

          // Generate mock expirations based on trade date
          const tradeDate = new Date(
            params.tradeDate.slice(0, 4) +
              '-' +
              params.tradeDate.slice(4, 6) +
              '-' +
              params.tradeDate.slice(6, 8),
          )

          // Create mock expirations (0DTE, 1DTE, 2DTE, 7DTE, 14DTE, 30DTE)
          const mockExpirations: ExpirationDate[] = [0, 1, 2, 7, 14, 30]
            .filter((dte) => params.maxDTE === undefined || dte <= params.maxDTE)
            .map((dte) => {
              const expDate = new Date(tradeDate)
              expDate.setDate(expDate.getDate() + dte)
              return {
                date: expDate.toISOString().split('T')[0],
                daysToExpiration: dte,
              }
            })

          yield* _(
            Ref.set(progressRef, {
              current: 0,
              total: mockExpirations.length,
              currentExpiration: undefined,
            }),
          )

          // Process each expiration with configurable concurrency
          const concurrency = params.concurrency ?? 2
          const results: ExpirationResult[] = []

          // Simulate parallel processing with delays
          const processExpiration = (exp: ExpirationDate, index: number) =>
            Effect.gen(function* (_) {
              const expDateStr = exp.date.replace(/-/g, '')
              yield* _(
                Ref.update(progressRef, (p) =>
                  p ? { ...p, current: index + 1, currentExpiration: expDateStr } : p,
                ),
              )

              const processingStart = Date.now()

              // Simulate processing delay (50-200ms)
              yield* _(Effect.sleep(50 + Math.random() * 150))

              // Simulate occasional failures (10% chance)
              if (Math.random() < 0.1 && params.root !== 'TEST_NO_FAILURES') {
                const error = new Error(`Mock API error for expiration ${expDateStr}`)
                results.push({
                  expiration: expDateStr,
                  success: false,
                  error,
                  recordCount: 0,
                  processingTimeMs: Date.now() - processingStart,
                })
                return Effect.succeed(undefined)
              }

              // Generate mock data (deterministic count based on expiration)
              // Use expiration date as seed for consistent record count
              const recordCount = 50 + ((exp.daysToExpiration * 7) % 150)
              const data = generateMockGreeksData(expDateStr, recordCount)

              results.push({
                expiration: expDateStr,
                success: true,
                data,
                recordCount,
                processingTimeMs: Date.now() - processingStart,
              })

              return Effect.succeed(undefined)
            })

          // Process in batches based on concurrency
          const batches: ExpirationDate[][] = []
          for (let i = 0; i < mockExpirations.length; i += concurrency) {
            batches.push(mockExpirations.slice(i, i + concurrency))
          }

          for (const batch of batches) {
            yield* _(
              Effect.all(
                batch.map((exp, idx) => processExpiration(exp, results.length + idx)),
                { concurrency: 'unbounded' },
              ),
            )
          }

          yield* _(Ref.set(progressRef, undefined))

          const endTime = new Date()
          const totalProcessingTimeMs = endTime.getTime() - startTime.getTime()
          const successfulResults = results.filter((r) => r.success)

          const metrics: ProcessingMetrics = {
            totalExpirations: results.length,
            successfulExpirations: successfulResults.length,
            failedExpirations: results.filter((r) => !r.success).length,
            totalRecords: successfulResults.reduce((sum, r) => sum + r.recordCount, 0),
            totalProcessingTimeMs,
            averageProcessingTimeMs: totalProcessingTimeMs / results.length,
            startTime,
            endTime,
            results,
          }

          return metrics
        }),

      filterExpirations: (expirations, tradeDate, maxDTE) =>
        Effect.gen(function* (_) {
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

          const _tradeDateObj = new Date(
            `${tradeDate.slice(0, 4)}-${tradeDate.slice(4, 6)}-${tradeDate.slice(6, 8)}`,
          )

          // Filter expirations based on DTE
          const filtered =
            maxDTE === undefined
              ? expirations
              : expirations.filter((exp) => exp.daysToExpiration <= maxDTE)

          return filtered
        }),

      getProgress: () => Ref.get(progressRef),

      streamBulkGreeks: (params) =>
        Stream.unwrap(
          Effect.gen(function* (_) {
            const _startTime = new Date()

            // Generate mock expirations based on trade date
            const tradeDate = new Date(
              params.tradeDate.slice(0, 4) +
                '-' +
                params.tradeDate.slice(4, 6) +
                '-' +
                params.tradeDate.slice(6, 8),
            )

            // Create mock expirations (0DTE, 1DTE, 2DTE, 7DTE, 14DTE, 30DTE)
            const mockExpirations: ExpirationDate[] = [0, 1, 2, 7, 14, 30]
              .filter((dte) => params.maxDTE === undefined || dte <= params.maxDTE)
              .map((dte) => {
                const expDate = new Date(tradeDate)
                expDate.setDate(expDate.getDate() + dte)
                return {
                  date: expDate.toISOString().split('T')[0],
                  daysToExpiration: dte,
                }
              })

            yield* _(
              Ref.set(progressRef, {
                current: 0,
                total: mockExpirations.length,
                currentExpiration: undefined,
              }),
            )

            // Create a stream from the mock expirations with indexes
            return Stream.fromIterable(mockExpirations.map((exp, index) => ({ exp, index }))).pipe(
              Stream.mapEffect(
                ({ exp, index }) =>
                  Effect.gen(function* (_) {
                    const expDateStr = exp.date.replace(/-/g, '')

                    yield* _(
                      Ref.update(progressRef, (p) =>
                        p ? { ...p, current: index + 1, currentExpiration: expDateStr } : p,
                      ),
                    )

                    const processingStart = Date.now()

                    // Simulate processing delay (50-200ms)
                    yield* _(Effect.sleep(50 + Math.random() * 150))

                    // Simulate occasional failures (10% chance)
                    if (Math.random() < 0.1 && params.root !== 'TEST_NO_FAILURES') {
                      const error = new Error(`Mock API error for expiration ${expDateStr}`)
                      return {
                        expiration: expDateStr,
                        success: false,
                        error,
                        recordCount: 0,
                        processingTimeMs: Date.now() - processingStart,
                      } as ExpirationResult
                    } else {
                      // Generate mock data (deterministic count based on expiration)
                      // Use expiration date as seed for consistent record count
                      const recordCount = 50 + ((exp.daysToExpiration * 7) % 150)
                      const data = generateMockGreeksData(expDateStr, recordCount)

                      return {
                        expiration: expDateStr,
                        success: true,
                        data,
                        recordCount,
                        processingTimeMs: Date.now() - processingStart,
                      } as ExpirationResult
                    }
                  }),
                { concurrency: params.concurrency || 1 },
              ),
              Stream.onDone(() => Ref.set(progressRef, undefined)),
            )
          }),
        ),
    })
  }),
)
