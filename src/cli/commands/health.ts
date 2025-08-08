import * as Command from '@effect/cli/Command'
import { Effect } from 'effect'
import { AppConfig } from '@/config/AppConfig'
import { ThetaDataApiClient } from '@/services/ThetaDataApiClient'

export const health = Command.make('health', {}, () =>
  Effect.gen(function* () {
    console.log('Checking ThetaData Terminal connection...')

    const client = yield* ThetaDataApiClient
    const config = yield* AppConfig

    // Use the new healthCheck method for detailed status
    const terminalStatus = yield* client.healthCheck()

    if (terminalStatus.isConnected) {
      console.log('✓ ThetaData Terminal connection: OK')
      console.log(`✓ Terminal URL: ${config.thetaData.baseUrl}`)
      console.log(`✓ Status: ${terminalStatus.status}`)
      console.log(`✓ Checked at: ${terminalStatus.timestamp.toISOString()}`)
      console.log('✓ Effect runtime verification: OK')

      // Display configuration
      console.log('\nConfiguration:')
      console.log(`  Max concurrent requests: ${config.thetaData.maxConcurrentRequests}`)
      console.log(`  Max retries: ${config.thetaData.maxRetries}`)
      console.log(`  Retry base delay: ${config.thetaData.retryBaseDelayMs}ms`)
      console.log(`  Request timeout: ${config.thetaData.requestTimeoutMs}ms`)
    } else {
      console.log(`✗ ThetaData Terminal status: ${terminalStatus.status}`)
      console.log('✗ Terminal is not connected')
      console.log('Please ensure ThetaData Terminal is running and logged in')

      yield* Effect.fail(new Error(`Terminal status: ${terminalStatus.status}`))
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        console.log(`✗ Health check failed: ${error}`)
        console.log('Please ensure ThetaData Terminal is running on http://127.0.0.1:25510')
        yield* Effect.fail(error)
      }),
    ),
  ),
).pipe(Command.withDescription('Check ThetaData Terminal connection status and configuration'))
