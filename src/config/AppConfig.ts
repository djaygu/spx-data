import { Schema } from '@effect/schema'
import { Config } from 'effect'

// Configuration schema
const ConfigSchema = Schema.Struct({
  thetaData: Schema.Struct({
    baseUrl: Schema.String,
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
  }),
  download: Config.all({
    maxDTE: Config.number('CONFIG_DOWNLOAD_MAX_DTE').pipe(Config.withDefault(60)),
  }),
  storage: Config.all({
    dataDirectory: Config.string('CONFIG_STORAGE_DATA_DIRECTORY').pipe(
      Config.withDefault('./data'),
    ),
  }),
})
