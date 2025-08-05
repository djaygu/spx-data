# Error Handling Strategy

## General Approach
- **Error Model:** Effect-TS tagged errors for type-safe error handling
- **Exception Hierarchy:** Tagged error classes extending `Data.TaggedError`
- **Error Propagation:** Errors bubble up through Effect chains with proper typing

## Logging Standards
- **Library:** @effect/platform Logger (built into Effect)
- **Format:** Structured JSON logs with contextual information
- **Levels:** `trace | debug | info | warn | error | fatal`
- **Required Context:**
  - Correlation ID: Trade date + timestamp for request tracking
  - Service Context: Which service/operation generated the log
  - User Context: Command being executed, parameters

## Error Handling Patterns

### External API Errors
- **Retry Policy:** Exponential backoff with jitter (1s, 2s, 4s, max 3 attempts)
- **Circuit Breaker:** Opens after 5 consecutive failures, half-open after 30s
- **Timeout Configuration:** 30s for bulk data requests, 5s for list operations
- **Error Translation:** Map HTTP status codes to domain errors

### Business Logic Errors
- **Custom Exceptions:** Domain-specific error types
- **User-Facing Errors:** Clear messages without technical details
- **Error Codes:** Structured codes for common issues

### Data Consistency
- **Transaction Strategy:** File operations are atomic (write to temp, then rename)
- **Compensation Logic:** Clean up partial files on failure
- **Idempotency:** Re-running commands is safe, checks existing files
