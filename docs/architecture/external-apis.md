# External APIs

## ThetaData Terminal API
- **Purpose:** Primary data source for SPX options data including historical quotes, greeks, and open interest with 1-minute granularity
- **Documentation:** https://http-docs.thetadata.us/docs/http/introduction
- **Base URL(s):** http://127.0.0.1:25510
- **Authentication:** No authentication required (local terminal handles auth)
- **Rate Limits:** Standard tier: 20 requests/second, 40 concurrent connections

**Key Endpoints Used:**
- Base URL + Endpoint
- `GET /v2/list/expirations` - Get available expiration dates for SPX
- `GET /v2/bulk_hist/option/greeks` - Bulk historical first-order quotes with greeks (Delta, Gamma, Theta, Vega, Rho) with 1-minute granularity
- `GET /v2/system/mdds/status` - health check returns 'CONNECTED'

**Integration Notes:** 
- Terminal must be running locally before CLI can fetch data
- CSV format responses for efficient streaming
- Supports 1-minute tick data granularity for intraday analysis
- Batch requests by expiration (all strikes included automatically)
- All bulk endpoints support `root` and `exp` parameters for filtering
- Historical data requires `start_date` and `end_date` in YYYYMMDD format

## Example Request Patterns

```typescript
// Get all expirations for SPXW
const getExpirations = () =>
  httpClient.get("/v2/list/expirations", {
    params: {
      root: "SPXW"  // Weekly SPX options
    }
  })

// Get all greeks for one expiration on trade date (1-minute ticks)
const getBulkGreeksForExpiration = (tradeDate: Date, expiration: string) =>
  httpClient.get("/v2/bulk_hist/option/greeks", {
    params: {
      root: "SPXW",
      exp: expiration,  // e.g., "20240115"
      start_date: format(tradeDate, "yyyyMMdd"),
      end_date: format(tradeDate, "yyyyMMdd"),
      ivl: 60000,  // 1-minute intervals in milliseconds
      format: "csv"
    }
  })
```

**Error Handling Considerations:**
- Terminal not running: Connection refused errors
- Invalid dates: 404 responses
- Rate limit exceeded: 429 responses with retry-after header
- No data available: Empty CSV response
- Missing expirations: Some expirations may not have data

**Data Processing Notes:**
- 1-minute data means ~390 data points per trading day per strike
- Greeks calculations are based on the model used by ThetaData
- Bulk endpoints return all strikes for an expiration in a single CSV response
- Time stamps are in milliseconds since epoch
