import { Effect, Layer } from 'effect'
import { AppConfig } from '../config/AppConfig'
import { type BulkGreeksParams, ThetaDataApiClient } from '../services/ThetaDataApiClient'
import { ApiConnectionError } from '../types/errors'

export const ThetaDataApiClientLive = Layer.effect(
  ThetaDataApiClient,
  Effect.gen(function* (_) {
    const config = yield* _(AppConfig)
    const baseUrl = config.thetaData.baseUrl

    const makeRequest = <T>(
      endpoint: string,
      params?: Record<string, string | number | boolean>,
      responseType: 'json' | 'text' = 'json',
    ): Effect.Effect<T, ApiConnectionError> =>
      Effect.tryPromise({
        try: async () => {
          const url = new URL(endpoint, baseUrl)

          if (params) {
            Object.entries(params).forEach(([key, value]) => {
              url.searchParams.append(key, String(value))
            })
          }

          const response = await fetch(url.toString())

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          if (responseType === 'text') {
            return (await response.text()) as T
          }

          return (await response.json()) as T
        },
        catch: (error) =>
          new ApiConnectionError({
            message: error instanceof Error ? error.message : 'Unknown error',
            statusCode: error instanceof Response ? error.status : undefined,
            url: endpoint,
          }),
      })

    return {
      getExpirations: (root: string) =>
        makeRequest<readonly string[]>('/v2/list/expirations', { root }),

      getBulkGreeks: (params: BulkGreeksParams) =>
        makeRequest<string>(
          '/v2/bulk_hist/option/greeks',
          {
            root: params.root,
            exp: params.exp,
            start_date: params.start_date,
            end_date: params.end_date,
            ivl: params.ivl ?? 60000, // Default to 1-minute intervals
            format: params.format ?? 'csv',
          },
          params.format === 'csv' ? 'text' : 'json',
        ),

      checkConnection: () =>
        makeRequest<string>('/v2/system/mdds/status', undefined, 'text').pipe(
          Effect.map((status) => status.trim() === 'CONNECTED'),
          Effect.catchAll(() => Effect.succeed(false)),
        ),
    }
  }),
)
