import { describe, expect, it } from 'bun:test'
import { Config, Context, Effect, Layer } from 'effect'
import type { AppConfig } from '../../src/config/AppConfig'
import { BulkGreeksProcessorLive } from '../../src/layers/BulkGreeksProcessorLive'
import { ThetaDataApiClientLive } from '../../src/layers/ThetaDataApiClientLive'
import { type BulkGreeksParams, BulkGreeksProcessor } from '../../src/services/BulkGreeksProcessor'

// Only run integration tests when THETA_DATA_TERMINAL_URL is set
const SHOULD_RUN_INTEGRATION_TESTS = process.env.THETA_DATA_TERMINAL_URL !== undefined

// Set environment variables for the test
if (SHOULD_RUN_INTEGRATION_TESTS) {
  process.env.CONFIG_THETADATA_BASE_URL =
    process.env.THETA_DATA_TERMINAL_URL || 'http://127.0.0.1:25510'
}

// Create AppConfig layer
const AppConfigLive = Layer.effect(
  Context.GenericTag<AppConfig>('AppConfig'),
  Config.all({
    thetaData: Config.all({
      baseUrl: Config.string('CONFIG_THETADATA_BASE_URL').pipe(
        Config.withDefault('http://127.0.0.1:25510'),
      ),
      maxConcurrentRequests: Config.number('CONFIG_THETADATA_MAX_CONCURRENT_REQUESTS').pipe(
        Config.withDefault(2),
      ),
      maxRetries: Config.number('CONFIG_THETADATA_MAX_RETRIES').pipe(Config.withDefault(3)),
      retryBaseDelayMs: Config.number('CONFIG_THETADATA_RETRY_BASE_DELAY_MS').pipe(
        Config.withDefault(1000),
      ),
      requestTimeoutMs: Config.number('CONFIG_THETADATA_REQUEST_TIMEOUT_MS').pipe(
        Config.withDefault(30000),
      ),
    }),
    download: Config.all({
      maxDTE: Config.number('CONFIG_DOWNLOAD_MAX_DTE').pipe(Config.withDefault(30)),
    }),
    storage: Config.all({
      dataDirectory: Config.string('CONFIG_STORAGE_DATA_DIRECTORY').pipe(
        Config.withDefault('./data'),
      ),
    }),
  }),
)

const IntegrationLive = BulkGreeksProcessorLive.pipe(
  Layer.provide(ThetaDataApiClientLive),
  Layer.provide(AppConfigLive),
)

describe.skipIf(!SHOULD_RUN_INTEGRATION_TESTS)('BulkGreeksProcessorLive Integration Tests', () => {
  it('should process real expirations in parallel', async () => {
    // Use a historical date that we know has data (March 14, 2024)
    const tradeDate = '20240314' // YYYYMMDD format

    const params: BulkGreeksParams = {
      root: 'SPXW',
      tradeDate,
      maxDTE: 2, // Process only expirations within 2 days (0DTE, 1DTE, 2DTE)
      concurrency: 2, // Process 2 expirations in parallel
      interval: 3600000, // 1 hour intervals for faster data retrieval
      rth: true, // Regular trading hours only
    }

    const result = await Effect.runPromise(
      Effect.gen(function* (_) {
        const processor = yield* _(BulkGreeksProcessor)
        return yield* _(processor.processBulkGreeks(params))
      }).pipe(
        Effect.provide(IntegrationLive),
        Effect.timeout('30 seconds'), // Add timeout for safety
      ),
    )

    // Verify we got results
    expect(result.totalExpirations).toBeGreaterThan(0)
    expect(result.results).toBeDefined()
    expect(result.results.length).toBe(result.totalExpirations)

    // Check metrics
    expect(result.totalProcessingTimeMs).toBeGreaterThan(0)
    expect(result.averageProcessingTimeMs).toBeGreaterThan(0)
    expect(result.startTime).toBeInstanceOf(Date)
    expect(result.endTime).toBeInstanceOf(Date)

    // Log summary for debugging
    console.log(`
Processed ${result.successfulExpirations}/${result.totalExpirations} expirations successfully
Total records: ${result.totalRecords}
Total time: ${result.totalProcessingTimeMs}ms
Average time per expiration: ${result.averageProcessingTimeMs.toFixed(2)}ms
Failed expirations: ${result.failedExpirations}
`)

    // Check individual results
    result.results.forEach((expResult) => {
      if (expResult.success) {
        expect(expResult.data).toBeDefined()
        expect(expResult.recordCount).toBeGreaterThan(0)
        expect(expResult.processingTimeMs).toBeGreaterThan(0)

        // Verify data structure
        if (expResult.data && expResult.data.length > 0) {
          const firstOption = expResult.data[0]
          expect(firstOption.strike).toBeGreaterThan(0)
          expect(['C', 'P']).toContain(firstOption.right)
          expect(firstOption.bid).toBeGreaterThanOrEqual(0)
          expect(firstOption.ask).toBeGreaterThanOrEqual(firstOption.bid)
          expect(firstOption.underlyingPrice).toBeGreaterThan(0)
        }
      } else {
        expect(expResult.error).toBeDefined()
        expect(expResult.recordCount).toBe(0)
      }
    })
  }, 30000) // 30 second timeout for the test

  it('should handle partial failures gracefully', async () => {
    // Use a historical date that we know has data
    const tradeDate = '20240314'

    // Request with a mix of valid and potentially invalid parameters
    const params: BulkGreeksParams = {
      root: 'SPXW',
      tradeDate,
      maxDTE: 5, // Include some expirations but not too many
      concurrency: 4, // Max parallel processing
      interval: 3600000, // 1 hour intervals for faster data retrieval
      rth: true,
    }

    const result = await Effect.runPromise(
      Effect.gen(function* (_) {
        const processor = yield* _(BulkGreeksProcessor)
        return yield* _(processor.processBulkGreeks(params))
      }).pipe(Effect.provide(IntegrationLive), Effect.timeout('60 seconds')),
    )

    // Even if some fail, we should get partial results
    expect(result.totalExpirations).toBeGreaterThan(0)
    expect(result.successfulExpirations + result.failedExpirations).toBe(result.totalExpirations)

    // Log failures for debugging
    if (result.failedExpirations > 0) {
      const failures = result.results.filter((r) => !r.success)
      console.log(`
Failed expirations: ${result.failedExpirations}
Failure details:
${failures.map((f) => `- ${f.expiration}: ${f.error?.message}`).join('\n')}
`)
    }
  }, 60000)

  it('should correctly filter expirations by maxDTE', async () => {
    // Use a historical date that we know has data
    const tradeDate = '20240314'

    // Test with very restrictive DTE
    const params: BulkGreeksParams = {
      root: 'SPXW',
      tradeDate,
      maxDTE: 1, // Only 0DTE and 1DTE
      concurrency: 2,
      interval: 3600000, // 1 hour intervals for faster data retrieval
      rth: true,
    }

    const result = await Effect.runPromise(
      Effect.gen(function* (_) {
        const processor = yield* _(BulkGreeksProcessor)
        return yield* _(processor.processBulkGreeks(params))
      }).pipe(Effect.provide(IntegrationLive), Effect.timeout('30 seconds')),
    )

    // Should have at most 2 expirations (0DTE and 1DTE)
    expect(result.totalExpirations).toBeLessThanOrEqual(2)

    // Log the expirations processed
    console.log(`
Expirations processed with maxDTE=1:
${result.results.map((r) => `- ${r.expiration} (${r.recordCount} records)`).join('\n')}
`)
  }, 30000)

  it('should collect accurate metrics with real data', async () => {
    // Use a historical date that we know has data
    const tradeDate = '20240314'

    const params: BulkGreeksParams = {
      root: 'SPXW',
      tradeDate,
      maxDTE: 2, // Limited set for faster test
      concurrency: 3,
      interval: 3600000, // 1 hour intervals for faster data retrieval
      rth: true,
    }

    const result = await Effect.runPromise(
      Effect.gen(function* (_) {
        const processor = yield* _(BulkGreeksProcessor)
        return yield* _(processor.processBulkGreeks(params))
      }).pipe(Effect.provide(IntegrationLive), Effect.timeout('30 seconds')),
    )

    // Verify metrics accuracy
    const manualTotalRecords = result.results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + r.recordCount, 0)

    expect(result.totalRecords).toBe(manualTotalRecords)

    const manualAvgTime = result.totalProcessingTimeMs / result.results.length
    expect(result.averageProcessingTimeMs).toBeCloseTo(manualAvgTime, 1)

    // Each result should have consistent data
    result.results.forEach((r) => {
      expect(r.processingTimeMs).toBeGreaterThan(0)
      expect(r.processingTimeMs).toBeLessThan(result.totalProcessingTimeMs)
    })

    console.log(`
Metrics Summary:
- Total expirations: ${result.totalExpirations}
- Successful: ${result.successfulExpirations}
- Failed: ${result.failedExpirations}
- Total records: ${result.totalRecords}
- Total time: ${result.totalProcessingTimeMs}ms
- Average time: ${result.averageProcessingTimeMs.toFixed(2)}ms
- Records per expiration: ${(result.totalRecords / result.successfulExpirations).toFixed(0)}
`)
  }, 30000)
})
