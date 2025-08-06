import { Context, Data, type Effect } from 'effect'

// Error types for ThetaData API operations
export class ThetaDataConnectionError extends Data.TaggedError('ThetaDataConnectionError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ThetaDataApiError extends Data.TaggedError('ThetaDataApiError')<{
  readonly message: string
  readonly statusCode?: number
  readonly endpoint?: string
}> {}

export class ThetaDataRateLimitError extends Data.TaggedError('ThetaDataRateLimitError')<{
  readonly message: string
  readonly retryAfter?: number
}> {}

// Domain models for ThetaData responses
export interface TerminalStatus {
  readonly isConnected: boolean
  readonly status: 'CONNECTED' | 'UNVERIFIED' | 'DISCONNECTED' | 'ERROR'
  readonly timestamp: Date
}

export interface ExpirationDate {
  readonly date: string
  readonly daysToExpiration: number
}

// Parameters for bulk options Greeks data
export interface BulkOptionsGreeksParams {
  root: string // Symbol of the security (e.g., 'SPXW')
  expiration: string // YYYYMMDD format
  startDate: string // YYYYMMDD format
  endDate: string // YYYYMMDD format
  interval?: number // Interval in milliseconds (default: 0 for tick-level)
  annualDiv?: number // Annualized expected dividend amount
  rate?:
    | 'SOFR'
    | 'TREASURY_M1'
    | 'TREASURY_M3'
    | 'TREASURY_M6'
    | 'TREASURY_Y1'
    | 'TREASURY_Y2'
    | 'TREASURY_Y3'
    | 'TREASURY_Y5'
    | 'TREASURY_Y7'
    | 'TREASURY_Y10'
    | 'TREASURY_Y20'
    | 'TREASURY_Y30' // Interest rate type
  rateValue?: number // Annualized interest rate (e.g., 0.0342 for 3.42%)
  rth?: boolean // Regular trading hours only (default: true)
  startTime?: string // Milliseconds since midnight ET
  endTime?: string // Milliseconds since midnight ET
}

export interface OptionsGreeksData {
  strike: number
  right: 'C' | 'P'
  bid: number
  ask: number
  delta: number
  theta: number
  vega: number
  rho: number
  epsilon: number
  lambda: number
  impliedVolatility: number
  ivError: number
  underlyingPrice: number
  timestamp: Date
}

export interface ThetaDataApiClientService {
  /**
   * Check terminal health and connection status
   */
  readonly healthCheck: () => Effect.Effect<
    TerminalStatus,
    ThetaDataConnectionError | ThetaDataApiError
  >

  /**
   * List available expiration dates for SPXW
   * Note: Returns all available expirations, not filtered by trade date
   */
  readonly listExpirations: () => Effect.Effect<
    ReadonlyArray<ExpirationDate>,
    ThetaDataConnectionError | ThetaDataApiError | ThetaDataRateLimitError
  >

  /**
   * Get bulk historical option Greeks data for a specific expiration
   * Uses the bulk_hist/option/greeks endpoint for efficient batch retrieval
   */
  readonly getBulkOptionsGreeks: (
    params: BulkOptionsGreeksParams,
  ) => Effect.Effect<
    ReadonlyArray<OptionsGreeksData>,
    ThetaDataConnectionError | ThetaDataApiError | ThetaDataRateLimitError
  >
}

export const ThetaDataApiClient =
  Context.GenericTag<ThetaDataApiClientService>('ThetaDataApiClient')
