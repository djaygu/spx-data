import { Schema } from '@effect/schema'
import { Config } from 'effect'

// Configuration schema
const ConfigSchema = Schema.Struct({
  thetaData: Schema.Struct({
    baseUrl: Schema.String,
    maxConcurrentRequests: Schema.Number,
    maxRetries: Schema.Number,
    retryBaseDelayMs: Schema.Number,
    requestTimeoutMs: Schema.Number,
  }),
  download: Schema.Struct({
    maxDTE: Schema.Number,
  }),
  storage: Schema.Struct({
    dataDirectory: Schema.String,
  }),
})

export type AppConfig = Schema.Schema.Type<typeof ConfigSchema>

// Config service using Effect Config module
export const AppConfig = Config.all({
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
})
