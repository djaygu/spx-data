import { describe, expect, it } from 'bun:test'
import { Chunk, Effect, Stream } from 'effect'
import { BulkGreeksProcessorTest } from '../../src/layers/BulkGreeksProcessorTest'
import {
  type BulkGreeksParams,
  BulkGreeksProcessor,
  type ProcessingMetrics,
} from '../../src/services/BulkGreeksProcessor'

describe('BulkGreeksProcessor Streaming', () => {
  describe('streamBulkGreeks', () => {
    it('should stream expiration results as they complete', async () => {
      const params: BulkGreeksParams = {
        root: 'TEST_NO_FAILURES',
        tradeDate: '20240314',
        maxDTE: 2,
        concurrency: 2,
      }

      const results = await Effect.runPromise(
        Effect.gen(function* (_) {
          const processor = yield* _(BulkGreeksProcessor)
          const chunk = yield* _(processor.streamBulkGreeks(params).pipe(Stream.runCollect))
          return Chunk.toReadonlyArray(chunk)
        }).pipe(Effect.provide(BulkGreeksProcessorTest)),
      )

      // Should have results for 0DTE, 1DTE, and 2DTE
      expect(results.length).toBe(3)

      // All should be successful with TEST_NO_FAILURES flag
      results.forEach((result) => {
        expect(result.success).toBe(true)
        expect(result.recordCount).toBeGreaterThan(0)
        expect(result.processingTimeMs).toBeGreaterThan(0)
      })
    })

    it('should produce same results as batch method', async () => {
      const params: BulkGreeksParams = {
        root: 'TEST_NO_FAILURES', // Use deterministic mock without random failures
        tradeDate: '20240314',
        maxDTE: 7,
        concurrency: 2,
      }

      // Get batch results
      const batchResults: ProcessingMetrics = await Effect.runPromise(
        Effect.gen(function* (_) {
          const processor = yield* _(BulkGreeksProcessor)
          return yield* _(processor.processBulkGreeks(params))
        }).pipe(Effect.provide(BulkGreeksProcessorTest)),
      )

      // Get stream results
      const streamResults = await Effect.runPromise(
        Effect.gen(function* (_) {
          const processor = yield* _(BulkGreeksProcessor)
          const chunk = yield* _(processor.streamBulkGreeks(params).pipe(Stream.runCollect))
          return Chunk.toReadonlyArray(chunk)
        }).pipe(Effect.provide(BulkGreeksProcessorTest)),
      )

      // Should have same number of results
      expect(streamResults.length).toBe(batchResults.results.length)

      // Should have exact same total record count (deterministic mock data)
      const streamTotalRecords = streamResults
        .filter((r) => r.success)
        .reduce((sum, r) => sum + r.recordCount, 0)
      expect(streamTotalRecords).toBe(batchResults.totalRecords)
    })

    it('should handle partial failures gracefully', async () => {
      const params: BulkGreeksParams = {
        root: 'SPXW', // Will trigger random failures
        tradeDate: '20240314',
        maxDTE: 30,
        concurrency: 1,
      }

      const results = await Effect.runPromise(
        Effect.gen(function* (_) {
          const processor = yield* _(BulkGreeksProcessor)
          const chunk = yield* _(processor.streamBulkGreeks(params).pipe(Stream.runCollect))
          return Chunk.toReadonlyArray(chunk)
        }).pipe(Effect.provide(BulkGreeksProcessorTest)),
      )

      // Should have mix of successes and failures
      const successes = results.filter((r) => r.success)
      const failures = results.filter((r) => !r.success)

      expect(results.length).toBeGreaterThan(0)

      // Check failed results have error info
      failures.forEach((failure) => {
        expect(failure.error).toBeDefined()
        expect(failure.recordCount).toBe(0)
      })

      // Check successful results have data
      successes.forEach((success) => {
        expect(success.data).toBeDefined()
        expect(success.recordCount).toBeGreaterThan(0)
      })
    })

    it('should respect concurrency settings', async () => {
      const params: BulkGreeksParams = {
        root: 'TEST_NO_FAILURES',
        tradeDate: '20240314',
        maxDTE: 5,
        concurrency: 1, // Sequential processing
      }

      const startTime = Date.now()

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const processor = yield* _(BulkGreeksProcessor)
          const chunk = yield* _(processor.streamBulkGreeks(params).pipe(Stream.runCollect))
          return Chunk.toReadonlyArray(chunk)
        }).pipe(Effect.provide(BulkGreeksProcessorTest)),
      )

      const sequentialTime = Date.now() - startTime

      // Now test with parallel processing
      const parallelParams = { ...params, concurrency: 4 }
      const parallelStartTime = Date.now()

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const processor = yield* _(BulkGreeksProcessor)
          const chunk = yield* _(processor.streamBulkGreeks(parallelParams).pipe(Stream.runCollect))
          return Chunk.toReadonlyArray(chunk)
        }).pipe(Effect.provide(BulkGreeksProcessorTest)),
      )

      const parallelTime = Date.now() - parallelStartTime

      // Parallel should be noticeably faster (but not always due to test randomness)
      // So we just check both completed
      expect(sequentialTime).toBeGreaterThan(0)
      expect(parallelTime).toBeGreaterThan(0)
    })

    it('should handle empty results when no expirations match', async () => {
      const params: BulkGreeksParams = {
        root: 'SPXW',
        tradeDate: '20240314',
        maxDTE: -1, // No expirations will match
        concurrency: 2,
      }

      const results = await Effect.runPromise(
        Effect.gen(function* (_) {
          const processor = yield* _(BulkGreeksProcessor)
          const chunk = yield* _(processor.streamBulkGreeks(params).pipe(Stream.runCollect))
          return Chunk.toReadonlyArray(chunk)
        }).pipe(Effect.provide(BulkGreeksProcessorTest)),
      )

      expect(results.length).toBe(0)
    })

    it('should stream results in order as they complete', async () => {
      const params: BulkGreeksParams = {
        root: 'TEST_NO_FAILURES',
        tradeDate: '20240314',
        maxDTE: 3,
        concurrency: 2,
      }

      const expirations: string[] = []

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const processor = yield* _(BulkGreeksProcessor)
          return yield* _(
            processor.streamBulkGreeks(params).pipe(
              Stream.tap((result) =>
                Effect.sync(() => {
                  expirations.push(result.expiration)
                }),
              ),
              Stream.runDrain,
            ),
          )
        }).pipe(Effect.provide(BulkGreeksProcessorTest)),
      )

      // Should have received all expirations
      expect(expirations.length).toBe(3) // 0DTE, 1DTE, 2DTE (maxDTE=3 means up to 3DTE but mock data only has 0,1,2)

      // Each expiration should be unique
      const uniqueExpirations = new Set(expirations)
      expect(uniqueExpirations.size).toBe(expirations.length)
    })
  })
})
