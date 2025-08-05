import { Effect, Layer } from 'effect'
import { type BulkGreeksParams, ThetaDataApiClient } from '../services/ThetaDataApiClient'
import { ApiConnectionError } from '../types/errors'

export const ThetaDataApiClientTest = Layer.succeed(ThetaDataApiClient, {
  getExpirations: (root: string) => {
    if (root === 'SPXW' || root === 'SPX') {
      return Effect.succeed(['2024-03-15', '2024-03-22', '2024-03-29'] as const)
    }
    return Effect.fail(
      new ApiConnectionError({
        message: `Unknown root symbol: ${root}`,
        statusCode: 404,
        url: '/v2/list/expirations',
      }),
    )
  },

  getBulkGreeks: (params: BulkGreeksParams) => {
    if (params.format === 'csv' || !params.format) {
      // Return CSV data matching actual ThetaData API format
      // Format: ms_of_day,bid,ask,delta,theta,vega,rho,epsilon,lambda,implied_vol,iv_error,ms_of_day2,underlying_price,date
      return Effect.succeed(
        'ms_of_day,bid,ask,delta,theta,vega,rho,epsilon,lambda,implied_vol,iv_error,ms_of_day2,underlying_price,date\n' +
          `34200000,114.95,115.05,0.9988,-0.0393,0.0708,0.7094,-1.9697,1.5629,3.3828,0,34200000,5179.94,${params.start_date}\n` +
          `34260000,115.05,115.2,0.9988,-0.0392,0.0705,0.7094,-1.971,1.5623,3.3828,0,34260000,5180.06,${params.start_date}`,
      )
    }
    // Return JSON format matching actual ThetaData API structure
    return Effect.succeed(
      JSON.stringify({
        header: {
          error_type: null,
          error_msg: null,
        },
        response: [
          {
            ticks: [
              [
                34200000, // ms_of_day
                114.95, // bid
                115.05, // ask
                0.9988, // delta
                -0.0393, // theta
                0.0708, // vega
                0.7094, // rho
                -1.9697, // epsilon
                1.5629, // lambda
                3.3828, // implied_vol
                0, // iv_error
                34200000, // ms_of_day2
                5179.94, // underlying_price
                parseInt(params.start_date), // date
              ],
              [
                34260000,
                115.05,
                115.2,
                0.9988,
                -0.0392,
                0.0705,
                0.7094,
                -1.971,
                1.5623,
                3.3828,
                0,
                34260000,
                5180.06,
                parseInt(params.start_date),
              ],
            ],
            contract: {
              root: params.root,
              expiration: parseInt(params.exp),
              strike: 5000,
              right: 'C',
            },
          },
          {
            ticks: [
              [
                34200000,
                0.95,
                1.05,
                -0.002,
                -0.0073,
                0.1624,
                -0.0072,
                0.007,
                -37.8591,
                0.6374,
                0,
                34200000,
                5179.94,
                parseInt(params.start_date),
              ],
              [
                34260000,
                1.0,
                1.1,
                -0.0021,
                -0.0074,
                0.1625,
                -0.0073,
                0.0071,
                -37.9,
                0.6375,
                0,
                34260000,
                5180.06,
                parseInt(params.start_date),
              ],
            ],
            contract: {
              root: params.root,
              expiration: parseInt(params.exp),
              strike: 5000,
              right: 'P',
            },
          },
        ],
      }),
    )
  },

  checkConnection: () => Effect.succeed(true),
})
