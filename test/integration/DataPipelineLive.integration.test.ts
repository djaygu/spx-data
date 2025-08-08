import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as path from 'node:path'
import { Chunk, Config, Context, Effect, Fiber, Layer, Stream } from 'effect'
import type { AppConfig } from '../../src/config/AppConfig'
import { BulkGreeksProcessorLive } from '../../src/layers/BulkGreeksProcessorLive'
import { DataPipelineLive } from '../../src/layers/DataPipelineLive'
import { DataWriterCsvLive } from '../../src/layers/DataWriterCsvLive'
import { JsonMetricsWriterLive } from '../../src/layers/JsonMetricsWriter'
import { ThetaDataApiClientLive } from '../../src/layers/ThetaDataApiClientLive'
import { BulkGreeksProcessor } from '../../src/services/BulkGreeksProcessor'
import { DataPipeline, type PipelineConfig } from '../../src/services/DataPipeline'

// Use Bun's native file APIs which are faster than Node.js
const readdir = async (dir: string) => {
  const iter = new Bun.Glob('**/*').scan({ cwd: dir, onlyFiles: false })
  const files = []
  for await (const file of iter) {
    files.push(file)
  }
  return files
}
const stat = async (path: string) => {
  const file = Bun.file(path)
  const size = file.size
  return { size }
}
const rm = async (path: string, _options?: { recursive?: boolean; force?: boolean }) => {
  try {
    await Bun.$`rm -rf ${path}`.quiet()
  } catch {
    // Ignore errors if path doesn't exist
  }
}

const SHOULD_RUN_INTEGRATION_TESTS = process.env.THETA_DATA_TERMINAL_URL !== undefined

// Set environment variables for the test
if (SHOULD_RUN_INTEGRATION_TESTS) {
  process.env.CONFIG_THETADATA_BASE_URL =
    process.env.THETA_DATA_TERMINAL_URL || 'http://127.0.0.1:25510'
}

describe.skipIf(!SHOULD_RUN_INTEGRATION_TESTS)('DataPipeline Integration Tests', () => {
  const testOutputDir = './test-output-integration'
  const testMetricsDir = './test-metrics-integration'

  // Set environment variables for test directories
  process.env.DATA_OUTPUT_DIR = testOutputDir
  process.env.METRICS_OUTPUT_DIR = testMetricsDir

  // Clean up test directories before and after tests
  const cleanupTestDirs = async () => {
    try {
      await rm(testOutputDir, { recursive: true, force: true })
      await rm(testMetricsDir, { recursive: true, force: true })
    } catch {
      // Ignore errors if directories don't exist
    }
  }

  // Clean up before each test
  beforeEach(async () => {
    await cleanupTestDirs()
  })

  // Clean up after each test
  afterEach(async () => {
    await cleanupTestDirs()
  })

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

  // Set up the full layer composition
  // DataPipelineLive requires DataWriter and MetricsWriter
  // BulkGreeksProcessorLive requires ThetaDataApiClient and AppConfig
  // Build the layers from bottom up
  const IntegrationLayer = Layer.mergeAll(DataPipelineLive, BulkGreeksProcessorLive).pipe(
    Layer.provide(DataWriterCsvLive),
    Layer.provide(JsonMetricsWriterLive),
    Layer.provide(ThetaDataApiClientLive),
    Layer.provide(AppConfigLive),
  )

  it('should process real data end-to-end with streaming', async () => {
    const config: PipelineConfig = {
      outputDir: testOutputDir,
      chunkSize: 1000,
      compression: false,
      fileNamePattern: 'SPXW_{expiration}.csv',
    }

    // Process with real data
    await Effect.runPromise(
      Effect.gen(function* (_) {
        const processor = yield* _(BulkGreeksProcessor)
        const pipeline = yield* _(DataPipeline)

        // Stream data for a historical date with limited expirations
        const dataStream = processor.streamBulkGreeks({
          root: 'SPXW',
          tradeDate: '20240314',
          maxDTE: 1, // Only 0DTE and 1DTE to keep test fast
          concurrency: 2,
          interval: 3600000, // 1 hour intervals for faster fetching
          rth: true,
        })

        // Process the stream through the pipeline
        yield* _(pipeline.process(dataStream.pipe(Stream.orDie), config))

        // Verify output files were created
        const outputFiles = yield* _(Effect.tryPromise(() => readdir(testOutputDir)))
        expect(outputFiles.length).toBeGreaterThan(0)

        // Verify CSV files have correct structure
        for (const file of outputFiles) {
          if (file.endsWith('.csv')) {
            const filePath = path.join(testOutputDir, file)
            const fileStats = yield* _(Effect.tryPromise(() => stat(filePath)))
            expect(fileStats.size).toBeGreaterThan(0)

            // Read and verify CSV headers
            const content = yield* _(Effect.tryPromise(() => Bun.file(filePath).text()))
            const lines = content.split('\n')
            expect(lines.length).toBeGreaterThan(1) // At least headers + data

            // Check headers
            const headers = lines[0]
            expect(headers).toContain('strike')
            expect(headers).toContain('right')
            expect(headers).toContain('bid')
            expect(headers).toContain('ask')
            expect(headers).toContain('delta')
            expect(headers).toContain('theta')
            expect(headers).toContain('vega')
            expect(headers).toContain('rho')
            expect(headers).toContain('epsilon')
            expect(headers).toContain('lambda')
            expect(headers).toContain('implied_volatility')
            expect(headers).toContain('iv_error')
            expect(headers).toContain('underlying_price')
            expect(headers).toContain('timestamp')
          }
        }

        // Verify metrics were written
        const metricsFiles = yield* _(Effect.tryPromise(() => readdir(testMetricsDir)))
        expect(metricsFiles.length).toBeGreaterThan(0)

        // Read and verify metrics
        const metricsFile = metricsFiles.find((f) => f.startsWith('pipeline-run-'))
        expect(metricsFile).toBeDefined()

        if (metricsFile) {
          const metricsPath = path.join(testMetricsDir, metricsFile)
          const metricsContent = yield* _(Effect.tryPromise(() => Bun.file(metricsPath).text()))
          const metrics = JSON.parse(metricsContent)

          expect(metrics.runId).toBeDefined()
          expect(metrics.totalExpirations).toBeGreaterThan(0)
          expect(metrics.totalRecords).toBeGreaterThan(0)
          expect(metrics.filesCreated.length).toBeGreaterThan(0)
          expect(metrics.outputFormat).toBe('csv')
        }
      }).pipe(Effect.provide(IntegrationLayer)),
    )
  }, 60000) // 60 second timeout for integration test

  it('should handle partial failures gracefully', async () => {
    const config: PipelineConfig = {
      outputDir: testOutputDir,
      chunkSize: 500,
      compression: false,
      fileNamePattern: 'SPXW_{expiration}.csv',
    }

    await Effect.runPromise(
      Effect.gen(function* (_) {
        const processor = yield* _(BulkGreeksProcessor)
        const pipeline = yield* _(DataPipeline)

        // Create a mixed stream with some failures
        const resultsChunk = yield* _(
          processor
            .streamBulkGreeks({
              root: 'SPXW',
              tradeDate: '20240314',
              maxDTE: 2,
              concurrency: 1,
              interval: 3600000,
              rth: true,
            })
            .pipe(
              Stream.take(3), // Take only first 3 results
              Stream.runCollect,
            ),
        )

        const results = Chunk.toReadonlyArray(resultsChunk)

        // Inject a failure
        const mixedResults = Stream.fromIterable([
          results[0],
          {
            expiration: '20240399', // Invalid date
            success: false,
            error: new Error('Test failure'),
            recordCount: 0,
            processingTimeMs: 100,
          },
          ...(results.slice(1) || []),
        ])

        // Process should continue despite failure
        yield* _(pipeline.process(mixedResults, config))

        // Verify some files were created
        const outputFiles = yield* _(Effect.tryPromise(() => readdir(testOutputDir)))
        expect(outputFiles.length).toBeGreaterThan(0)

        // Verify metrics include error information
        const metricsFiles = yield* _(Effect.tryPromise(() => readdir(testMetricsDir)))
        const metricsFile = metricsFiles.find((f) => f.startsWith('pipeline-run-'))

        if (metricsFile) {
          const metricsPath = path.join(testMetricsDir, metricsFile)
          const metricsContent = yield* _(Effect.tryPromise(() => Bun.file(metricsPath).text()))
          const metrics = JSON.parse(metricsContent)

          expect(metrics.failedExpirations).toBeGreaterThan(0)
          expect(metrics.errors.length).toBeGreaterThan(0)
          expect(metrics.successfulExpirations).toBeGreaterThan(0) // Some should still succeed
        }
      }).pipe(Effect.provide(IntegrationLayer)),
    )
  }, 60000)

  it('should track progress accurately during processing', async () => {
    const config: PipelineConfig = {
      outputDir: testOutputDir,
      chunkSize: 500,
      compression: false,
      fileNamePattern: 'SPXW_{expiration}.csv',
    }

    const progressSnapshots: Array<{
      processedExpirations: number
      totalRecords: number
      memoryUsageMB: number
    }> = []

    await Effect.runPromise(
      Effect.gen(function* (_) {
        const processor = yield* _(BulkGreeksProcessor)
        const pipeline = yield* _(DataPipeline)

        const dataStream = processor.streamBulkGreeks({
          root: 'SPXW',
          tradeDate: '20240314',
          maxDTE: 0, // Just 0DTE for quick test
          concurrency: 1,
          interval: 3600000,
          rth: true,
        })

        // Start processing in background
        const fiber = yield* _(
          pipeline.process(dataStream.pipe(Stream.orDie), config).pipe(Effect.fork),
        )

        // Capture progress updates
        for (let i = 0; i < 10; i++) {
          yield* _(Effect.sleep(100))
          const progress = yield* _(pipeline.getProgress())
          if (progress) {
            progressSnapshots.push({
              processedExpirations: progress.processedExpirations,
              totalRecords: progress.totalRecords,
              memoryUsageMB: progress.memoryUsageMB,
            })
          }
        }

        // Wait for completion
        yield* _(Fiber.join(fiber))

        // Final progress should be undefined
        const finalProgress = yield* _(pipeline.getProgress())
        expect(finalProgress).toBeUndefined()
      }).pipe(Effect.provide(IntegrationLayer)),
    )

    // Should have captured progress
    expect(progressSnapshots.length).toBeGreaterThan(0)

    // Progress should increase over time
    if (progressSnapshots.length > 1) {
      const firstSnapshot = progressSnapshots[0]
      const lastSnapshot = progressSnapshots[progressSnapshots.length - 1]
      expect(lastSnapshot.totalRecords).toBeGreaterThanOrEqual(firstSnapshot.totalRecords)
    }
  }, 60000)
})
