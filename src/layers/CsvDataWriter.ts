import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Effect, Layer, Ref } from 'effect'
import { DataWriter, DataWriterError } from '../services/DataWriter'
import type { OptionsGreeksData } from '../services/ThetaDataApiClient'

interface CsvWriterState {
  currentExpiration?: string
  currentTempPath?: string
  currentFinalPath?: string
  filesCreated: string[]
  totalRecordsWritten: number
  totalBytesWritten: number
  headerWritten: boolean
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

export const CsvDataWriterLive = Layer.effect(
  DataWriter,
  Effect.gen(function* (_) {
    const stateRef = yield* _(
      Ref.make<CsvWriterState>({
        filesCreated: [],
        totalRecordsWritten: 0,
        totalBytesWritten: 0,
        headerWritten: false,
      }),
    )

    const outputDir = process.env.DATA_OUTPUT_DIR || './data/greeks'

    const ensureDirectoryExists = (dirPath: string) =>
      Effect.tryPromise({
        try: async () => {
          await fs.mkdir(dirPath, { recursive: true })
        },
        catch: (error) =>
          new DataWriterError({ message: `Failed to create directory: ${dirPath}`, cause: error }),
      })

    const closeCurrentFile = Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      if (state.currentTempPath && state.currentFinalPath) {
        // Rename temp file to final path
        yield* _(
          Effect.tryPromise({
            try: async () => {
              await fs.rename(state.currentTempPath!, state.currentFinalPath!)
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
            currentTempPath: undefined,
            currentFinalPath: undefined,
            headerWritten: false,
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

            // Create directory for the expiration date
            const expirationDir = path.join(outputDir, metadata.expiration.replace(/-/g, ''))
            yield* _(ensureDirectoryExists(expirationDir))

            // Setup new file paths
            const fileName = `SPXW_${metadata.expiration.replace(/-/g, '')}.csv`
            const finalPath = path.join(expirationDir, fileName)
            const tempPath = `${finalPath}.tmp`

            // Update state with new file paths
            yield* _(
              Ref.update(stateRef, (s) => ({
                ...s,
                currentExpiration: metadata.expiration,
                currentTempPath: tempPath,
                currentFinalPath: finalPath,
                headerWritten: false,
              })),
            )
          }

          // Get current state again after potential file change
          const currentState = yield* _(Ref.get(stateRef))

          if (!currentState.currentTempPath) {
            return yield* _(Effect.fail(new DataWriterError({ message: 'No active file' })))
          }

          // Prepare data to write
          let dataToWrite = ''

          // Write headers if this is the first chunk for this file
          if (!currentState.headerWritten) {
            dataToWrite = `${CSV_HEADERS}\n`
            yield* _(
              Ref.update(stateRef, (s) => ({
                ...s,
                headerWritten: true,
              })),
            )
          }

          // Add data rows
          dataToWrite += `${chunk.map(optionsDataToCsvRow).join('\n')}\n`
          const chunkBytes = Buffer.byteLength(dataToWrite)

          // Append data to file
          yield* _(
            Effect.tryPromise({
              try: async () => {
                await fs.appendFile(currentState.currentTempPath!, dataToWrite)
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
