import { Effect } from 'effect'
import { AppConfig } from '../config/AppConfig'
import { type BulkOptionsGreeksParams, ThetaDataApiClient } from '../services/ThetaDataApiClient'

/**
 * Example CLI command that downloads options Greeks data
 * Shows how to apply concurrency at the usage point
 */
export const downloadOptionsData = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  const config = yield* _(AppConfig)

  yield* _(Effect.log('Fetching available expirations...'))

  // Get all available expirations
  const expirations = yield* _(client.listExpirations())

  yield* _(Effect.log(`Found ${expirations.length} expirations`))

  // Filter to only near-term expirations (< 30 DTE)
  const nearTermExpirations = expirations.filter(
    (exp) => exp.daysToExpiration > 0 && exp.daysToExpiration <= config.download.maxDTE,
  )

  yield* _(Effect.log(`Downloading ${nearTermExpirations.length} near-term expirations...`))

  // Create requests for each expiration
  const downloadRequests = nearTermExpirations.map((exp) => {
    // Convert date from YYYY-MM-DD to YYYYMMDD
    const expDate = exp.date.replace(/-/g, '')

    const params: BulkOptionsGreeksParams = {
      root: 'SPXW',
      expiration: expDate,
      startDate: expDate,
      endDate: expDate,
      interval: 3600000, // 1 hour intervals
      rth: true,
    }

    return client.getBulkOptionsGreeks(params).pipe(
      Effect.tap((greeks) => Effect.log(`Downloaded ${greeks.length} Greeks for ${exp.date}`)),
      Effect.map((greeks) => ({
        expiration: exp.date,
        dte: exp.daysToExpiration,
        greeks,
      })),
    )
  })

  // APPLY CONCURRENCY CONTROL HERE
  // This ensures only 2 requests run simultaneously (by default)
  const results = yield* _(
    Effect.all(downloadRequests, {
      concurrency: config.thetaData.maxConcurrentRequests,
    }),
  )

  // Calculate total Greeks downloaded
  const totalGreeks = results.reduce((sum, r) => sum + r.greeks.length, 0)

  yield* _(Effect.log(`Download complete: ${totalGreeks} total Greeks data points`))

  return results
})

/**
 * Example with custom concurrency for different scenarios
 */
export const advancedDownload = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)

  // Scenario 1: High priority, low concurrency for production
  const productionDownload = (expirations: string[]) => {
    const requests = expirations.map((exp) => {
      const params: BulkOptionsGreeksParams = {
        root: 'SPXW',
        expiration: exp,
        startDate: exp,
        endDate: exp,
        interval: 60000, // 1 minute intervals
        rth: true,
      }
      return client.getBulkOptionsGreeks(params)
    })

    return Effect.all(requests, {
      concurrency: 1, // Sequential to be safe in production
    })
  }

  // Scenario 2: Batch processing with moderate concurrency
  const _batchDownload = (expirations: string[]) => {
    const requests = expirations.map((exp) => {
      const params: BulkOptionsGreeksParams = {
        root: 'SPXW',
        expiration: exp,
        startDate: exp,
        endDate: exp,
        interval: 3600000, // Hourly for batch
      }
      return client.getBulkOptionsGreeks(params)
    })

    return Effect.all(requests, {
      concurrency: 3, // Higher concurrency for batch jobs
    })
  }

  // Scenario 3: Development/testing with high concurrency
  const _testDownload = (expirations: string[]) => {
    const requests = expirations.map((exp) => {
      const params: BulkOptionsGreeksParams = {
        root: 'SPXW',
        expiration: exp,
        startDate: exp,
        endDate: exp,
        interval: 86400000, // Daily for testing
      }
      return client.getBulkOptionsGreeks(params)
    })

    return Effect.all(requests, {
      concurrency: 5, // Higher for testing
    })
  }

  // Choose based on environment or config
  const expirations = ['20240119', '20240126', '20240202']
  const results = yield* _(productionDownload(expirations))

  return results
})
