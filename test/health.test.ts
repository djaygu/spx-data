import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { TestLive } from '@/layers/TestLive'
import { ThetaDataApiClient } from '@/services/ThetaDataApiClient'

// Extract health check logic for testing
const healthCheck = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  const isConnected = yield* _(client.checkConnection())

  if (isConnected) {
    const status = yield* _(client.get('/v2/system/mdds/status'))
    return { success: true, status }
  } else {
    return { success: false, error: 'Connection failed' }
  }
})

describe('Health Check', () => {
  it('should succeed when ThetaData Terminal is available', async () => {
    const result = await Effect.runPromise(healthCheck.pipe(Effect.provide(TestLive)))

    expect(result.success).toBe(true)
    expect(result.status).toEqual({
      mdds: 'ready',
      streaming: true,
      uptime: 123456,
    })
  })
})
