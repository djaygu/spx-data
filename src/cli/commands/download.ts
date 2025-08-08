import * as Command from '@effect/cli/Command'
import * as Args from '@effect/cli/Args'
import * as Options from '@effect/cli/Options'
import { Effect, Stream } from 'effect'
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

const dteOption = Options.integer('dte').pipe(
  Options.withDescription('Maximum days to expiration (0 = current day only)'),
  Options.withDefault(0)
)

const intervalOption = Options.integer('interval').pipe(
  Options.withDescription('Data interval in milliseconds (60000=1min, 3600000=1hr)'),
  Options.withDefault(60000)
)

// Main download command
export const download = Command.make(
  'download',
  { date: dateArg, dryRun: dryRunOption, dte: dteOption, interval: intervalOption },
  ({ date, dryRun, dte, interval }) =>
    Effect.gen(function* (_) {
      // Validate date format
      const tradeDate = yield* _(
        Effect.try({
          try: () => parseDate(date),
          catch: () => new Error(`Invalid date format. Expected YYYY-MM-DD, got: ${date}`)
        })
      )

      console.log(`Starting download for trade date: ${format(tradeDate, 'yyyy-MM-dd')}`)

      if (dryRun) {
        console.log('DRY RUN MODE - No data will be downloaded')
      }

      // Get services
      const client = yield* _(ThetaDataApiClient)
      const processor = yield* _(BulkGreeksProcessor)
      const pipeline = yield* _(DataPipeline)

      // Create output directory
      const outputDir = path.join('./data', format(tradeDate, 'yyyyMMdd'))
      
      if (!dryRun) {
        yield* _(
          Effect.tryPromise({
            try: async () => {
              const fs = await import('node:fs/promises')
              await fs.mkdir(outputDir, { recursive: true })
            },
            catch: (error) => new Error(`Failed to create output directory: ${error}`)
          })
        )
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
        console.log(`  DTE filter: ${dte === 0 ? 'Current day only' : `Up to ${dte} days`}`)
        console.log(`  Data interval: ${interval === 60000 ? '1 minute' : interval === 3600000 ? '1 hour' : `${interval}ms`}`)
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
        maxDTE: dte,
        interval: interval
      }).pipe(
        // Convert stream errors to defects (die on error)
        Stream.orDie
      )

      yield* _(
        pipeline.process(stream, pipelineConfig).pipe(
          Effect.catchAll((error) => 
            Effect.fail(new Error(`Pipeline processing failed: ${error}`))
          )
        )
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
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          if (error instanceof Error && error.message.includes('Terminal')) {
            console.log('✗ Cannot connect to ThetaData Terminal')
            console.log('  Please ensure ThetaData Terminal is running and logged in')
            console.log('  Expected URL: http://127.0.0.1:25510')
          } else {
            console.log(`✗ Download failed: ${error}`)
          }
          yield* Effect.fail(error)
        })
      )
    )
).pipe(
  Command.withDescription('Download SPX options data for a specific date')
)