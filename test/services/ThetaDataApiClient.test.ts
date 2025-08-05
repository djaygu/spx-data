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

  it('should get expirations list', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* (_) {
        const client = yield* _(ThetaDataApiClient)
        return yield* _(client.getExpirations('SPX'))
      }).pipe(Effect.provide(TestLive)),
    )

    expect(result).toEqual(['2024-03-15', '2024-03-22', '2024-03-29'])
  })

  it('should fail for unknown root symbol', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* (_) {
        const client = yield* _(ThetaDataApiClient)
        return yield* _(client.getExpirations('UNKNOWN'))
      }).pipe(Effect.provide(TestLive)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = exit.cause._tag === 'Fail' ? exit.cause.error : null
      expect(error).toMatchObject({
        _tag: 'ApiConnectionError',
        message: 'Unknown root symbol: UNKNOWN',
        statusCode: 404,
      })
    }
  })

  it('should get bulk greeks data in CSV format', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* (_) {
        const client = yield* _(ThetaDataApiClient)
        return yield* _(
          client.getBulkGreeks({
            root: 'SPXW',
            exp: '240315',
            start_date: '20240315',
            end_date: '20240315',
            format: 'csv',
          }),
        )
      }).pipe(Effect.provide(TestLive)),
    )

    expect(result).toContain('ms_of_day')
    expect(result).toContain('delta')
    expect(result).toContain('theta')
    expect(result).toContain('vega')
  })
})
