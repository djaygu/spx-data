import * as path from 'node:path'
import { Effect, Layer } from 'effect'
import {
  MetricsWriter,
  MetricsWriterError,
  type PipelineRunMetrics,
} from '../services/MetricsWriter'

export const JsonMetricsWriterLive = Layer.effect(
  MetricsWriter,
  Effect.gen(function* (_) {
    const metricsDir = process.env.METRICS_OUTPUT_DIR || './data/metrics'

    const ensureDirectoryExists = (dirPath: string) =>
      Effect.tryPromise({
        try: async () => {
          await Bun.$`mkdir -p ${dirPath}`.quiet()
        },
        catch: (error) =>
          new MetricsWriterError({
            message: `Failed to create metrics directory: ${dirPath}`,
            cause: error,
          }),
      })

    const generateFileName = (metrics: PipelineRunMetrics): string => {
      const timestamp = metrics.startTime.toISOString().replace(/[:.]/g, '-')
      return `pipeline-run-${timestamp}.json`
    }

    return MetricsWriter.of({
      writeMetrics: (metrics) =>
        Effect.gen(function* (_) {
          // Ensure metrics directory exists
          yield* _(ensureDirectoryExists(metricsDir))

          // Generate filename based on timestamp
          const fileName = generateFileName(metrics)
          const filePath = path.join(metricsDir, fileName)

          // Write metrics to JSON file
          const jsonContent = JSON.stringify(metrics, null, 2)

          yield* _(
            Effect.tryPromise({
              try: async () => {
                await Bun.write(filePath, jsonContent)
              },
              catch: (error) =>
                new MetricsWriterError({
                  message: `Failed to write metrics to ${filePath}`,
                  cause: error,
                }),
            }),
          )
        }),

      readMetrics: (query) =>
        Effect.gen(function* (_) {
          // Ensure metrics directory exists
          yield* _(ensureDirectoryExists(metricsDir))

          // List all metrics files using Bun's Glob API
          const files = yield* _(
            Effect.tryPromise({
              try: async () => {
                const glob = new Bun.Glob('pipeline-run-*.json')
                const iter = glob.scan({ cwd: metricsDir })
                const fileList = []
                for await (const file of iter) {
                  fileList.push(file)
                }
                return fileList
              },
              catch: (error) =>
                new MetricsWriterError({
                  message: `Failed to read metrics directory`,
                  cause: error,
                }),
            }),
          )

          // Files are already filtered by glob pattern
          const jsonFiles = files.sort((a, b) => b.localeCompare(a)) // Sort by newest first

          // Read and parse metrics files
          const allMetrics: PipelineRunMetrics[] = []

          for (const file of jsonFiles) {
            const filePath = path.join(metricsDir, file)

            try {
              const content = yield* _(
                Effect.tryPromise({
                  try: async () => {
                    const bunFile = Bun.file(filePath)
                    return await bunFile.text()
                  },
                  catch: (error) =>
                    new MetricsWriterError({
                      message: `Failed to read metrics file ${file}`,
                      cause: error,
                    }),
                }),
              )

              const parsed = JSON.parse(content) as Record<string, unknown>

              // Convert date strings back to Date objects
              const metrics: PipelineRunMetrics = {
                ...parsed,
                startTime: new Date(parsed.startTime as string),
                endTime: new Date(parsed.endTime as string),
              } as PipelineRunMetrics

              allMetrics.push(metrics)
            } catch {}
          }

          // Apply query filters
          let filteredMetrics = allMetrics

          if (query) {
            if (query.runId) {
              filteredMetrics = filteredMetrics.filter((m) => m.runId === query.runId)
            }

            if (query.startDate) {
              filteredMetrics = filteredMetrics.filter((m) => m.startTime >= query.startDate!)
            }

            if (query.endDate) {
              filteredMetrics = filteredMetrics.filter((m) => m.endTime <= query.endDate!)
            }

            if (query.limit) {
              filteredMetrics = filteredMetrics.slice(0, query.limit)
            }
          }

          return filteredMetrics
        }),

      getStorageType: () => 'json',
    })
  }),
)
