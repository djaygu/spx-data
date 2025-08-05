import { Context, type Effect } from 'effect'
import type { ApiConnectionError } from '../types/errors'

export interface ThetaDataApiClientService {
  readonly get: <T>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
  ) => Effect.Effect<T, ApiConnectionError>

  readonly checkConnection: () => Effect.Effect<boolean, ApiConnectionError>
}

export const ThetaDataApiClient =
  Context.GenericTag<ThetaDataApiClientService>('ThetaDataApiClient')
