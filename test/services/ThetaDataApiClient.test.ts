import { describe, expect, it } from 'bun:test'
import { Effect, Exit } from 'effect'
import { TestLive } from '@/layers/TestLive'
import { ThetaDataApiClient } from '@/services/ThetaDataApiClient'

describe('ThetaDataApiClient', () => {
  it('should check connection successfully', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* (_) {
        const client = yield* _(ThetaDataApiClient)
        return yield* _(client.checkConnection())
      }).pipe(Effect.provide(TestLive)),
    )

    expect(result).toBe(true)
  })

  it('should get system status', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* (_) {
        const client = yield* _(ThetaDataApiClient)
        return yield* _(client.get('/v2/system/mdds/status'))
      }).pipe(Effect.provide(TestLive)),
    )

    expect(result).toEqual({
      mdds: 'ready',
      streaming: true,
      uptime: 123456,
    })
  })

  it('should get expirations list', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* (_) {
        const client = yield* _(ThetaDataApiClient)
        return yield* _(client.get<string[]>('/v2/list/expirations', { root: 'SPX' }))
      }).pipe(Effect.provide(TestLive)),
    )

    expect(result).toEqual(['2024-03-15', '2024-03-22', '2024-03-29'])
  })

  it('should fail for unknown endpoint', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* (_) {
        const client = yield* _(ThetaDataApiClient)
        return yield* _(client.get('/unknown/endpoint'))
      }).pipe(Effect.provide(TestLive)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = exit.cause._tag === 'Fail' ? exit.cause.error : null
      expect(error).toMatchObject({
        _tag: 'ApiConnectionError',
        message: 'Unknown endpoint: /unknown/endpoint',
        statusCode: 404,
      })
    }
  })
})
