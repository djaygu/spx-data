import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { MetricsWriterTest } from '../../src/layers/MetricsWriterTest'
import { MetricsWriter, type PipelineRunMetrics } from '../../src/services/MetricsWriter'

describe('MetricsWriter', () => {
  const createMockMetrics = (runId: string): PipelineRunMetrics => ({
    runId,
    startTime: new Date('2024-03-14T10:00:00Z'),
    endTime: new Date('2024-03-14T10:05:00Z'),
    totalDuration: 300,
    totalExpirations: 10,
    successfulExpirations: 9,
    failedExpirations: 1,
    totalRecords: 50000,
    totalDataSize: 5000000,
    averageThroughput: 166.67,
    peakThroughput: 250,
    averageExpirationTime: 30,
    peakMemoryUsage: 150,
    averageMemoryUsage: 120,
    filesCreated: [
      'data/greeks/20240314/SPXW_20240314.csv',
      'data/greeks/20240315/SPXW_20240315.csv',
    ],
    outputFormat: 'csv',
    compressionUsed: false,
    errors: [
      {
        expiration: '20240320',
        errorType: 'NetworkError',
        message: 'Connection timeout',
      },
    ],
  })

  describe('writeMetrics', () => {
    it('should write metrics successfully', async () => {
      const metrics = createMockMetrics('test-run-1')

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(MetricsWriter)
          yield* _(writer.writeMetrics(metrics))
        }).pipe(Effect.provide(MetricsWriterTest)),
      )

      // Test passes if no error thrown
      expect(true).toBe(true)
    })

    it('should write multiple metrics', async () => {
      const metrics1 = createMockMetrics('test-run-1')
      const metrics2 = createMockMetrics('test-run-2')

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(MetricsWriter)
          yield* _(writer.writeMetrics(metrics1))
          yield* _(writer.writeMetrics(metrics2))
        }).pipe(Effect.provide(MetricsWriterTest)),
      )

      expect(true).toBe(true)
    })
  })

  describe('readMetrics', () => {
    it('should read all metrics when no query provided', async () => {
      const metrics1 = createMockMetrics('test-run-1')
      const metrics2 = createMockMetrics('test-run-2')

      const results = await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(MetricsWriter)
          yield* _(writer.writeMetrics(metrics1))
          yield* _(writer.writeMetrics(metrics2))
          return yield* _(writer.readMetrics())
        }).pipe(Effect.provide(MetricsWriterTest)),
      )

      expect(results).toHaveLength(2)
      expect(results[0].runId).toBe('test-run-1')
      expect(results[1].runId).toBe('test-run-2')
    })

    it('should filter by runId', async () => {
      const metrics1 = createMockMetrics('test-run-1')
      const metrics2 = createMockMetrics('test-run-2')

      const results = await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(MetricsWriter)
          yield* _(writer.writeMetrics(metrics1))
          yield* _(writer.writeMetrics(metrics2))
          return yield* _(writer.readMetrics({ runId: 'test-run-2' }))
        }).pipe(Effect.provide(MetricsWriterTest)),
      )

      expect(results).toHaveLength(1)
      expect(results[0].runId).toBe('test-run-2')
    })

    it('should filter by date range', async () => {
      const metrics1 = {
        ...createMockMetrics('test-run-1'),
        startTime: new Date('2024-03-13T10:00:00Z'),
        endTime: new Date('2024-03-13T10:05:00Z'),
      }
      const metrics2 = {
        ...createMockMetrics('test-run-2'),
        startTime: new Date('2024-03-14T10:00:00Z'),
        endTime: new Date('2024-03-14T10:05:00Z'),
      }
      const metrics3 = {
        ...createMockMetrics('test-run-3'),
        startTime: new Date('2024-03-15T10:00:00Z'),
        endTime: new Date('2024-03-15T10:05:00Z'),
      }

      const results = await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(MetricsWriter)
          yield* _(writer.writeMetrics(metrics1))
          yield* _(writer.writeMetrics(metrics2))
          yield* _(writer.writeMetrics(metrics3))
          return yield* _(
            writer.readMetrics({
              startDate: new Date('2024-03-14T00:00:00Z'),
              endDate: new Date('2024-03-14T23:59:59Z'),
            }),
          )
        }).pipe(Effect.provide(MetricsWriterTest)),
      )

      expect(results).toHaveLength(1)
      expect(results[0].runId).toBe('test-run-2')
    })

    it('should limit results', async () => {
      const metricsArray = Array.from({ length: 5 }, (_, i) => createMockMetrics(`test-run-${i}`))

      const results = await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(MetricsWriter)
          for (const m of metricsArray) {
            yield* _(writer.writeMetrics(m))
          }
          return yield* _(writer.readMetrics({ limit: 3 }))
        }).pipe(Effect.provide(MetricsWriterTest)),
      )

      expect(results).toHaveLength(3)
    })

    it('should return empty array when no metrics exist', async () => {
      const results = await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(MetricsWriter)
          return yield* _(writer.readMetrics())
        }).pipe(Effect.provide(MetricsWriterTest)),
      )

      expect(results).toHaveLength(0)
    })
  })

  describe('getStorageType', () => {
    it('should return the storage type', async () => {
      const storageType = await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(MetricsWriter)
          return writer.getStorageType()
        }).pipe(Effect.provide(MetricsWriterTest)),
      )

      expect(storageType).toBe('json')
    })
  })
})
