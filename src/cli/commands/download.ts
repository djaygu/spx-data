import * as Command from '@effect/cli/Command'
import * as Args from '@effect/cli/Args'
import * as Options from '@effect/cli/Options'
import { Effect, Schema } from 'effect'
import { AppConfig } from '@/config/AppConfig'
import { ThetaDataApiClient } from '@/services/ThetaDataApiClient'
import { BulkGreeksProcessor } from '@/services/BulkGreeksProcessor'
import { DataPipeline, type PipelineConfig } from '@/services/DataPipeline'
import * as path from 'node:path'
import { format, parse, isValid } from 'date-fns'

// Date validation function
const parseDate = (input: string): Date => {
  const date = parse(input, 'yyyy-MM-dd', new Date())
  if (!isValid(date)) {
    throw new Error(`Invalid date format: ${input}`)
  }
  return date
}

// Command arguments and options
const dateArg = Args.text({ name: 'date' }).pipe(
  Args.withDescription('Date in YYYY-MM-DD format')
)

const dryRunOption = Options.boolean('dry-run').pipe(
  Options.withAlias('d'),
  Options.withDescription('Preview what would be downloaded without fetching data'),
  Options.withDefault(false)
)

// Main download command
export const download = Command.make(
  'download',
  { date: dateArg, dryRun: dryRunOption },
  ({ date, dryRun }) =>
    Effect.gen(function* () {
      // Validate date format
      const tradeDate = yield* Effect.try({
        try: () => parseDate(date),
        catch: (error) => new Error(`Invalid date format. Expected YYYY-MM-DD, got: ${date}`)
      })

      console.log(`Starting download for trade date: ${format(tradeDate, 'yyyy-MM-dd')}`)

      if (dryRun) {
        console.log('DRY RUN MODE - No data will be downloaded')
      }

      // Get services
      const client = yield* ThetaDataApiClient
      const processor = yield* BulkGreeksProcessor
      const pipeline = yield* DataPipeline
      const config = yield* AppConfig

      // Create output directory
      const outputDir = path.join('./data', format(tradeDate, 'yyyyMMdd'))
      
      if (!dryRun) {
        yield* Effect.tryPromise({
          try: async () => {
            const { $ } = await import('bun')
            await $`mkdir -p ${outputDir}`.quiet()
          },
          catch: (error) => new Error(`Failed to create output directory: ${error}`)
        })
      }

      // Get expirations for the trade date
      console.log('Fetching available expirations...')
      const allExpirations = yield* client.listExpirations().pipe(
        Effect.mapError((error) => new Error(`Failed to fetch expirations: ${error}`))
      )

      // Filter expirations based on trade date (simplified for now)
      const expirations = allExpirations.map(exp => new Date(exp.date))
      const expirationCount = expirations.length
      
      console.log(`Found ${expirationCount} expirations for ${format(tradeDate, 'yyyy-MM-dd')}`)

      // Handle dry run mode
      if (dryRun) {
        console.log('\nDry run summary:')
        console.log(`  Trade date: ${format(tradeDate, 'yyyy-MM-dd')}`)
        console.log(`  Output directory: ${outputDir}`)
        console.log(`  Expirations to download: ${expirationCount}`)
        console.log(`  Estimated files: ${expirationCount}`)
        console.log('\nExpirations:')
        
        for (let index = 0; index < expirations.length; index++) {
          const exp = expirations[index]
          const fileName = `spxw_exp_${format(exp, 'yyyyMMdd')}.csv`
          console.log(`  [${index + 1}/${expirationCount}] ${format(exp, 'yyyy-MM-dd')} -> ${fileName}`)
        }
        
        return
      }

      // Process the data through the pipeline
      console.log('Starting data download and processing...')
      
      const pipelineConfig: PipelineConfig = {
        outputDir,
        chunkSize: 1000,
        compression: false,
        fileNamePattern: 'spxw_exp_{expiration}.csv',
      }

      // Stream bulk greeks data through the pipeline
      const stream = processor.streamBulkGreeks({
        root: 'SPXW',
        tradeDate: format(tradeDate, 'yyyyMMdd'),
        expDateList: expirations.map(exp => format(exp, 'yyyyMMdd')),
      })

      yield* pipeline.process(stream, pipelineConfig).pipe(
        Effect.mapError((error) => new Error(`Pipeline processing failed: ${error}`))
      )

      // Get final progress for summary
      const progress = yield* pipeline.getProgress()

      // Display summary
      console.log('\n' + '='.repeat(60))
      console.log('Download Complete')
      console.log('='.repeat(60))
      console.log(`Trade Date: ${format(tradeDate, 'yyyy-MM-dd')}`)
      console.log(`Output Directory: ${outputDir}`)
      console.log(`Total Expirations: ${expirationCount}`)
      
      if (progress) {
        console.log(`Total Records: ${progress.totalRecords.toLocaleString()}`)
        
        const durationMs = new Date().getTime() - progress.startTime.getTime()
        const durationSec = durationMs / 1000
        const recordsPerSec = Math.round(progress.totalRecords / durationSec)
        
        console.log(`Processing Time: ${Math.floor(durationSec / 60)}m ${Math.floor(durationSec % 60)}s`)
        console.log(`Throughput: ${recordsPerSec.toLocaleString()} records/sec`)
      }
    }).pipe(
      Effect.catchTag('ThetaDataConnectionError', () =>
        Effect.gen(function* () {
          console.log('✗ Cannot connect to ThetaData Terminal')
          console.log('  Please ensure ThetaData Terminal is running and logged in')
          console.log('  Expected URL: http://127.0.0.1:25510')
          yield* Effect.fail(new Error('Terminal not running'))
        })
      )
    )
).pipe(
  Command.withDescription('Download SPX options data for a specific date')
)