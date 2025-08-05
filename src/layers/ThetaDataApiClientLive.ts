import { Effect, Layer } from 'effect'
import { AppConfig } from '../config/AppConfig'
import { ThetaDataApiClient } from '../services/ThetaDataApiClient'
import { ApiConnectionError } from '../types/errors'

export const ThetaDataApiClientLive = Layer.effect(
  ThetaDataApiClient,
  Effect.gen(function* (_) {
    const config = yield* _(AppConfig)
    const baseUrl = config.thetaData.baseUrl

    const makeRequest = <T>(
      endpoint: string,
      params?: Record<string, string | number | boolean>,
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
      get: makeRequest,

      checkConnection: () =>
        makeRequest<{ mdds: string }>('/v2/system/mdds/status').pipe(
          Effect.map(() => true),
          Effect.catchAll(() => Effect.succeed(false)),
        ),
    }
  }),
)
