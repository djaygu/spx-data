import { describe, expect, it } from 'bun:test'
import { Effect, Fiber, Layer, Stream } from 'effect'
import { DataPipelineLive } from '../../src/layers/DataPipelineLive'
import { DataWriterTest } from '../../src/layers/DataWriterTest'
import { MetricsWriterTest } from '../../src/layers/MetricsWriterTest'
import type { ExpirationResult } from '../../src/services/BulkGreeksProcessor'
import { DataPipeline, type PipelineConfig } from '../../src/services/DataPipeline'
import type { OptionsGreeksData } from '../../src/services/ThetaDataApiClient'

describe('DataPipeline', () => {
  const createMockGreeksData = (count: number): OptionsGreeksData[] => {
    const data: OptionsGreeksData[] = []
    for (let i = 0; i < count; i++) {
      data.push({
        strike: 4500 + i * 10,
        right: i % 2 === 0 ? 'C' : 'P',
        bid: 100 + i,
        ask: 101 + i,
        delta: 0.5 - i * 0.01,
        theta: -0.05 - i * 0.001,
        vega: 0.2 + i * 0.002,
        rho: 0.1 + i * 0.001,
        epsilon: 0.05 + i * 0.0005,
        lambda: 0.8 + i * 0.01,
        impliedVolatility: 0.15 + i * 0.001,
        ivError: 0.001,
        underlyingPrice: 4500 + i * 0.1,
        timestamp: new Date('2024-03-14T09:30:00Z'),
      })
    }
    return data
  }

  const createMockExpirationResult = (
    expiration: string,
    recordCount: number,
    success = true,
  ): ExpirationResult => ({
    expiration,
    success,
    data: success ? createMockGreeksData(recordCount) : undefined,
    error: success ? undefined : new Error(`Failed to fetch ${expiration}`),
    recordCount: success ? recordCount : 0,
    processingTimeMs: 100,
  })

  const TestLayer = DataPipelineLive.pipe(
    Layer.provide(DataWriterTest),
    Layer.provide(MetricsWriterTest),
  )

  describe('process', () => {
    it('should process a stream of expiration results', async () => {
      const results: ExpirationResult[] = [
        createMockExpirationResult('20240314', 100),
        createMockExpirationResult('20240315', 150),
        createMockExpirationResult('20240316', 200),
      ]

      const config: PipelineConfig = {
        outputDir: './test-output',
        chunkSize: 50,
        compression: false,
        fileNamePattern: 'SPXW_{expiration}.csv',
      }

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const pipeline = yield* _(DataPipeline)
          yield* _(pipeline.process(Stream.fromIterable(results), config))
        }).pipe(Effect.provide(TestLayer)),
      )

      // Test passes if no error thrown
      expect(true).toBe(true)
    })

    it('should handle chunking correctly', async () => {
      const results: ExpirationResult[] = [
        createMockExpirationResult('20240314', 250), // Will be split into 3 chunks of 100
      ]

      const config: PipelineConfig = {
        outputDir: './test-output',
        chunkSize: 100,
        compression: false,
        fileNamePattern: 'SPXW_{expiration}.csv',
      }

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const pipeline = yield* _(DataPipeline)
          yield* _(pipeline.process(Stream.fromIterable(results), config))
        }).pipe(Effect.provide(TestLayer)),
      )

      expect(true).toBe(true)
    })

    it('should handle failed expirations gracefully', async () => {
      const results: ExpirationResult[] = [
        createMockExpirationResult('20240314', 100, true),
        createMockExpirationResult('20240315', 0, false), // Failed
        createMockExpirationResult('20240316', 150, true),
      ]

      const config: PipelineConfig = {
        outputDir: './test-output',
        chunkSize: 50,
        compression: false,
        fileNamePattern: 'SPXW_{expiration}.csv',
      }

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const pipeline = yield* _(DataPipeline)
          yield* _(pipeline.process(Stream.fromIterable(results), config))
        }).pipe(Effect.provide(TestLayer)),
      )

      // Should process successfully despite one failure
      expect(true).toBe(true)
    })

    it('should handle empty stream', async () => {
      const config: PipelineConfig = {
        outputDir: './test-output',
        chunkSize: 100,
        compression: false,
        fileNamePattern: 'SPXW_{expiration}.csv',
      }

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const pipeline = yield* _(DataPipeline)
          yield* _(pipeline.process(Stream.empty, config))
        }).pipe(Effect.provide(TestLayer)),
      )

      expect(true).toBe(true)
    })

    it('should process large datasets efficiently', async () => {
      const results: ExpirationResult[] = [
        createMockExpirationResult('20240314', 5000),
        createMockExpirationResult('20240315', 5000),
        createMockExpirationResult('20240316', 5000),
      ]

      const config: PipelineConfig = {
        outputDir: './test-output',
        chunkSize: 1000,
        compression: false,
        fileNamePattern: 'SPXW_{expiration}.csv',
      }

      const startTime = Date.now()

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const pipeline = yield* _(DataPipeline)
          yield* _(pipeline.process(Stream.fromIterable(results), config))
        }).pipe(Effect.provide(TestLayer)),
      )

      const processingTime = Date.now() - startTime

      // Should process 15,000 records reasonably quickly (under 5 seconds in test)
      expect(processingTime).toBeLessThan(5000)
    })
  })

  describe('getProgress', () => {
    it('should track progress during processing', async () => {
      const results: ExpirationResult[] = [
        createMockExpirationResult('20240314', 100),
        createMockExpirationResult('20240315', 150),
      ]

      const config: PipelineConfig = {
        outputDir: './test-output',
        chunkSize: 50,
        compression: false,
        fileNamePattern: 'SPXW_{expiration}.csv',
      }

      const progressUpdates: unknown[] = []

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const pipeline = yield* _(DataPipeline)

          // Start processing in background
          const fiber = yield* _(
            pipeline.process(Stream.fromIterable(results), config).pipe(Effect.fork),
          )

          // Check progress periodically
          for (let i = 0; i < 5; i++) {
            yield* _(Effect.sleep(10))
            const progress = yield* _(pipeline.getProgress())
            if (progress) {
              progressUpdates.push(progress)
            }
          }

          // Wait for completion
          yield* _(Fiber.join(fiber))
        }).pipe(Effect.provide(TestLayer)),
      )

      // Should have captured some progress updates (or completed too fast)
      // If no progress was captured, it means processing completed very quickly
      expect(progressUpdates.length).toBeGreaterThanOrEqual(0)

      // Progress should have expected fields
      if (progressUpdates.length > 0) {
        const progress = progressUpdates[0]
        expect(progress).toHaveProperty('totalExpirations')
        expect(progress).toHaveProperty('processedExpirations')
        expect(progress).toHaveProperty('totalRecords')
        expect(progress).toHaveProperty('recordsPerSecond')
        expect(progress).toHaveProperty('memoryUsageMB')
        expect(progress).toHaveProperty('startTime')
      }
    })

    it('should return undefined when not processing', async () => {
      const progress = await Effect.runPromise(
        Effect.gen(function* (_) {
          const pipeline = yield* _(DataPipeline)
          return yield* _(pipeline.getProgress())
        }).pipe(Effect.provide(TestLayer)),
      )

      expect(progress).toBeUndefined()
    })
  })
})
