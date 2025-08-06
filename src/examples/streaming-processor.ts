import { Chunk, Effect, Schedule, Stream } from 'effect'
import { AppConfig } from '../config/AppConfig'
import { type BulkOptionsGreeksParams, ThetaDataApiClient } from '../services/ThetaDataApiClient'

/**
 * Example of using concurrency with streaming data processing
 */
export const streamingOptionsProcessor = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  const config = yield* _(AppConfig)

  // Create a stream of expiration dates to process
  const expirationStream = Stream.fromIterable([
    '20240119',
    '20240126',
    '20240202',
    '20240209',
    '20240216',
  ])

  // Process the stream with concurrency control
  const processedStream = expirationStream.pipe(
    // Map each expiration to a fetch effect
    Stream.mapEffect(
      (expiration) => {
        const params: BulkOptionsGreeksParams = {
          root: 'SPXW',
          expiration,
          startDate: expiration,
          endDate: expiration,
          interval: 3600000, // Hourly
          rth: true,
        }

        return client.getBulkOptionsGreeks(params).pipe(
          Effect.map((greeks) => ({
            expiration,
            greeksCount: greeks.length,
            avgImpliedVol: greeks.reduce((sum, g) => sum + g.impliedVolatility, 0) / greeks.length,
            strikes: new Set(greeks.map((g) => g.strike)).size,
          })),
        )
      },
      // CONCURRENCY APPLIED AT STREAM LEVEL
      { concurrency: config.thetaData.maxConcurrentRequests },
    ),
    // Add logging for each processed item
    Stream.tap((result) =>
      Effect.log(
        `Processed ${result.expiration}: ${result.greeksCount} Greeks, ` +
          `${result.strikes} unique strikes, avg IV: ${result.avgImpliedVol.toFixed(4)}`,
      ),
    ),
  )

  // Run the stream and collect results
  const results = yield* _(Stream.runCollect(processedStream))

  return Chunk.toReadonlyArray(results)
})

/**
 * Example of batched streaming with concurrency
 */
export const batchedStreamProcessor = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  const config = yield* _(AppConfig)

  // Get all expirations
  const expirations = yield* _(client.listExpirations())

  // Filter to future expirations only
  const futureExpirations = expirations.filter((exp) => exp.daysToExpiration > 0)

  // Create a stream and process in batches
  const batchSize = 5
  const results = yield* _(
    Stream.fromIterable(futureExpirations).pipe(
      // Group into batches
      Stream.grouped(batchSize),
      // Process each batch with concurrency
      Stream.mapEffect((batch) => {
        const requests = Chunk.toReadonlyArray(batch).map((exp) => {
          // Convert date from YYYY-MM-DD to YYYYMMDD
          const expDate = exp.date.replace(/-/g, '')

          const params: BulkOptionsGreeksParams = {
            root: 'SPXW',
            expiration: expDate,
            startDate: expDate,
            endDate: expDate,
            interval: 3600000, // Hourly
            rth: true,
          }

          return client.getBulkOptionsGreeks(params).pipe(
            Effect.map((greeks) => ({
              expiration: exp.date,
              dte: exp.daysToExpiration,
              greeks,
            })),
          )
        })

        // Apply concurrency within each batch
        return Effect.all(requests, {
          concurrency: config.thetaData.maxConcurrentRequests,
        })
      }),
      // Flatten the batches
      Stream.flatMap(Stream.fromIterable),
      // Collect all results
      Stream.runCollect,
    ),
  )

  return Chunk.toReadonlyArray(results)
})

/**
 * Example of continuous polling with concurrency control
 */
export const continuousPoller = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  const config = yield* _(AppConfig)

  // Poll for updates every 5 minutes
  const pollSchedule = Schedule.fixed('5 minutes')

  const pollOnce = Effect.gen(function* (_) {
    const expirations = yield* _(client.listExpirations())

    // Only fetch the nearest 3 future expirations
    const nearExpirations = expirations
      .filter((exp) => exp.daysToExpiration > 0 && exp.daysToExpiration <= 7)
      .slice(0, 3)

    const requests = nearExpirations.map((exp) => {
      const expDate = exp.date.replace(/-/g, '')

      const params: BulkOptionsGreeksParams = {
        root: 'SPXW',
        expiration: expDate,
        startDate: expDate,
        endDate: expDate,
        interval: 3600000, // Hourly
        rth: true,
      }

      return client.getBulkOptionsGreeks(params)
    })

    // Fetch with concurrency control
    const greeksData = yield* _(
      Effect.all(requests, {
        concurrency: config.thetaData.maxConcurrentRequests,
      }),
    )

    return {
      timestamp: new Date(),
      expirationCount: nearExpirations.length,
      totalGreeks: greeksData.reduce((sum, g) => sum + g.length, 0),
    }
  })

  // Run the polling loop
  yield* _(
    pollOnce.pipe(
      Effect.repeat(pollSchedule),
      Effect.tap((result) =>
        Effect.log(
          `Poll at ${result.timestamp.toISOString()}: ` +
            `${result.totalGreeks} Greeks across ${result.expirationCount} expirations`,
        ),
      ),
    ),
  )
})
