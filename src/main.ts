#!/usr/bin/env bun

import { BunContext, BunRuntime } from '@effect/platform-bun'
import { Effect, Layer, pipe } from 'effect'
import { ThetaDataApiClientLive } from './layers/ThetaDataApiClientLive'
import { ThetaDataApiClient } from './services/ThetaDataApiClient'

const args = process.argv.slice(2)
const command = args[0]

const MainLive = Layer.mergeAll(ThetaDataApiClientLive, BunContext.layer)

const healthCheck = Effect.gen(function* (_) {
  yield* _(Effect.log('Checking ThetaData Terminal connection...'))

  const client = yield* _(ThetaDataApiClient)

  // Check connection
  const isConnected = yield* _(client.checkConnection())

  if (isConnected) {
    // Get system status
    const status = yield* _(client.get('/v2/system/mdds/status'))

    yield* _(Effect.log('✓ ThetaData Terminal connection: OK'))
    yield* _(Effect.log(`✓ Terminal URL: http://127.0.0.1:25510`))
    yield* _(Effect.log('✓ Effect runtime verification: OK'))
    yield* _(Effect.log(`✓ System status: ${JSON.stringify(status)}`))
  } else {
    yield* _(Effect.log('✗ ThetaData Terminal connection: FAILED'))
    yield* _(Effect.log('Please ensure ThetaData Terminal is running'))
    return yield* _(Effect.fail('Connection failed'))
  }
}).pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* (_) {
      yield* _(Effect.log(`✗ Health check failed: ${error}`))
      yield* _(Effect.log('Please ensure ThetaData Terminal is running on http://127.0.0.1:25510'))
      return yield* _(Effect.fail(error))
    }),
  ),
)

const program = pipe(
  command === 'health' ? healthCheck : Effect.log('Usage: spx-data health'),
  Effect.provide(MainLive),
)

BunRuntime.runMain(program)
