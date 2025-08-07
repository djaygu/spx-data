#!/usr/bin/env bun

import * as Command from '@effect/cli/Command'
import { BunContext, BunRuntime } from '@effect/platform-bun'
import { Effect, Layer } from 'effect'
import { ThetaDataApiClientLive } from '@/layers/ThetaDataApiClientLive'
import { BulkGreeksProcessorLive } from '@/layers/BulkGreeksProcessorLive'
import { DataPipelineLive } from '@/layers/DataPipelineLive'
import { CsvDataWriterLive } from '@/layers/CsvDataWriter'
import { JsonMetricsWriterLive } from '@/layers/JsonMetricsWriter'
import { health } from './commands/health'
import { download } from './commands/download'

// Main CLI Application
const cliApp = Command.make('spx-data', {}, () =>
  Effect.sync(() => {
    console.log('SPX Options Data Pipeline Tool')
    console.log("Use 'spx-data --help' for available commands")
  })
).pipe(
  Command.withDescription('SPX Options Data Pipeline Tool'),
  Command.withSubcommands([health, download])
)

// Compose layers properly with their dependencies
// BulkGreeksProcessorLive needs ThetaDataApiClient
const BulkProcessorWithDeps = BulkGreeksProcessorLive.pipe(
  Layer.provide(ThetaDataApiClientLive)
)

// DataPipelineLive needs DataWriter and MetricsWriter
const DataPipelineWithDeps = DataPipelineLive.pipe(
  Layer.provide(Layer.merge(CsvDataWriterLive, JsonMetricsWriterLive))
)

// Merge all layers together
const MainLive = Layer.mergeAll(
  ThetaDataApiClientLive,
  BulkProcessorWithDeps,
  DataPipelineWithDeps,
  BunContext.layer
)

// Initialize and run the CLI application
const cli = Command.run(cliApp, {
  name: 'SPX Data Pipeline',
  version: '1.0.0'
})

export const main = (args: ReadonlyArray<string>) =>
  cli(args).pipe(
    Effect.provide(MainLive)
  )