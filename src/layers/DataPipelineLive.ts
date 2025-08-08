import * as crypto from 'node:crypto'
import { Effect, Layer, Ref, Stream } from 'effect'
import { DataPipeline, DataPipelineError, type PipelineProgress } from '../services/DataPipeline'
import { DataWriter, type WriteMetadata } from '../services/DataWriter'
import { MetricsWriter, type PipelineRunMetrics } from '../services/MetricsWriter'

export const DataPipelineLive = Layer.effect(
  DataPipeline,
  Effect.gen(function* (_) {
    const writer = yield* _(DataWriter)
    const metricsWriter = yield* _(MetricsWriter)

    // State for tracking progress
    const progressRef = yield* _(Ref.make<PipelineProgress | undefined>(undefined))

    return DataPipeline.of({
      process: (dataStream, config) =>
        Effect.gen(function* (_) {
          const runId = crypto.randomUUID()
          const startTime = new Date()

          // Initialize metrics
          const metricsRef = yield* _(
            Ref.make<{
              totalExpirations: number
              processedExpirations: number
              successfulExpirations: number
              failedExpirations: number
              totalRecords: number
              totalDataSize: number
              peakMemoryUsage: number
              memoryReadings: number[]
              throughputReadings: number[]
              errors: Array<{ expiration: string; errorType: string; message: string }>
              filesCreated: string[]
            }>({
              totalExpirations: 0,
              processedExpirations: 0,
              successfulExpirations: 0,
              failedExpirations: 0,
              totalRecords: 0,
              totalDataSize: 0,
              peakMemoryUsage: 0,
              memoryReadings: [],
              throughputReadings: [],
              errors: [],
              filesCreated: [],
            }),
          )

          // Initialize progress
          yield* _(
            Ref.set(progressRef, {
              totalExpirations: 0,
              processedExpirations: 0,
              currentExpiration: undefined,
              totalRecords: 0,
              recordsPerSecond: 0,
              memoryUsageMB: 0,
              startTime,
              estimatedCompletionTime: undefined,
            }),
          )

          // Track processing start for throughput calculation
          let lastRecordTime = Date.now()
          let _lastRecordCount = 0

          // Helper to update memory metrics
          const updateMemoryMetrics = Effect.gen(function* (_) {
            const memUsage = process.memoryUsage()
            const memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024)

            yield* _(
              Ref.update(metricsRef, (m) => ({
                ...m,
                peakMemoryUsage: Math.max(m.peakMemoryUsage, memoryMB),
                memoryReadings: [...m.memoryReadings, memoryMB],
              })),
            )

            yield* _(Ref.update(progressRef, (p) => (p ? { ...p, memoryUsageMB: memoryMB } : p)))
          })

          // Process the stream
          yield* _(
            dataStream.pipe(
              // Count total expirations
              Stream.tap(() =>
                Ref.update(metricsRef, (m) => ({
                  ...m,
                  totalExpirations: m.totalExpirations + 1,
                })),
              ),
              // Process each expiration result
              Stream.tap((result) =>
                Effect.gen(function* (_) {
                  // Update current expiration in progress
                  yield* _(
                    Ref.update(progressRef, (p) =>
                      p
                        ? {
                            ...p,
                            currentExpiration: result.expiration,
                            totalExpirations: p.totalExpirations + 1,
                          }
                        : p,
                    ),
                  )

                  if (result.success && result.data) {
                    // Process successful expiration data in chunks
                    const chunks = []
                    for (let i = 0; i < result.data.length; i += config.chunkSize) {
                      chunks.push(result.data.slice(i, i + config.chunkSize))
                    }

                    // Write each chunk
                    for (let i = 0; i < chunks.length; i++) {
                      const chunk = chunks[i]
                      const metadata: WriteMetadata = {
                        expiration: result.expiration,
                        outputDir: config.outputDir,
                        isFirstChunk: i === 0,
                        isLastChunk: i === chunks.length - 1,
                        chunkIndex: i,
                        totalRecords: result.data.length,
                      }

                      yield* _(
                        writer.writeChunk(chunk, metadata).pipe(
                          Effect.catchAll((error) =>
                            Effect.gen(function* (_) {
                              // Record error but continue processing
                              yield* _(
                                Ref.update(metricsRef, (m) => ({
                                  ...m,
                                  errors: [
                                    ...m.errors,
                                    {
                                      expiration: result.expiration,
                                      errorType: 'WriteError',
                                      message: error.message,
                                    },
                                  ],
                                })),
                              )

                              return Effect.succeed(undefined)
                            }),
                          ),
                        ),
                      )

                      // Update metrics after each chunk
                      yield* _(
                        Ref.update(metricsRef, (m) => ({
                          ...m,
                          totalRecords: m.totalRecords + chunk.length,
                          totalDataSize: m.totalDataSize + chunk.length * 100, // Estimate 100 bytes per record
                        })),
                      )

                      // Calculate throughput
                      const now = Date.now()
                      const timeDelta = (now - lastRecordTime) / 1000 // seconds
                      const recordDelta = chunk.length

                      if (timeDelta > 0) {
                        const throughput = recordDelta / timeDelta

                        yield* _(
                          Ref.update(metricsRef, (m) => ({
                            ...m,
                            throughputReadings: [...m.throughputReadings, throughput],
                          })),
                        )

                        yield* _(
                          Ref.update(progressRef, (p) =>
                            p
                              ? {
                                  ...p,
                                  totalRecords: p.totalRecords + chunk.length,
                                  recordsPerSecond: throughput,
                                }
                              : p,
                          ),
                        )

                        lastRecordTime = now
                        _lastRecordCount += recordDelta
                      }
                    }

                    // Update successful expiration count
                    yield* _(
                      Ref.update(metricsRef, (m) => ({
                        ...m,
                        successfulExpirations: m.successfulExpirations + 1,
                      })),
                    )
                  } else {
                    // Handle failed expiration
                    yield* _(
                      Ref.update(metricsRef, (m) => ({
                        ...m,
                        failedExpirations: m.failedExpirations + 1,
                        errors: [
                          ...m.errors,
                          {
                            expiration: result.expiration,
                            errorType: 'FetchError',
                            message: result.error?.message || 'Unknown error',
                          },
                        ],
                      })),
                    )
                  }

                  // Update processed count
                  yield* _(
                    Ref.update(metricsRef, (m) => ({
                      ...m,
                      processedExpirations: m.processedExpirations + 1,
                    })),
                  )

                  yield* _(
                    Ref.update(progressRef, (p) =>
                      p
                        ? {
                            ...p,
                            processedExpirations: p.processedExpirations + 1,
                          }
                        : p,
                    ),
                  )

                  // Update memory metrics periodically
                  yield* _(updateMemoryMetrics)

                  // Estimate completion time
                  const metrics = yield* _(Ref.get(metricsRef))
                  const progress = yield* _(Ref.get(progressRef))

                  if (progress && metrics.processedExpirations > 0) {
                    const elapsedMs = Date.now() - startTime.getTime()
                    const avgTimePerExpiration = elapsedMs / metrics.processedExpirations
                    const remainingExpirations =
                      metrics.totalExpirations - metrics.processedExpirations
                    const estimatedRemainingMs = remainingExpirations * avgTimePerExpiration
                    const estimatedCompletionTime = new Date(Date.now() + estimatedRemainingMs)

                    yield* _(
                      Ref.update(progressRef, (p) => (p ? { ...p, estimatedCompletionTime } : p)),
                    )
                  }
                }),
              ),
              Stream.runDrain,
              Effect.catchAll((error) =>
                Effect.fail(
                  new DataPipelineError({
                    message: `Pipeline processing failed: ${error}`,
                    cause: error,
                  }),
                ),
              ),
            ),
          )

          // Finalize writer
          const writeResult = yield* _(
            writer.finalize().pipe(
              Effect.catchAll((error) =>
                Effect.fail(
                  new DataPipelineError({
                    message: `Failed to finalize writer: ${error.message}`,
                    cause: error,
                  }),
                ),
              ),
            ),
          )

          // Prepare final metrics
          const endTime = new Date()
          const finalMetrics = yield* _(Ref.get(metricsRef))

          const pipelineMetrics: PipelineRunMetrics = {
            runId,
            startTime,
            endTime,
            totalDuration: (endTime.getTime() - startTime.getTime()) / 1000,
            totalExpirations: finalMetrics.totalExpirations,
            successfulExpirations: finalMetrics.successfulExpirations,
            failedExpirations: finalMetrics.failedExpirations,
            totalRecords: finalMetrics.totalRecords,
            totalDataSize: finalMetrics.totalDataSize,
            averageThroughput:
              finalMetrics.throughputReadings.length > 0
                ? finalMetrics.throughputReadings.reduce((a, b) => a + b, 0) /
                  finalMetrics.throughputReadings.length
                : 0,
            peakThroughput:
              finalMetrics.throughputReadings.length > 0
                ? Math.max(...finalMetrics.throughputReadings)
                : 0,
            averageExpirationTime:
              finalMetrics.processedExpirations > 0
                ? (endTime.getTime() - startTime.getTime()) /
                  1000 /
                  finalMetrics.processedExpirations
                : 0,
            peakMemoryUsage: finalMetrics.peakMemoryUsage,
            averageMemoryUsage:
              finalMetrics.memoryReadings.length > 0
                ? finalMetrics.memoryReadings.reduce((a, b) => a + b, 0) /
                  finalMetrics.memoryReadings.length
                : 0,
            filesCreated: writeResult.filesCreated,
            outputFormat: writer.getFormat(),
            compressionUsed: config.compression,
            errors: finalMetrics.errors,
          }

          // Persist metrics
          yield* _(
            metricsWriter.writeMetrics(pipelineMetrics).pipe(
              Effect.catchAll((error) =>
                Effect.gen(function* (_) {
                  // Log error but don't fail the pipeline
                  yield* _(Effect.log(`Failed to write metrics: ${error.message}`))
                  return Effect.succeed(undefined)
                }),
              ),
            ),
          )

          // Clear progress
          yield* _(Ref.set(progressRef, undefined))

          // Log summary
          yield* _(
            Effect.log(
              `Pipeline completed: ${pipelineMetrics.successfulExpirations}/${pipelineMetrics.totalExpirations} expirations, ` +
                `${pipelineMetrics.totalRecords} records, ${pipelineMetrics.totalDuration.toFixed(
                  2,
                )}s, ` +
                `avg throughput: ${pipelineMetrics.averageThroughput.toFixed(0)} records/sec`,
            ),
          )
        }),

      getProgress: () => Ref.get(progressRef),
    })
  }),
)
