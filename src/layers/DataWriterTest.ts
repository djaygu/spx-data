import { Effect, Layer, Ref } from 'effect'
import * as path from 'node:path'
import { DataWriter, DataWriterError, type WriteMetadata } from '../services/DataWriter'
import type { OptionsGreeksData } from '../services/ThetaDataApiClient'

interface TestWriterState {
  chunks: Array<{
    data: ReadonlyArray<OptionsGreeksData>
    metadata: WriteMetadata
  }>
  filesCreated: string[]
  totalRecordsWritten: number
  totalBytesWritten: number
  shouldFail: boolean
  failureMessage?: string
}

export const DataWriterTest = Layer.effect(
  DataWriter,
  Effect.gen(function* (_) {
    const stateRef = yield* _(
      Ref.make<TestWriterState>({
        chunks: [],
        filesCreated: [],
        totalRecordsWritten: 0,
        totalBytesWritten: 0,
        shouldFail: false,
      }),
    )

    return DataWriter.of({
      writeChunk: (chunk, metadata) =>
        Effect.gen(function* (_) {
          const state = yield* _(Ref.get(stateRef))

          if (state.shouldFail) {
            return yield* _(
              Effect.fail(
                new DataWriterError({
                  message: state.failureMessage || 'Test write failure',
                }),
              ),
            )
          }

          // Store the chunk for verification
          yield* _(
            Ref.update(stateRef, (s) => ({
              ...s,
              chunks: [...s.chunks, { data: chunk, metadata }],
              totalRecordsWritten: s.totalRecordsWritten + chunk.length,
              totalBytesWritten: s.totalBytesWritten + chunk.length * 100, // Mock 100 bytes per record
            })),
          )

          // Track file creation on first chunk of new expiration
          if (metadata.isFirstChunk) {
            const fileName = path.join(metadata.outputDir, `spxw_exp_${metadata.expiration.replace(/-/g, '')}.csv`)
            yield* _(
              Ref.update(stateRef, (s) => ({
                ...s,
                filesCreated: [...s.filesCreated, fileName],
              })),
            )
          }
        }),

      finalize: () =>
        Effect.gen(function* (_) {
          const state = yield* _(Ref.get(stateRef))

          if (state.shouldFail) {
            return yield* _(
              Effect.fail(
                new DataWriterError({
                  message: 'Test finalize failure',
                }),
              ),
            )
          }

          return {
            filesCreated: state.filesCreated,
            totalRecordsWritten: state.totalRecordsWritten,
            totalBytesWritten: state.totalBytesWritten,
            format: 'test-csv',
          }
        }),

      getFormat: () => 'test-csv',
    })
  }),
)

// Helper to configure test writer behavior
export const configureTestWriter = (config: { shouldFail?: boolean; failureMessage?: string }) =>
  Layer.effect(
    DataWriter,
    Effect.gen(function* (_) {
      const stateRef = yield* _(
        Ref.make<TestWriterState>({
          chunks: [],
          filesCreated: [],
          totalRecordsWritten: 0,
          totalBytesWritten: 0,
          shouldFail: config.shouldFail || false,
          failureMessage: config.failureMessage,
        }),
      )

      return DataWriter.of({
        writeChunk: (chunk, metadata) =>
          Effect.gen(function* (_) {
            const state = yield* _(Ref.get(stateRef))

            if (state.shouldFail) {
              return yield* _(
                Effect.fail(
                  new DataWriterError({
                    message: state.failureMessage || 'Test write failure',
                  }),
                ),
              )
            }

            yield* _(
              Ref.update(stateRef, (s) => ({
                ...s,
                chunks: [...s.chunks, { data: chunk, metadata }],
                totalRecordsWritten: s.totalRecordsWritten + chunk.length,
                totalBytesWritten: s.totalBytesWritten + chunk.length * 100,
              })),
            )

            if (metadata.isFirstChunk) {
              const fileName = path.join(metadata.outputDir, `spxw_exp_${metadata.expiration.replace(/-/g, '')}.csv`)
              yield* _(
                Ref.update(stateRef, (s) => ({
                  ...s,
                  filesCreated: [...s.filesCreated, fileName],
                })),
              )
            }
          }),

        finalize: () =>
          Effect.gen(function* (_) {
            const state = yield* _(Ref.get(stateRef))

            if (state.shouldFail) {
              return yield* _(
                Effect.fail(
                  new DataWriterError({
                    message: 'Test finalize failure',
                  }),
                ),
              )
            }

            return {
              filesCreated: state.filesCreated,
              totalRecordsWritten: state.totalRecordsWritten,
              totalBytesWritten: state.totalBytesWritten,
              format: 'test-csv',
            }
          }),

        getFormat: () => 'test-csv',
      })
    }),
  )
