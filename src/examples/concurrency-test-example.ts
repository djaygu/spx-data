import { Effect, Fiber, Ref } from 'effect'
import { AppConfig } from '../config/AppConfig'
import { type BulkOptionsGreeksParams, ThetaDataApiClient } from '../services/ThetaDataApiClient'

/**
 * Example showing how to track and verify concurrency behavior
 */
export const trackConcurrencyExample = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  const _config = yield* _(AppConfig)

  // Track concurrent requests
  const activeRequests = yield* _(Ref.make(0))
  const maxConcurrent = yield* _(Ref.make(0))

  // Wrap the client methods to track concurrency
  const trackedGetBulkGreeks = (params: BulkOptionsGreeksParams) =>
    Effect.gen(function* (_) {
      // Increment active count
      yield* _(Ref.update(activeRequests, (n) => n + 1))

      // Update max if needed
      const current = yield* _(Ref.get(activeRequests))
      yield* _(Ref.update(maxConcurrent, (max) => Math.max(max, current)))

      // Simulate some work
      yield* _(Effect.sleep('100 millis'))

      // Call actual method
      const result = yield* _(client.getBulkOptionsGreeks(params))

      // Decrement active count
      yield* _(Ref.update(activeRequests, (n) => n - 1))

      return result
    })

  // Create 10 requests for different expirations
  const expirations = Array.from(
    { length: 10 },
    (_, i) => `202401${String(19 + i).padStart(2, '0')}`,
  )

  const requests = expirations.map((exp) =>
    trackedGetBulkGreeks({
      root: 'SPXW',
      expiration: exp,
      startDate: exp,
      endDate: exp,
      interval: 3600000, // Hourly
      rth: true,
    }),
  )

  // Execute with concurrency limit of 2
  yield* _(
    Effect.all(requests, {
      concurrency: 2, // This is the key - limiting concurrency
    }),
  )

  // Get final statistics
  const maxSeen = yield* _(Ref.get(maxConcurrent))
  const finalActive = yield* _(Ref.get(activeRequests))

  yield* _(Effect.log(`Max concurrent requests: ${maxSeen}`))
  yield* _(Effect.log(`Final active requests: ${finalActive}`))
  yield* _(Effect.log(`Concurrency limit respected: ${maxSeen <= 2}`))

  return {
    maxConcurrent: maxSeen,
    finalActive,
    concurrencyRespected: maxSeen <= 2,
  }
})

/**
 * Example showing different concurrency limits for different operations
 */
export const differentConcurrencyLimits = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  const _config = yield* _(AppConfig)

  // Scenario 1: Low concurrency for heavy operations (bulk Greeks)
  const heavyOperations = ['20240119', '20240126', '20240202'].map((exp) =>
    client.getBulkOptionsGreeks({
      root: 'SPXW',
      expiration: exp,
      startDate: exp,
      endDate: exp,
      interval: 60000, // 1 minute intervals - more data
    }),
  )

  yield* _(Effect.log('Starting heavy operations with concurrency=1...'))
  const fiber1 = yield* _(Effect.all(heavyOperations, { concurrency: 1 }).pipe(Effect.fork))

  // Scenario 2: Higher concurrency for light operations
  const lightOperations = Array.from({ length: 5 }, () => client.healthCheck())

  yield* _(Effect.log('Starting light operations with concurrency=5...'))
  const fiber2 = yield* _(Effect.all(lightOperations, { concurrency: 5 }).pipe(Effect.fork))

  // Wait for both to complete
  const heavyResults = yield* _(Fiber.join(fiber1))
  const lightResults = yield* _(Fiber.join(fiber2))

  yield* _(Effect.log(`Heavy operations completed: ${heavyResults.length} results`))
  yield* _(Effect.log(`Light operations completed: ${lightResults.length} results`))

  return {
    heavyOperationCount: heavyResults.length,
    lightOperationCount: lightResults.length,
  }
})

/**
 * Example showing how to measure performance with different concurrency levels
 */
export const performanceComparison = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)

  const expirations = ['20240119', '20240126', '20240202', '20240209']
  const createRequests = () =>
    expirations.map((exp) =>
      client.getBulkOptionsGreeks({
        root: 'SPXW',
        expiration: exp,
        startDate: exp,
        endDate: exp,
        interval: 3600000, // Hourly for performance testing
        rth: true,
      }),
    )

  // Test with concurrency = 1 (sequential)
  yield* _(Effect.log('Testing with concurrency = 1 (sequential)...'))
  const startSeq = Date.now()
  yield* _(Effect.all(createRequests(), { concurrency: 1 }))
  const seqTime = Date.now() - startSeq

  // Test with concurrency = 2
  yield* _(Effect.log('Testing with concurrency = 2...'))
  const startConc2 = Date.now()
  yield* _(Effect.all(createRequests(), { concurrency: 2 }))
  const conc2Time = Date.now() - startConc2

  // Test with concurrency = 4 (all parallel)
  yield* _(Effect.log('Testing with concurrency = 4 (parallel)...'))
  const startConc4 = Date.now()
  yield* _(Effect.all(createRequests(), { concurrency: 4 }))
  const conc4Time = Date.now() - startConc4

  yield* _(Effect.log(`Sequential (c=1): ${seqTime}ms`))
  yield* _(Effect.log(`Concurrent (c=2): ${conc2Time}ms`))
  yield* _(Effect.log(`Parallel (c=4): ${conc4Time}ms`))

  // Generally expect: seqTime > conc2Time > conc4Time
  return { seqTime, conc2Time, conc4Time }
})

/**
 * Example of how to run these concurrency examples
 */
export const runConcurrencyExamples = Effect.gen(function* (_) {
  yield* _(Effect.log('=== Concurrency Tracking Example ==='))
  const trackingResult = yield* _(trackConcurrencyExample)
  yield* _(Effect.log(`Result: ${JSON.stringify(trackingResult, null, 2)}`))

  yield* _(Effect.log('\n=== Different Concurrency Limits Example ==='))
  const limitsResult = yield* _(differentConcurrencyLimits)
  yield* _(Effect.log(`Result: ${JSON.stringify(limitsResult, null, 2)}`))

  yield* _(Effect.log('\n=== Performance Comparison Example ==='))
  const perfResult = yield* _(performanceComparison)
  yield* _(Effect.log(`Result: ${JSON.stringify(perfResult, null, 2)}`))
})
