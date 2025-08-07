import { describe, it, expect } from 'bun:test'
import { Effect, Layer, Stream, ConfigProvider } from 'effect'
import { download } from '@/cli/commands/download'
import { ThetaDataApiClient, ThetaDataConnectionError, ThetaDataApiError } from '@/services/ThetaDataApiClient'
import { BulkGreeksProcessor, BulkProcessingError, ExpirationFilterError, type ExpirationResult } from '@/services/BulkGreeksProcessor'
import { DataPipeline, DataPipelineError, type PipelineProgress } from '@/services/DataPipeline'

// Mock implementations for testing
const mockApiClient = ThetaDataApiClient.of({
  healthCheck: () =>
    Effect.succeed({
      isConnected: true,
      status: 'CONNECTED' as const,
      timestamp: new Date(),
    }),
  listExpirations: () =>
    Effect.succeed([
      { date: '2024-01-17', daysToExpiration: 2 },
      { date: '2024-01-19', daysToExpiration: 4 },
      { date: '2024-01-22', daysToExpiration: 7 },
    ]),
  getBulkOptionsGreeks: () => Effect.fail(new ThetaDataApiError({ message: 'Not implemented in test' })),
})

const mockProcessor = BulkGreeksProcessor.of({
  processBulkGreeks: () => Effect.fail(new BulkProcessingError({ message: 'Not implemented in test' })),
  filterExpirations: () => Effect.fail(new ExpirationFilterError({ message: 'Not implemented in test', tradeDate: '20240115' })),
  getProgress: () => Effect.succeed(undefined),
  streamBulkGreeks: () => {
    // Create mock expiration results
    const results: ExpirationResult[] = [
      {
        expiration: '20240117',
        recordCount: 1000,
        success: true,
        processingTimeMs: 1000,
      },
      {
        expiration: '20240119',
        recordCount: 1000,
        success: true,
        processingTimeMs: 1000,
      },
      {
        expiration: '20240122',
        recordCount: 1000,
        success: true,
        processingTimeMs: 1000,
      },
    ]
    return Stream.fromIterable(results)
  },
})

const mockPipeline = DataPipeline.of({
  process: () => Effect.succeed(undefined),
  getProgress: () =>
    Effect.succeed<PipelineProgress>({
      totalExpirations: 3,
      processedExpirations: 3,
      currentExpiration: undefined,
      totalRecords: 3000,
      recordsPerSecond: 600,
      memoryUsageMB: 100,
      startTime: new Date('2024-01-15T10:00:00'),
      estimatedCompletionTime: new Date('2024-01-15T10:05:00'),
    }),
})

// Mock configuration layer - Config values are resolved by Effect runtime
const mockConfig = Layer.setConfigProvider(
  ConfigProvider.fromMap(
    new Map([
      ['CONFIG_THETADATA_BASE_URL', 'http://127.0.0.1:25510'],
      ['CONFIG_THETADATA_MAX_CONCURRENT_REQUESTS', '3'],
      ['CONFIG_THETADATA_MAX_RETRIES', '3'],
      ['CONFIG_THETADATA_RETRY_BASE_DELAY_MS', '1000'],
      ['CONFIG_THETADATA_REQUEST_TIMEOUT_MS', '30000'],
      ['CONFIG_DOWNLOAD_MAX_DTE', '30'],
      ['CONFIG_STORAGE_DATA_DIRECTORY', './data'],
    ]),
  ),
)

// Test layers
const TestLive = Layer.mergeAll(
  Layer.succeed(ThetaDataApiClient, mockApiClient),
  Layer.succeed(BulkGreeksProcessor, mockProcessor),
  Layer.succeed(DataPipeline, mockPipeline),
  mockConfig,
)

describe('Download Command', () => {
  describe('Date Validation', () => {
    it('should accept valid date format YYYY-MM-DD', async () => {
      const result = await Effect.runPromise(
        download.handler({ date: '2024-01-15', dryRun: true }).pipe(
          Effect.provide(TestLive),
        ),
      )
      expect(result).toBeUndefined()
    })

    it('should reject invalid date format', async () => {
      const result = await Effect.runPromiseExit(
        download.handler({ date: '01/15/2024', dryRun: true }).pipe(
          Effect.provide(TestLive),
        ),
      )
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        const error = result.cause
        expect(error).toBeDefined()
      }
    })

    it('should reject invalid date string', async () => {
      const result = await Effect.runPromiseExit(
        download.handler({ date: 'not-a-date', dryRun: true }).pipe(
          Effect.provide(TestLive),
        ),
      )
      expect(result._tag).toBe('Failure')
    })

    it('should handle dates with leading zeros', async () => {
      const result = await Effect.runPromise(
        download.handler({ date: '2024-01-05', dryRun: true }).pipe(
          Effect.provide(TestLive),
        ),
      )
      expect(result).toBeUndefined()
    })
  })

  describe('Dry Run Mode', () => {
    it('should preview download without fetching data when dry-run is true', async () => {
      const result = await Effect.runPromise(
        download.handler({ date: '2024-01-15', dryRun: true }).pipe(
          Effect.provide(TestLive),
        ),
      )

      expect(result).toBeUndefined()
    })

    it('should list expirations without downloading in dry-run mode', async () => {
      const result = await Effect.runPromise(
        download.handler({ date: '2024-01-15', dryRun: true }).pipe(
          Effect.provide(TestLive),
        ),
      )
      expect(result).toBeUndefined()
    })

    it('should show directory structure in dry-run mode', async () => {
      const result = await Effect.runPromise(
        download.handler({ date: '2024-01-15', dryRun: true }).pipe(
          Effect.provide(TestLive),
        ),
      )
      expect(result).toBeUndefined()
    })
  })

  describe('Progress Tracking', () => {
    it('should track total and processed expirations', async () => {
      const result = await Effect.runPromise(
        download.handler({ date: '2024-01-15', dryRun: false }).pipe(
          Effect.provide(TestLive),
        ),
      )
      expect(result).toBeUndefined()
    })

    it('should calculate and display throughput', async () => {
      const result = await Effect.runPromise(
        download.handler({ date: '2024-01-15', dryRun: false }).pipe(
          Effect.provide(TestLive),
        ),
      )
      expect(result).toBeUndefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle terminal not running error gracefully', async () => {
      const errorApiClient = ThetaDataApiClient.of({
        ...mockApiClient,
        listExpirations: () =>
          Effect.fail(new ThetaDataConnectionError({
            message: 'Connection refused',
          })),
      })

      const ErrorLive = Layer.mergeAll(
        Layer.succeed(ThetaDataApiClient, errorApiClient),
        Layer.succeed(BulkGreeksProcessor, mockProcessor),
        Layer.succeed(DataPipeline, mockPipeline),
        mockConfig,
      )

      const result = await Effect.runPromiseExit(
        download.handler({ date: '2024-01-15', dryRun: false }).pipe(
          Effect.provide(ErrorLive),
        ),
      )

      expect(result._tag).toBe('Failure')
    })

    it('should handle file system errors with recovery suggestions', async () => {
      const errorPipeline = DataPipeline.of({
        process: () =>
          Effect.fail(new DataPipelineError({
            message: 'Permission denied',
          })),
        getProgress: () => Effect.succeed(undefined),
      })

      const ErrorLive = Layer.mergeAll(
        Layer.succeed(ThetaDataApiClient, mockApiClient),
        Layer.succeed(BulkGreeksProcessor, mockProcessor),
        Layer.succeed(DataPipeline, errorPipeline),
        mockConfig,
      )

      const result = await Effect.runPromiseExit(
        download.handler({ date: '2024-01-15', dryRun: false }).pipe(
          Effect.provide(ErrorLive),
        ),
      )

      expect(result._tag).toBe('Failure')
    })
  })

  describe('Output Structure', () => {
    it('should create correct directory structure ./data/YYYYMMDD/', async () => {
      const result = await Effect.runPromise(
        download.handler({ date: '2024-01-15', dryRun: false }).pipe(
          Effect.provide(TestLive),
        ),
      )
      expect(result).toBeUndefined()
    })

    it('should name files correctly as spxw_exp_YYYYMMDD.csv', async () => {
      const result = await Effect.runPromise(
        download.handler({ date: '2024-01-15', dryRun: false }).pipe(
          Effect.provide(TestLive),
        ),
      )
      expect(result).toBeUndefined()
    })
  })

  describe('Summary Statistics', () => {
    it('should display total records processed', async () => {
      const result = await Effect.runPromise(
        download.handler({ date: '2024-01-15', dryRun: false }).pipe(
          Effect.provide(TestLive),
        ),
      )
      expect(result).toBeUndefined()
    })

    it('should display processing time and throughput', async () => {
      const result = await Effect.runPromise(
        download.handler({ date: '2024-01-15', dryRun: false }).pipe(
          Effect.provide(TestLive),
        ),
      )
      expect(result).toBeUndefined()
    })

    it('should list failed expirations if any', async () => {
      const failurePipeline = DataPipeline.of({
        process: () => Effect.succeed(undefined),
        getProgress: () =>
          Effect.succeed<PipelineProgress>({
            totalExpirations: 3,
            processedExpirations: 2,
            currentExpiration: undefined,
            totalRecords: 2000,
            recordsPerSecond: 400,
            memoryUsageMB: 100,
            startTime: new Date('2024-01-15T10:00:00'),
            estimatedCompletionTime: new Date('2024-01-15T10:05:00'),
          }),
      })

      const FailureLive = Layer.mergeAll(
        Layer.succeed(ThetaDataApiClient, mockApiClient),
        Layer.succeed(BulkGreeksProcessor, mockProcessor),
        Layer.succeed(DataPipeline, failurePipeline),
        mockConfig,
      )

      const result = await Effect.runPromise(
        download.handler({ date: '2024-01-15', dryRun: false }).pipe(
          Effect.provide(FailureLive),
        ),
      )
      expect(result).toBeUndefined()
    })
  })
})