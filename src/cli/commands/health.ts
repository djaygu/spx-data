import { Command } from '@effect/cli'
import { Effect } from 'effect'
import { ThetaDataApiClient } from '@/services/ThetaDataApiClient'

export const health = Command.make('health', {}, () =>
  Effect.gen(function* (_) {
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

      return Effect.succeed(undefined)
    } else {
      yield* _(Effect.log('✗ ThetaData Terminal connection: FAILED'))
      yield* _(Effect.log('Please ensure ThetaData Terminal is running'))

      return Effect.fail('Connection failed')
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* (_) {
        yield* _(Effect.log(`✗ Health check failed: ${error}`))
        yield* _(
          Effect.log('Please ensure ThetaData Terminal is running on http://127.0.0.1:25510'),
        )
        return Effect.fail(error)
      }),
    ),
  ),
).pipe(Command.withDescription('Check ThetaData Terminal connection and Effect runtime'))
