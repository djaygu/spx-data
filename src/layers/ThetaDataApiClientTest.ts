import { Effect, Layer } from 'effect'
import { ThetaDataApiClient } from '../services/ThetaDataApiClient'
import { ApiConnectionError } from '../types/errors'

export const ThetaDataApiClientTest = Layer.succeed(ThetaDataApiClient, {
  get: <T>(endpoint: string, _params?: Record<string, string | number | boolean>) => {
    if (endpoint === '/v2/system/mdds/status') {
      return Effect.succeed({
        mdds: 'ready',
        streaming: true,
        uptime: 123456,
      } as T)
    }

    if (endpoint === '/v2/list/expirations') {
      return Effect.succeed(['2024-03-15', '2024-03-22', '2024-03-29'] as T)
    }

    if (endpoint === '/v2/list/contracts') {
      return Effect.succeed([
        {
          contract: 'O:SPX240315C5000',
          root: 'SPX',
          expiration: '2024-03-15',
          strike: 5000,
          right: 'C',
        },
        {
          contract: 'O:SPX240315P5000',
          root: 'SPX',
          expiration: '2024-03-15',
          strike: 5000,
          right: 'P',
        },
      ] as T)
    }

    return Effect.fail(
      new ApiConnectionError({
        message: `Unknown endpoint: ${endpoint}`,
        statusCode: 404,
        url: endpoint,
      }),
    )
  },

  checkConnection: () => Effect.succeed(true),
})
