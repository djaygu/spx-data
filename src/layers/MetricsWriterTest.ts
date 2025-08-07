import { Effect, Layer, Ref } from 'effect'
import {
  MetricsWriter,
  MetricsWriterError,
  type PipelineRunMetrics,
} from '../services/MetricsWriter'

interface TestMetricsState {
  metrics: PipelineRunMetrics[]
  shouldFail: boolean
  failureMessage?: string
}

export const MetricsWriterTest = Layer.effect(
  MetricsWriter,
  Effect.gen(function* (_) {
    const stateRef = yield* _(
      Ref.make<TestMetricsState>({
        metrics: [],
        shouldFail: false,
      }),
    )

    return MetricsWriter.of({
      writeMetrics: (metrics) =>
        Effect.gen(function* (_) {
          const state = yield* _(Ref.get(stateRef))

          if (state.shouldFail) {
            return yield* _(
              Effect.fail(
                new MetricsWriterError({
                  message: state.failureMessage || 'Test write failure',
                }),
              ),
            )
          }

          // Store metrics in memory
          yield* _(
            Ref.update(stateRef, (s) => ({
              ...s,
              metrics: [...s.metrics, metrics],
            })),
          )
        }),

      readMetrics: (query) =>
        Effect.gen(function* (_) {
          const state = yield* _(Ref.get(stateRef))

          if (state.shouldFail) {
            return yield* _(
              Effect.fail(
                new MetricsWriterError({
                  message: 'Test read failure',
                }),
              ),
            )
          }

          let filteredMetrics = [...state.metrics]

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

      getStorageType: () => 'json' as const,
    })
  }),
)

// Helper to configure test metrics writer behavior
export const configureTestMetricsWriter = (config: {
  shouldFail?: boolean
  failureMessage?: string
  initialMetrics?: PipelineRunMetrics[]
}) =>
  Layer.effect(
    MetricsWriter,
    Effect.gen(function* (_) {
      const stateRef = yield* _(
        Ref.make<TestMetricsState>({
          metrics: config.initialMetrics || [],
          shouldFail: config.shouldFail || false,
          failureMessage: config.failureMessage,
        }),
      )

      return MetricsWriter.of({
        writeMetrics: (metrics) =>
          Effect.gen(function* (_) {
            const state = yield* _(Ref.get(stateRef))

            if (state.shouldFail) {
              return yield* _(
                Effect.fail(
                  new MetricsWriterError({
                    message: state.failureMessage || 'Test write failure',
                  }),
                ),
              )
            }

            yield* _(
              Ref.update(stateRef, (s) => ({
                ...s,
                metrics: [...s.metrics, metrics],
              })),
            )
          }),

        readMetrics: (query) =>
          Effect.gen(function* (_) {
            const state = yield* _(Ref.get(stateRef))

            if (state.shouldFail) {
              return yield* _(
                Effect.fail(
                  new MetricsWriterError({
                    message: 'Test read failure',
                  }),
                ),
              )
            }

            let filteredMetrics = [...state.metrics]

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

        getStorageType: () => 'json' as const,
      })
    }),
  )
