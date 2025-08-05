import { describe, expect, it } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { AppConfig } from '@/config/AppConfig'

describe('AppConfig', () => {
  it('should load default configuration', async () => {
    const config = await Effect.runPromise(
      Effect.gen(function* (_) {
        return yield* _(AppConfig)
      }).pipe(Effect.withConfigProvider(ConfigProvider.fromMap(new Map()))),
    )

    expect(config).toEqual({
      thetaData: {
        baseUrl: 'http://127.0.0.1:25510',
      },
      download: {
        maxDTE: 60,
      },
      storage: {
        dataDirectory: './data',
      },
    })
  })

  it('should load configuration from environment variables', async () => {
    const config = await Effect.runPromise(
      Effect.gen(function* (_) {
        return yield* _(AppConfig)
      }).pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ['CONFIG_THETADATA_BASE_URL', 'http://localhost:8080'],
              ['CONFIG_DOWNLOAD_MAX_DTE', '90'],
              ['CONFIG_STORAGE_DATA_DIRECTORY', '/tmp/data'],
            ]),
          ),
        ),
      ),
    )

    expect(config).toEqual({
      thetaData: {
        baseUrl: 'http://localhost:8080',
      },
      download: {
        maxDTE: 90,
      },
      storage: {
        dataDirectory: '/tmp/data',
      },
    })
  })
})
