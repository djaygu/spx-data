import { Command as Cli } from '@effect/cli'
import { BunContext } from '@effect/platform-bun'
import { Effect, Layer } from 'effect'
import { ThetaDataApiClientLive } from '@/layers/ThetaDataApiClientLive'
import { health } from './commands/health'

const cli = Cli.make('spx-data', {
  version: '1.0.0',
}).pipe(Cli.withDescription('SPX options data pipeline'), Cli.withSubcommands([health]))

const MainLive = Layer.mergeAll(ThetaDataApiClientLive, BunContext.layer)

export const main = (args: ReadonlyArray<string>) =>
  Cli.run(cli, {
    name: 'spx-data',
    version: '1.0.0',
    argv: args,
  }).pipe(
    Effect.provide(MainLive),
    Effect.tapError((error) => Effect.log(`Error: ${error}`)),
  )
