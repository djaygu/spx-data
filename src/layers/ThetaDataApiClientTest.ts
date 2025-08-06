import { Effect, Layer } from 'effect'
import {
  type BulkOptionsGreeksParams,
  type ExpirationDate,
  type OptionsGreeksData,
  type TerminalStatus,
  ThetaDataApiClient,
} from '../services/ThetaDataApiClient'

export const ThetaDataApiClientTest = Layer.succeed(ThetaDataApiClient, {
  healthCheck: () =>
    Effect.succeed<TerminalStatus>({
      isConnected: true,
      status: 'CONNECTED',
      timestamp: new Date(),
    }),

  listExpirations: () => {
    // Mock expiration dates
    const expirations: ExpirationDate[] = [
      { date: '2024-03-22', daysToExpiration: 7 },
      { date: '2024-03-29', daysToExpiration: 14 },
      { date: '2024-04-05', daysToExpiration: 21 },
    ]
    return Effect.succeed(expirations as ReadonlyArray<ExpirationDate>)
  },

  getBulkOptionsGreeks: (_params: BulkOptionsGreeksParams) => {
    // Return mock Greeks data for all strikes and rights for the given expiration
    // The bulk endpoint returns ALL contracts, not filtered
    const mockGreeks: OptionsGreeksData[] = [
      {
        strike: 5000,
        right: 'C',
        bid: 114.95,
        ask: 115.05,
        delta: 0.9988,
        theta: -0.0393,
        vega: 0.0708,
        rho: 0.7094,
        epsilon: -1.9697,
        lambda: 1.5629,
        impliedVolatility: 3.3828,
        ivError: 0,
        underlyingPrice: 5179.94,
        timestamp: new Date(),
      },
      {
        strike: 5000,
        right: 'P',
        bid: 0.95,
        ask: 1.05,
        delta: -0.002,
        theta: -0.0073,
        vega: 0.1624,
        rho: -0.0072,
        epsilon: 0.007,
        lambda: -37.8591,
        impliedVolatility: 0.6374,
        ivError: 0,
        underlyingPrice: 5179.94,
        timestamp: new Date(),
      },
      {
        strike: 5050,
        right: 'C',
        bid: 66.45,
        ask: 66.95,
        delta: 0.8547,
        theta: -0.1256,
        vega: 0.3456,
        rho: 0.5234,
        epsilon: -2.3456,
        lambda: 2.1234,
        impliedVolatility: 4.2345,
        ivError: 0,
        underlyingPrice: 5179.94,
        timestamp: new Date(),
      },
      {
        strike: 5050,
        right: 'P',
        bid: 2.85,
        ask: 2.95,
        delta: -0.1453,
        theta: -0.0234,
        vega: 0.3456,
        rho: -0.0234,
        epsilon: 0.0123,
        lambda: -25.3456,
        impliedVolatility: 0.8234,
        ivError: 0,
        underlyingPrice: 5179.94,
        timestamp: new Date(),
      },
      {
        strike: 5100,
        right: 'C',
        bid: 32.1,
        ask: 32.5,
        delta: 0.6234,
        theta: -0.2145,
        vega: 0.5678,
        rho: 0.3456,
        epsilon: -3.1234,
        lambda: 3.4567,
        impliedVolatility: 5.1234,
        ivError: 0,
        underlyingPrice: 5179.94,
        timestamp: new Date(),
      },
      {
        strike: 5100,
        right: 'P',
        bid: 12.3,
        ask: 12.6,
        delta: -0.3766,
        theta: -0.0567,
        vega: 0.5678,
        rho: -0.0456,
        epsilon: 0.0234,
        lambda: -18.2345,
        impliedVolatility: 1.0234,
        ivError: 0,
        underlyingPrice: 5179.94,
        timestamp: new Date(),
      },
    ]

    // Bulk endpoint returns all contracts for the expiration
    return Effect.succeed(mockGreeks as ReadonlyArray<OptionsGreeksData>)
  },
})
