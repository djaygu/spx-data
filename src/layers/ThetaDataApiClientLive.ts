import { parse } from 'csv-parse/sync'
import { Effect, Layer, Random, Schedule } from 'effect'
import { AppConfig } from '../config/AppConfig'
import {
  type BulkOptionsGreeksParams,
  type ExpirationDate,
  type OptionsGreeksData,
  type TerminalStatus,
  ThetaDataApiClient,
  ThetaDataApiError,
  ThetaDataConnectionError,
  ThetaDataRateLimitError,
} from '../services/ThetaDataApiClient'

export const ThetaDataApiClientLive = Layer.effect(
  ThetaDataApiClient,
  Effect.gen(function* (_) {
    const config = yield* _(AppConfig)
    const baseUrl = config.thetaData.baseUrl
    // Concurrency control is managed at the usage level
    // When making multiple requests, consumers should use:
    // Effect.all(requests, { concurrency: config.thetaData.maxConcurrentRequests })
    const maxRetries = config.thetaData.maxRetries
    const retryBaseDelayMs = config.thetaData.retryBaseDelayMs
    const requestTimeoutMs = config.thetaData.requestTimeoutMs

    // Generate unique request IDs for tracing
    const generateRequestId = () =>
      Effect.gen(function* (_) {
        const timestamp = Date.now()
        const random = yield* _(Random.nextInt)
        return `req-${timestamp}-${random}`
      })

    // Retry policy with exponential backoff
    const retrySchedule = Schedule.exponential(retryBaseDelayMs, 2).pipe(
      Schedule.compose(Schedule.recurs(maxRetries - 1)),
    )

    // Check if an error is retryable
    const isRetryableError = (error: unknown): boolean => {
      if (error instanceof ThetaDataApiError) {
        // Retry on 5xx errors and specific 4xx errors
        return error.statusCode ? error.statusCode >= 500 || error.statusCode === 429 : false
      }
      if (error instanceof ThetaDataConnectionError) {
        // Always retry connection errors
        return true
      }
      return false
    }

    // Enhanced request function with logging, retry, and concurrency control
    const makeRequest = <T>(
      endpoint: string,
      params?: Record<string, string | number | boolean>,
      responseType: 'json' | 'text' = 'json',
    ): Effect.Effect<T, ThetaDataConnectionError | ThetaDataApiError | ThetaDataRateLimitError> =>
      Effect.gen(function* (_) {
        const requestId = yield* _(generateRequestId())

        // Log request
        yield* _(
          Effect.log(`[${requestId}] Starting request to ${endpoint}`, {
            level: 'Debug',
            params,
          }),
        )

        // Execute the request with proper error handling
        const startTime = Date.now()

        const result = yield* _(
          Effect.tryPromise({
            try: async () => {
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs)

              try {
                const url = new URL(endpoint, baseUrl)

                if (params) {
                  Object.entries(params).forEach(([key, value]) => {
                    url.searchParams.append(key, String(value))
                  })
                }

                const response = await fetch(url.toString(), {
                  signal: controller.signal,
                })

                clearTimeout(timeoutId)

                // Check for rate limiting
                if (response.status === 429) {
                  const retryAfter = response.headers.get('Retry-After')
                  throw new ThetaDataRateLimitError({
                    message: 'Rate limit exceeded',
                    retryAfter: retryAfter ? parseInt(retryAfter) * 1000 : 5000,
                  })
                }

                if (!response.ok) {
                  const errorText = await response.text().catch(() => 'No error details')
                  throw new ThetaDataApiError({
                    message: `HTTP ${response.status}: ${response.statusText}. ${errorText}`.trim(),
                    statusCode: response.status,
                    endpoint,
                  })
                }

                if (responseType === 'text') {
                  return (await response.text()) as T
                }

                return (await response.json()) as T
              } finally {
                clearTimeout(timeoutId)
              }
            },
            catch: (error) => {
              if (error instanceof ThetaDataRateLimitError || error instanceof ThetaDataApiError) {
                return error
              }

              // Handle connection errors
              const message =
                error instanceof Error
                  ? error.message
                  : 'Unknown error occurred while contacting ThetaData Terminal'

              return new ThetaDataConnectionError({
                message,
                cause: error,
              })
            },
          }).pipe(
            // Apply retry logic for retryable errors
            Effect.retry({
              schedule: retrySchedule,
              while: isRetryableError,
            }),
            // Log response
            Effect.tap((_response) => {
              const duration = Date.now() - startTime
              return Effect.log(`[${requestId}] Request completed in ${duration}ms`, {
                level: 'Debug',
                endpoint,
                duration,
              })
            }),
            // Log errors
            Effect.tapError((error) => {
              const duration = Date.now() - startTime
              return Effect.log(`[${requestId}] Request failed after ${duration}ms: ${error}`, {
                level: 'Warning',
                endpoint,
                duration,
                error,
              })
            }),
          ),
        )

        return result
      })

    return {
      healthCheck: () =>
        makeRequest<string>('/v2/system/mdds/status', undefined, 'text').pipe(
          Effect.map((statusText) => {
            const status = statusText.trim() as
              | 'CONNECTED'
              | 'UNVERIFIED'
              | 'DISCONNECTED'
              | 'ERROR'
            return {
              isConnected: status === 'CONNECTED',
              status,
              timestamp: new Date(),
            } as TerminalStatus
          }),
          Effect.catchTags({
            ThetaDataConnectionError: () =>
              Effect.succeed({
                isConnected: false,
                status: 'DISCONNECTED' as const,
                timestamp: new Date(),
              } as TerminalStatus),
            ThetaDataRateLimitError: () =>
              Effect.succeed({
                isConnected: false,
                status: 'ERROR' as const,
                timestamp: new Date(),
              } as TerminalStatus),
          }),
        ),

      listExpirations: () =>
        // The ThetaData API returns ALL expirations for the root
        makeRequest<{
          header: { format: string[] }
          response: number[] // Array of expiration dates in YYYYMMDD format as numbers
        }>('/v2/list/expirations', {
          root: 'SPXW',
        }).pipe(
          Effect.map((data) => {
            // Convert YYYYMMDD format to YYYY-MM-DD and calculate DTE
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            return data.response.map((expNum) => {
              // Convert number YYYYMMDD to string
              const expStr = String(expNum)
              // Convert YYYYMMDD to YYYY-MM-DD
              const year = expStr.substring(0, 4)
              const month = expStr.substring(4, 6)
              const day = expStr.substring(6, 8)
              const formattedDate = `${year}-${month}-${day}`

              // Calculate days to expiration
              const expDate = new Date(formattedDate)
              expDate.setHours(0, 0, 0, 0)
              const diffTime = expDate.getTime() - today.getTime()
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

              return {
                date: formattedDate,
                daysToExpiration: diffDays,
              }
            }) as ReadonlyArray<ExpirationDate>
          }),
        ),

      getBulkOptionsGreeks: (params: BulkOptionsGreeksParams) =>
        makeRequest<string>(
          '/v2/bulk_hist/option/greeks',
          {
            root: params.root,
            exp: params.expiration,
            start_date: params.startDate,
            end_date: params.endDate,
            ivl: params.interval ?? 0, // Default to tick-level data
            use_csv: true, // Always use CSV for efficiency
            ...(params.annualDiv !== undefined && { annual_div: params.annualDiv }),
            ...(params.rate && { rate: params.rate }),
            ...(params.rateValue !== undefined && { rate_value: params.rateValue }),
            ...(params.rth !== undefined && { rth: params.rth }),
            ...(params.startTime && { start_time: params.startTime }),
            ...(params.endTime && { end_time: params.endTime }),
          },
          'text', // Expect CSV text response
        ).pipe(
          Effect.map((csvData) => {
            // Define the expected columns based on actual ThetaData API response
            const columns = [
              'root',
              'expiration',
              'strike',
              'right',
              'ms_of_day',
              'bid',
              'ask',
              'delta',
              'theta',
              'vega',
              'rho',
              'epsilon',
              'lambda',
              'implied_vol',
              'iv_error',
              'ms_of_day2',
              'underlying_price',
              'date',
            ]

            // Parse CSV with strict validation
            const records: Record<string, string>[] = parse(csvData, {
              columns: columns,
              skip_empty_lines: true,
              from_line: csvData.startsWith('root') || csvData.startsWith('ms_of_day') ? 2 : 1, // Skip header if present
              cast: false, // We'll handle type conversion explicitly
              relax_column_count: false, // Enforce column count - fail on malformed data
              skip_records_with_error: false, // Don't silently skip bad records
            }) as Record<string, string>[]

            // Transform parsed records to OptionsGreeksData
            // Records are now plain objects with string values since cast:false
            const results: OptionsGreeksData[] = records.map(
              (row: Record<string, string>, index: number) => {
                // Validate critical fields exist
                if (!row.strike || !row.right) {
                  throw new Error(
                    `Missing critical fields at row ${index + 1}: strike=${row.strike}, right=${row.right}`,
                  )
                }

                // Validate right is C or P
                if (row.right !== 'C' && row.right !== 'P') {
                  throw new Error(`Invalid option right at row ${index + 1}: ${row.right}`)
                }

                // Convert date from YYYYMMDD to Date object
                const dateStr = String(row.date)
                const year = parseInt(dateStr.substring(0, 4))
                const month = parseInt(dateStr.substring(4, 6)) - 1
                const day = parseInt(dateStr.substring(6, 8))
                const date = new Date(year, month, day)

                // Add milliseconds of day to get exact timestamp
                const msOfDay = Number(row.ms_of_day)
                if (!Number.isNaN(msOfDay)) {
                  date.setMilliseconds(msOfDay)
                }

                // Convert all numeric fields, with NaN for invalid values
                const result = {
                  strike: Number(row.strike),
                  right: row.right as 'C' | 'P',
                  bid: Number(row.bid),
                  ask: Number(row.ask),
                  delta: Number(row.delta),
                  theta: Number(row.theta),
                  vega: Number(row.vega),
                  rho: Number(row.rho),
                  epsilon: Number(row.epsilon),
                  lambda: Number(row.lambda),
                  impliedVolatility: Number(row.implied_vol),
                  ivError: Number(row.iv_error),
                  underlyingPrice: Number(row.underlying_price),
                  timestamp: date,
                }

                // Validate we got valid numbers for critical fields
                if (Number.isNaN(result.strike)) {
                  throw new Error(`Invalid strike price at row ${index + 1}: ${row.strike}`)
                }

                return result
              },
            )

            return results as ReadonlyArray<OptionsGreeksData>
          }),
        ),
    }
  }),
)
