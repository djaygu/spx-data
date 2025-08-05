import { Context, type Effect } from 'effect'
import type { ApiConnectionError } from '../types/errors'

export interface BulkGreeksParams {
  root: string
  exp: string
  start_date: string
  end_date: string
  ivl?: number
  format?: 'csv' | 'json'
}

export interface ThetaDataApiClientService {
  /**
   * Get available expiration dates for a given root symbol
   */
  readonly getExpirations: (root: string) => Effect.Effect<readonly string[], ApiConnectionError>

  /**
   * Get bulk historical option greeks data for a specific expiration
   */
  readonly getBulkGreeks: (params: BulkGreeksParams) => Effect.Effect<string, ApiConnectionError>

  /**
   * Check if the terminal is connected (returns true if status is 'CONNECTED')
   */
  readonly checkConnection: () => Effect.Effect<boolean, ApiConnectionError>
}

export const ThetaDataApiClient =
  Context.GenericTag<ThetaDataApiClientService>('ThetaDataApiClient')
