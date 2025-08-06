import { Command } from '@effect/cli'
import { Effect } from 'effect'
import { AppConfig } from '@/config/AppConfig'
import { ThetaDataApiClient } from '@/services/ThetaDataApiClient'

export const health = Command.make('health', {}, () =>
  Effect.gen(function* (_) {
    yield* _(Effect.log('Checking ThetaData Terminal connection...'))

    const client = yield* _(ThetaDataApiClient)
    const config = yield* _(AppConfig)

    // Use the new healthCheck method for detailed status
    const terminalStatus = yield* _(client.healthCheck())

    if (terminalStatus.isConnected) {
      yield* _(Effect.log('✓ ThetaData Terminal connection: OK'))
      yield* _(Effect.log(`✓ Terminal URL: ${config.thetaData.baseUrl}`))
      yield* _(Effect.log(`✓ Status: ${terminalStatus.status}`))
      yield* _(Effect.log(`✓ Checked at: ${terminalStatus.timestamp.toISOString()}`))
      yield* _(Effect.log('✓ Effect runtime verification: OK'))

      // Display configuration
      yield* _(Effect.log('\nConfiguration:'))
      yield* _(Effect.log(`  Max concurrent requests: ${config.thetaData.maxConcurrentRequests}`))
      yield* _(Effect.log(`  Max retries: ${config.thetaData.maxRetries}`))
      yield* _(Effect.log(`  Retry base delay: ${config.thetaData.retryBaseDelayMs}ms`))
      yield* _(Effect.log(`  Request timeout: ${config.thetaData.requestTimeoutMs}ms`))

      return Effect.succeed(undefined)
    } else {
      yield* _(Effect.log(`✗ ThetaData Terminal status: ${terminalStatus.status}`))
      yield* _(Effect.log('✗ Terminal is not connected'))
      yield* _(Effect.log('Please ensure ThetaData Terminal is running and logged in'))

      return Effect.fail(`Terminal status: ${terminalStatus.status}`)
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
).pipe(Command.withDescription('Check ThetaData Terminal connection status and configuration'))
