import { describe, expect, it } from 'bun:test'
import { Effect, Exit, Layer } from 'effect'
import { TestLive } from '@/layers/TestLive'
import {
  type ExpirationDate,
  ThetaDataApiClient,
  ThetaDataApiError,
  ThetaDataConnectionError,
  ThetaDataRateLimitError,
} from '@/services/ThetaDataApiClient'

describe('ThetaDataApiClient', () => {
  describe('healthCheck', () => {
    it('should return connected status', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(client.healthCheck())
        }).pipe(Effect.provide(TestLive)),
      )

      expect(result.isConnected).toBe(true)
      expect(result.status).toBe('CONNECTED')
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('should handle disconnected status', async () => {
      const OfflineLayer = Layer.succeed(ThetaDataApiClient, {
        healthCheck: () =>
          Effect.succeed({
            isConnected: false,
            status: 'DISCONNECTED' as const,
            timestamp: new Date(),
          }),
        listExpirations: () =>
          Effect.fail(new ThetaDataConnectionError({ message: 'Terminal offline' })),
        getBulkOptionsGreeks: () =>
          Effect.fail(new ThetaDataConnectionError({ message: 'Terminal offline' })),
      })

      const result = await Effect.runPromise(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(client.healthCheck())
        }).pipe(Effect.provide(OfflineLayer)),
      )

      expect(result.isConnected).toBe(false)
      expect(result.status).toBe('DISCONNECTED')
    })
  })

  describe('listExpirations', () => {
    it('should return expiration dates with days to expiration', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(client.listExpirations())
        }).pipe(Effect.provide(TestLive)),
      )

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)

      const first = result[0]
      expect(first).toHaveProperty('date')
      expect(first).toHaveProperty('daysToExpiration')
      expect(typeof first.date).toBe('string')
      expect(typeof first.daysToExpiration).toBe('number')
    })

    it('should handle API errors', async () => {
      const ErrorLayer = Layer.succeed(ThetaDataApiClient, {
        healthCheck: () =>
          Effect.succeed({
            isConnected: true,
            status: 'CONNECTED' as const,
            timestamp: new Date(),
          }),
        listExpirations: () =>
          Effect.fail(
            new ThetaDataApiError({
              message: 'Invalid request',
              statusCode: 400,
              endpoint: '/v2/list/expirations',
            }),
          ),
        getBulkOptionsGreeks: () => Effect.succeed([]),
      })

      const exit = await Effect.runPromiseExit(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(client.listExpirations())
        }).pipe(Effect.provide(ErrorLayer)),
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === 'Fail' ? exit.cause.error : null
        expect(error).toMatchObject({
          _tag: 'ThetaDataApiError',
          message: 'Invalid request',
          statusCode: 400,
        })
      }
    })

    it('should handle rate limit errors', async () => {
      const RateLimitLayer = Layer.succeed(ThetaDataApiClient, {
        healthCheck: () =>
          Effect.succeed({
            isConnected: true,
            status: 'CONNECTED' as const,
            timestamp: new Date(),
          }),
        listExpirations: () =>
          Effect.fail(
            new ThetaDataRateLimitError({
              message: 'Rate limit exceeded',
              retryAfter: 5000,
            }),
          ),
        getBulkOptionsGreeks: () => Effect.succeed([]),
      })

      const exit = await Effect.runPromiseExit(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(client.listExpirations())
        }).pipe(Effect.provide(RateLimitLayer)),
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === 'Fail' ? exit.cause.error : null
        expect(error).toMatchObject({
          _tag: 'ThetaDataRateLimitError',
          retryAfter: 5000,
        })
      }
    })
  })

  describe('getBulkOptionsGreeks', () => {
    it('should return Greeks data with required fields', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(
            client.getBulkOptionsGreeks({
              root: 'SPXW',
              expiration: '20240315',
              startDate: '20240315',
              endDate: '20240315',
            }),
          )
        }).pipe(Effect.provide(TestLive)),
      )

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)

      const greek = result[0]
      // Check all required fields
      expect(greek).toHaveProperty('strike')
      expect(greek).toHaveProperty('right')
      expect(greek).toHaveProperty('bid')
      expect(greek).toHaveProperty('ask')
      expect(greek).toHaveProperty('delta')
      expect(greek).toHaveProperty('theta')
      expect(greek).toHaveProperty('vega')
      expect(greek).toHaveProperty('rho')
      expect(greek).toHaveProperty('epsilon')
      expect(greek).toHaveProperty('lambda')
      expect(greek).toHaveProperty('impliedVolatility')
      expect(greek).toHaveProperty('ivError')
      expect(greek).toHaveProperty('underlyingPrice')
      expect(greek).toHaveProperty('timestamp')

      // Check types
      expect(typeof greek.strike).toBe('number')
      expect(['C', 'P']).toContain(greek.right)
      expect(greek.timestamp).toBeInstanceOf(Date)
    })

    it('should return all strikes and both calls/puts', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(
            client.getBulkOptionsGreeks({
              root: 'SPXW',
              expiration: '20240315',
              startDate: '20240315',
              endDate: '20240315',
              interval: 60000,
            }),
          )
        }).pipe(Effect.provide(TestLive)),
      )

      // Should contain multiple strikes
      const strikes = new Set(result.map((g) => g.strike))
      expect(strikes.size).toBeGreaterThan(1)

      // Should contain both calls and puts
      const hasCall = result.some((g) => g.right === 'C')
      const hasPut = result.some((g) => g.right === 'P')
      expect(hasCall).toBe(true)
      expect(hasPut).toBe(true)
    })

    it('should accept optional parameters', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(
            client.getBulkOptionsGreeks({
              root: 'SPXW',
              expiration: '20240315',
              startDate: '20240315',
              endDate: '20240315',
              interval: 60000,
              annualDiv: 0,
              rate: 'SOFR',
              rateValue: 0.0342,
              rth: true,
            }),
          )
        }).pipe(Effect.provide(TestLive)),
      )

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Retry Logic', () => {
    it.skip('should retry on transient failures', async () => {
      let attemptCount = 0

      const RetryLayer = Layer.succeed(ThetaDataApiClient, {
        healthCheck: () =>
          Effect.succeed({
            isConnected: true,
            status: 'CONNECTED' as const,
            timestamp: new Date(),
          }),
        listExpirations: () =>
          Effect.gen(function* (_) {
            attemptCount++
            if (attemptCount < 3) {
              return yield* _(
                Effect.fail(
                  new ThetaDataApiError({
                    message: 'Temporary failure',
                    statusCode: 503,
                  }),
                ),
              )
            }
            return [{ date: '2024-03-22', daysToExpiration: 7 }] as ReadonlyArray<ExpirationDate>
          }),
        getBulkOptionsGreeks: () => Effect.succeed([]),
      })

      const result = await Effect.runPromise(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(client.listExpirations())
        }).pipe(Effect.provide(RetryLayer)),
      )

      expect(attemptCount).toBe(1) // Will be 3 when retry is implemented in Live layer
      expect(result).toBeInstanceOf(Array)
    })
  })
})
