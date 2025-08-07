import * as path from 'node:path'
import { Effect, Layer, Ref } from 'effect'
import { DataWriter, DataWriterError } from '../services/DataWriter'
import type { OptionsGreeksData } from '../services/ThetaDataApiClient'

interface CsvWriterState {
  currentExpiration?: string
  currentFile?: unknown // Bun.FileBlob
  currentTempPath?: string
  currentFinalPath?: string
  currentData: string[]
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
  // Map OptionsGreeksData fields to CSV columns
  // Using only the actual fields that exist in the OptionsGreeksData interface

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

export const CsvDataWriterLive = Layer.effect(
  DataWriter,
  Effect.gen(function* (_) {
    const stateRef = yield* _(
      Ref.make<CsvWriterState>({
        currentData: [],
        filesCreated: [],
        totalRecordsWritten: 0,
        totalBytesWritten: 0,
      }),
    )

    const outputDir = process.env.DATA_OUTPUT_DIR || './data/greeks'

    const ensureDirectoryExists = (dirPath: string) =>
      Effect.tryPromise({
        try: async () => {
          // Use Bun's shell to create directory
          await Bun.$`mkdir -p ${dirPath}`.quiet()
        },
        catch: (error) =>
          new DataWriterError({ message: `Failed to create directory: ${dirPath}`, cause: error }),
      })

    const closeCurrentFile = Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      if (state.currentData.length > 0 && state.currentTempPath && state.currentFinalPath) {
        // Write all accumulated data at once using Bun's file API
        const content = state.currentData.join('')
        yield* _(
          Effect.tryPromise({
            try: async () => {
              await Bun.write(state.currentTempPath!, content)
            },
            catch: (error) =>
              new DataWriterError({ message: 'Failed to write file', cause: error }),
          }),
        )

        // Rename temp file to final path using Bun's shell
        yield* _(
          Effect.tryPromise({
            try: async () => {
              await Bun.$`mv ${state.currentTempPath} ${state.currentFinalPath}`.quiet()
            },
            catch: (error) =>
              new DataWriterError({ message: 'Failed to rename temp file', cause: error }),
          }),
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

            // Create directory for the expiration date
            const expirationDir = path.join(outputDir, metadata.expiration.replace(/-/g, ''))
            yield* _(ensureDirectoryExists(expirationDir))

            // Setup new file paths
            const fileName = `SPXW_${metadata.expiration.replace(/-/g, '')}.csv`
            const finalPath = path.join(expirationDir, fileName)
            const tempPath = `${finalPath}.tmp`

            // Start with headers
            const headerLine = `${CSV_HEADERS}\n`
            const headerBytes = Buffer.byteLength(headerLine)

            // Update state
            yield* _(
              Ref.update(stateRef, (s) => ({
                ...s,
                currentExpiration: metadata.expiration,
                currentData: [headerLine],
                currentTempPath: tempPath,
                currentFinalPath: finalPath,
                totalBytesWritten: s.totalBytesWritten + headerBytes,
              })),
            )
          }

          // Get current state again after potential file change
          const currentState = yield* _(Ref.get(stateRef))

          if (!currentState.currentTempPath) {
            return yield* _(Effect.fail(new DataWriterError({ message: 'No active file' })))
          }

          // Append chunk data to buffer
          const csvLines = `${chunk.map(optionsDataToCsvRow).join('\n')}\n`
          const chunkBytes = Buffer.byteLength(csvLines)

          // Update state - accumulate data in memory
          yield* _(
            Ref.update(stateRef, (s) => ({
              ...s,
              currentData: [...s.currentData, csvLines],
              totalRecordsWritten: s.totalRecordsWritten + chunk.length,
              totalBytesWritten: s.totalBytesWritten + chunkBytes,
            })),
          )

          // Close file if last chunk
          if (metadata.isLastChunk) {
            yield* _(closeCurrentFile)

            const finalState = yield* _(Ref.get(stateRef))
            if (finalState.currentFinalPath) {
              yield* _(
                Ref.update(stateRef, (s) => ({
                  ...s,
                  filesCreated: [...s.filesCreated, finalState.currentFinalPath!],
                  currentExpiration: undefined,
                  currentStream: undefined,
                  currentTempPath: undefined,
                  currentFinalPath: undefined,
                })),
              )
            }
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
