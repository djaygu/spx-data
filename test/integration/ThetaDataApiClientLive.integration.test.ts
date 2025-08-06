import { describe, expect, it } from 'bun:test'
import { Config, Context, Effect, Layer } from 'effect'
import type { AppConfig } from '@/config/AppConfig'
import { ThetaDataApiClientLive } from '@/layers/ThetaDataApiClientLive'
import { ThetaDataApiClient } from '@/services/ThetaDataApiClient'

// Integration tests that connect to a real ThetaData Terminal
// These tests will only run if THETA_DATA_TERMINAL_URL environment variable is set
const SHOULD_RUN_INTEGRATION_TESTS = process.env.THETA_DATA_TERMINAL_URL !== undefined

// Set environment variables for the test
if (SHOULD_RUN_INTEGRATION_TESTS) {
  process.env.CONFIG_THETADATA_BASE_URL =
    process.env.THETA_DATA_TERMINAL_URL || 'http://127.0.0.1:25510'
}

// Create AppConfig layer
const AppConfigLive = Layer.effect(
  Context.GenericTag<AppConfig>('AppConfig'),
  Config.all({
    thetaData: Config.all({
      baseUrl: Config.string('CONFIG_THETADATA_BASE_URL').pipe(
        Config.withDefault('http://127.0.0.1:25510'),
      ),
      maxConcurrentRequests: Config.number('CONFIG_THETADATA_MAX_CONCURRENT_REQUESTS').pipe(
        Config.withDefault(2),
      ),
      maxRetries: Config.number('CONFIG_THETADATA_MAX_RETRIES').pipe(Config.withDefault(3)),
      retryBaseDelayMs: Config.number('CONFIG_THETADATA_RETRY_BASE_DELAY_MS').pipe(
        Config.withDefault(1000),
      ),
      requestTimeoutMs: Config.number('CONFIG_THETADATA_REQUEST_TIMEOUT_MS').pipe(
        Config.withDefault(30000),
      ),
    }),
    download: Config.all({
      maxDTE: Config.number('CONFIG_DOWNLOAD_MAX_DTE').pipe(Config.withDefault(30)),
    }),
    storage: Config.all({
      dataDirectory: Config.string('CONFIG_STORAGE_DATA_DIRECTORY').pipe(
        Config.withDefault('./data'),
      ),
    }),
  }),
)

const IntegrationLive = Layer.mergeAll(ThetaDataApiClientLive, AppConfigLive)

describe.skipIf(!SHOULD_RUN_INTEGRATION_TESTS)('ThetaDataApiClientLive Integration Tests', () => {
  describe('healthCheck', () => {
    it('should connect to real ThetaData Terminal', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(client.healthCheck())
        }).pipe(Effect.provide(IntegrationLive)),
      )

      expect(result.isConnected).toBe(true)
      expect(result.status).toBe('CONNECTED')
      expect(result.timestamp).toBeInstanceOf(Date)
    })
  })

  describe('listExpirations', () => {
    it('should return real SPXW expiration dates', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(client.listExpirations())
        }).pipe(Effect.provide(IntegrationLive)),
      )

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)

      // Verify the structure of real data
      const firstExpiration = result[0]
      expect(firstExpiration).toHaveProperty('date')
      expect(firstExpiration).toHaveProperty('daysToExpiration')

      // Date should be in YYYY-MM-DD format
      expect(firstExpiration.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      // Days to expiration should be a reasonable number
      expect(typeof firstExpiration.daysToExpiration).toBe('number')
      // ThetaData includes historical expirations, so DTE can be negative (in the past)
      expect(firstExpiration.daysToExpiration).toBeGreaterThanOrEqual(-10000)
      expect(firstExpiration.daysToExpiration).toBeLessThanOrEqual(1000)

      // Should be sorted by expiration date (nearest first)
      if (result.length > 1) {
        const daysToExpirations = result.map((e) => e.daysToExpiration)
        const sorted = [...daysToExpirations].sort((a, b) => a - b)
        expect(daysToExpirations).toEqual(sorted)
      }
    })
  })

  describe('getBulkOptionsGreeks', () => {
    it('should return real options Greeks data in CSV format', async () => {
      // Use a specific historical date that we know has data
      // SPXW expiration on March 15, 2024, data from March 14, 2024
      const result = await Effect.runPromise(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(
            client.getBulkOptionsGreeks({
              root: 'SPXW',
              expiration: '20240315', // March 15, 2024 expiration
              startDate: '20240314', // March 14, 2024 data
              endDate: '20240314',
              interval: 3600000, // 1 hour intervals
              rth: true, // Regular trading hours only
            }),
          )
        }).pipe(Effect.provide(IntegrationLive)),
      )

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)

      // Verify the structure of real Greeks data
      const firstGreek = result[0]

      // Check all required fields exist
      expect(firstGreek).toHaveProperty('strike')
      expect(firstGreek).toHaveProperty('right')
      expect(firstGreek).toHaveProperty('bid')
      expect(firstGreek).toHaveProperty('ask')
      expect(firstGreek).toHaveProperty('delta')
      expect(firstGreek).toHaveProperty('theta')
      expect(firstGreek).toHaveProperty('vega')
      expect(firstGreek).toHaveProperty('rho')
      expect(firstGreek).toHaveProperty('epsilon')
      expect(firstGreek).toHaveProperty('lambda')
      expect(firstGreek).toHaveProperty('impliedVolatility')
      expect(firstGreek).toHaveProperty('ivError')
      expect(firstGreek).toHaveProperty('underlyingPrice')
      expect(firstGreek).toHaveProperty('timestamp')

      // Verify data types and reasonable values
      expect(typeof firstGreek.strike).toBe('number')
      expect(firstGreek.strike).toBeGreaterThan(0)

      expect(['C', 'P']).toContain(firstGreek.right)

      expect(typeof firstGreek.bid).toBe('number')
      expect(typeof firstGreek.ask).toBe('number')

      expect(typeof firstGreek.delta).toBe('number')
      expect(Math.abs(firstGreek.delta)).toBeLessThanOrEqual(1)

      expect(typeof firstGreek.theta).toBe('number')
      expect(typeof firstGreek.vega).toBe('number')
      expect(typeof firstGreek.rho).toBe('number')

      expect(typeof firstGreek.impliedVolatility).toBe('number')
      expect(typeof firstGreek.underlyingPrice).toBe('number')
      expect(firstGreek.underlyingPrice).toBeGreaterThan(0)

      expect(firstGreek.timestamp).toBeInstanceOf(Date)

      // Should contain multiple strikes
      const strikes = new Set(result.map((g) => g.strike))
      expect(strikes.size).toBeGreaterThan(10)

      // Should contain both calls and puts
      const hasCall = result.some((g) => g.right === 'C')
      const hasPut = result.some((g) => g.right === 'P')
      expect(hasCall).toBe(true)
      expect(hasPut).toBe(true)

      // Verify CSV parsing worked correctly (no commas in numeric values)
      result.forEach((greek, index) => {
        if (Number.isNaN(greek.strike)) {
          throw new Error(`Invalid strike at index ${index}: ${greek.strike}`)
        }
        if (Number.isNaN(greek.underlyingPrice)) {
          throw new Error(`Invalid underlyingPrice at index ${index}: ${greek.underlyingPrice}`)
        }
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid expiration date gracefully', async () => {
      const resultPromise = Effect.runPromiseExit(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(
            client.getBulkOptionsGreeks({
              root: 'SPXW',
              expiration: '20991231', // Far future date that doesn't exist
              startDate: '20240101',
              endDate: '20240101',
            }),
          )
        }).pipe(Effect.provide(IntegrationLive)),
      )

      const exit = await resultPromise
      expect(exit._tag).toBe('Failure')
    })

    it('should handle invalid date format gracefully', async () => {
      const resultPromise = Effect.runPromiseExit(
        Effect.gen(function* (_) {
          const client = yield* _(ThetaDataApiClient)
          return yield* _(
            client.getBulkOptionsGreeks({
              root: 'SPXW',
              expiration: 'invalid',
              startDate: 'invalid',
              endDate: 'invalid',
            }),
          )
        }).pipe(Effect.provide(IntegrationLive)),
      )

      const exit = await resultPromise
      expect(exit._tag).toBe('Failure')
    })
  })
})

// Provide instructions for running integration tests
if (!SHOULD_RUN_INTEGRATION_TESTS) {
  describe('ThetaDataApiClientLive Integration Tests', () => {
    it('should skip when THETA_DATA_TERMINAL_URL is not set', () => {
      console.log(
        '\n' +
          '='.repeat(60) +
          '\n' +
          'Integration tests skipped.\n' +
          'To run integration tests:\n' +
          '1. Start ThetaData Terminal\n' +
          '2. Set environment variable: export THETA_DATA_TERMINAL_URL=http://127.0.0.1:25510\n' +
          '3. Run: bun test integration\n' +
          '='.repeat(60) +
          '\n',
      )
      expect(true).toBe(true)
    })
  })
}
