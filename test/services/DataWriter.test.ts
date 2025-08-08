import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { DataWriterTest } from '../../src/layers/DataWriterTest'
import { DataWriter, type WriteMetadata } from '../../src/services/DataWriter'
import type { OptionsGreeksData } from '../../src/services/ThetaDataApiClient'

describe('DataWriter', () => {
  const createMockData = (count: number): OptionsGreeksData[] => {
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

  describe('writeChunk', () => {
    it('should write data chunks successfully', async () => {
      const data = createMockData(100)
      const metadata: WriteMetadata = {
        expiration: '20240314',
        outputDir: './test-data/20240314',
        isFirstChunk: true,
        isLastChunk: false,
        chunkIndex: 0,
        totalRecords: 100,
      }

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(DataWriter)
          yield* _(writer.writeChunk(data, metadata))
        }).pipe(Effect.provide(DataWriterTest)),
      )

      // Test passes if no error thrown
      expect(true).toBe(true)
    })

    it('should handle multiple chunks for same expiration', async () => {
      const chunk1 = createMockData(50)
      const chunk2 = createMockData(50)

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(DataWriter)

          // Write first chunk
          yield* _(
            writer.writeChunk(chunk1, {
              expiration: '20240314',
              outputDir: './test-data/20240314',
              isFirstChunk: true,
              isLastChunk: false,
              chunkIndex: 0,
              totalRecords: 100,
            }),
          )

          // Write second chunk
          yield* _(
            writer.writeChunk(chunk2, {
              expiration: '20240314',
              outputDir: './test-data/20240314',
              isFirstChunk: false,
              isLastChunk: true,
              chunkIndex: 1,
              totalRecords: 100,
            }),
          )
        }).pipe(Effect.provide(DataWriterTest)),
      )

      expect(true).toBe(true)
    })

    it('should handle multiple expirations', async () => {
      const data1 = createMockData(50)
      const data2 = createMockData(50)

      await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(DataWriter)

          // Write first expiration
          yield* _(
            writer.writeChunk(data1, {
              expiration: '20240314',
              outputDir: './test-data/20240314',
              isFirstChunk: true,
              isLastChunk: true,
              chunkIndex: 0,
              totalRecords: 50,
            }),
          )

          // Write second expiration
          yield* _(
            writer.writeChunk(data2, {
              expiration: '20240315',
              outputDir: './test-data/20240314',
              isFirstChunk: true,
              isLastChunk: true,
              chunkIndex: 0,
              totalRecords: 50,
            }),
          )
        }).pipe(Effect.provide(DataWriterTest)),
      )

      expect(true).toBe(true)
    })
  })

  describe('finalize', () => {
    it('should return write results after finalization', async () => {
      const data = createMockData(100)

      const result = await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(DataWriter)

          yield* _(
            writer.writeChunk(data, {
              expiration: '20240314',
              outputDir: './test-data/20240314',
              isFirstChunk: true,
              isLastChunk: true,
              chunkIndex: 0,
              totalRecords: 100,
            }),
          )

          return yield* _(writer.finalize())
        }).pipe(Effect.provide(DataWriterTest)),
      )

      expect(result.format).toBe('test-csv')
      expect(result.totalRecordsWritten).toBe(100)
      expect(result.totalBytesWritten).toBe(10000) // 100 records * 100 bytes
      expect(result.filesCreated).toHaveLength(1)
      expect(result.filesCreated[0]).toContain('spxw_exp_20240314')
    })

    it('should handle finalization with no data written', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(DataWriter)
          return yield* _(writer.finalize())
        }).pipe(Effect.provide(DataWriterTest)),
      )

      expect(result.totalRecordsWritten).toBe(0)
      expect(result.totalBytesWritten).toBe(0)
      expect(result.filesCreated).toHaveLength(0)
    })
  })

  describe('getFormat', () => {
    it('should return the writer format', async () => {
      const format = await Effect.runPromise(
        Effect.gen(function* (_) {
          const writer = yield* _(DataWriter)
          return writer.getFormat()
        }).pipe(Effect.provide(DataWriterTest)),
      )

      expect(format).toBe('test-csv')
    })
  })
})
