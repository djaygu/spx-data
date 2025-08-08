import * as path from 'node:path'
import { Effect, Layer, Ref } from 'effect'
import { DataWriter, DataWriterError } from '../services/DataWriter'
import type { OptionsGreeksData } from '../services/ThetaDataApiClient'

interface CsvWriterState {
  currentExpiration?: string
  currentTempPath?: string
  currentFinalPath?: string
  currentWriter?: ReturnType<ReturnType<typeof Bun.file>['writer']>
  filesCreated: string[]
  totalRecordsWritten: number
  totalBytesWritten: number
}

const formatCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (
    typeof value === 'string' &&
    (value.includes(',') || value.includes('"') || value.includes('\n'))
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return String(value)
}

const optionsDataToCsvRow = (data: OptionsGreeksData): string => {
  return [
    formatCsvValue(data.strike),
    formatCsvValue(data.right),
    formatCsvValue(data.bid),
    formatCsvValue(data.ask),
    formatCsvValue(data.delta),
    formatCsvValue(data.theta),
    formatCsvValue(data.vega),
    formatCsvValue(data.rho),
    formatCsvValue(data.epsilon),
    formatCsvValue(data.lambda),
    formatCsvValue(data.impliedVolatility),
    formatCsvValue(data.ivError),
    formatCsvValue(data.underlyingPrice),
    formatCsvValue(data.timestamp.toISOString()),
  ].join(',')
}

const CSV_HEADERS =
  'strike,right,bid,ask,delta,theta,vega,rho,epsilon,lambda,implied_volatility,iv_error,underlying_price,timestamp'

export const DataWriterCsvLive = Layer.effect(
  DataWriter,
  Effect.gen(function* (_) {
    const stateRef = yield* _(
      Ref.make<CsvWriterState>({
        filesCreated: [],
        totalRecordsWritten: 0,
        totalBytesWritten: 0,
      }),
    )

    // Note: outputDir now comes from metadata per write operation
    // Removing the static outputDir - it will come from WriteMetadata

    const ensureDirectoryExists = (dirPath: string) =>
      Effect.tryPromise({
        try: async () => {
          // Use Bun's shell for directory creation - faster than Node.js fs
          await Bun.$`mkdir -p ${dirPath}`.quiet()
        },
        catch: (error) =>
          new DataWriterError({ message: `Failed to create directory: ${dirPath}`, cause: error }),
      })

    const closeCurrentFile = Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      if (state.currentWriter) {
        // Close the writer
        yield* _(
          Effect.tryPromise({
            try: async () => {
              await state.currentWriter!.end()
            },
            catch: (error) =>
              new DataWriterError({ message: 'Failed to close writer', cause: error }),
          }),
        )
      }

      if (state.currentTempPath && state.currentFinalPath) {
        // Use Bun's shell for atomic rename - faster than Node.js fs
        yield* _(
          Effect.tryPromise({
            try: async () => {
              await Bun.$`mv ${state.currentTempPath} ${state.currentFinalPath}`.quiet()
            },
            catch: (error) =>
              new DataWriterError({ message: 'Failed to rename temp file', cause: error }),
          }),
        )

        // Add to files created list
        yield* _(
          Ref.update(stateRef, (s) => ({
            ...s,
            filesCreated: [...s.filesCreated, state.currentFinalPath!],
            currentExpiration: undefined,
            currentWriter: undefined,
            currentTempPath: undefined,
            currentFinalPath: undefined,
          })),
        )
      }
    })

    return DataWriter.of({
      writeChunk: (chunk, metadata) =>
        Effect.gen(function* (_) {
          const state = yield* _(Ref.get(stateRef))

          // Handle new expiration
          if (metadata.expiration !== state.currentExpiration) {
            // Close previous file if exists
            yield* _(closeCurrentFile)

            // Ensure output directory exists (trade date directory)
            yield* _(ensureDirectoryExists(metadata.outputDir))

            // Setup new file paths - files go directly in trade date directory
            const fileName = `spxw_exp_${metadata.expiration.replace(/-/g, '')}.csv`
            const finalPath = path.join(metadata.outputDir, fileName)
            const tempPath = `${finalPath}.tmp`

            // Create a new writer for this file
            const file = Bun.file(tempPath)
            const writer = file.writer()

            // Write headers
            const headerLine = `${CSV_HEADERS}\n`
            const headerBytes = Buffer.byteLength(headerLine)

            yield* _(
              Effect.tryPromise({
                try: async () => {
                  writer.write(headerLine)
                  await writer.flush()
                },
                catch: (error) =>
                  new DataWriterError({ message: 'Failed to write headers', cause: error }),
              }),
            )

            // Update state with new writer
            yield* _(
              Ref.update(stateRef, (s) => ({
                ...s,
                currentExpiration: metadata.expiration,
                currentWriter: writer,
                currentTempPath: tempPath,
                currentFinalPath: finalPath,
                totalBytesWritten: s.totalBytesWritten + headerBytes,
              })),
            )
          }

          // Get current state again after potential file change
          const currentState = yield* _(Ref.get(stateRef))

          if (!currentState.currentWriter) {
            return yield* _(Effect.fail(new DataWriterError({ message: 'No active writer' })))
          }

          // Format chunk data
          const csvLines = `${chunk.map(optionsDataToCsvRow).join('\n')}\n`
          const chunkBytes = Buffer.byteLength(csvLines)

          // Write chunk using the writer
          yield* _(
            Effect.tryPromise({
              try: async () => {
                currentState.currentWriter!.write(csvLines)
                await currentState.currentWriter!.flush()
              },
              catch: (error) =>
                new DataWriterError({ message: 'Failed to write chunk', cause: error }),
            }),
          )

          // Update metrics
          yield* _(
            Ref.update(stateRef, (s) => ({
              ...s,
              totalRecordsWritten: s.totalRecordsWritten + chunk.length,
              totalBytesWritten: s.totalBytesWritten + chunkBytes,
            })),
          )

          // Close file if last chunk
          if (metadata.isLastChunk) {
            yield* _(closeCurrentFile)
          }
        }),

      finalize: () =>
        Effect.gen(function* (_) {
          // Close any remaining file
          yield* _(closeCurrentFile)

          const finalState = yield* _(Ref.get(stateRef))

          return {
            filesCreated: finalState.filesCreated,
            totalRecordsWritten: finalState.totalRecordsWritten,
            totalBytesWritten: finalState.totalBytesWritten,
            format: 'csv',
          }
        }),

      getFormat: () => 'csv',
    })
  }),
)
