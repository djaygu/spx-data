# ThetaDataApiClient Concurrency Control Examples

## Usage-Level Concurrency Pattern

The ThetaDataApiClient implements **usage-level concurrency control**, allowing consumers to manage concurrency based on their specific needs.

## Basic Usage

```typescript
import { Effect } from 'effect'
import { ThetaDataApiClient } from '@/services/ThetaDataApiClient'
import { AppConfig } from '@/config/AppConfig'

// Example: Fetch multiple options chains with controlled concurrency
const fetchMultipleChains = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  const config = yield* _(AppConfig)
  
  const tradeDate = '2024-01-15'
  const expirations = ['2024-01-19', '2024-01-26', '2024-02-02']
  
  // Create array of requests
  const requests = expirations.map(exp => 
    client.getOptionsChain(tradeDate, exp)
  )
  
  // Apply concurrency control at usage point
  const results = yield* _(
    Effect.all(requests, { 
      concurrency: config.thetaData.maxConcurrentRequests // Default: 2
    })
  )
  
  return results
})
```

## Advanced Patterns

### Different Concurrency for Different Operations

```typescript
const complexDataFetch = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  
  // High concurrency for lightweight operations
  const expirations = yield* _(client.listExpirations('2024-01-15'))
  
  // Lower concurrency for heavy data operations
  const chainRequests = expirations.map(exp => 
    client.getOptionsChain('2024-01-15', exp.date)
  )
  
  const chains = yield* _(
    Effect.all(chainRequests, { 
      concurrency: 2 // Limit heavy operations
    })
  )
  
  return chains
})
```

### Sequential Processing (No Concurrency)

```typescript
const sequentialProcessing = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  const expirations = ['2024-01-19', '2024-01-26']
  
  const results = []
  for (const exp of expirations) {
    const chain = yield* _(client.getOptionsChain('2024-01-15', exp))
    results.push(chain)
  }
  
  return results
})
```

### Batched Processing

```typescript
import { Chunk, pipe } from 'effect'

const batchedProcessing = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  const allExpirations = yield* _(client.listExpirations('2024-01-15'))
  
  // Process in batches of 5 with concurrency of 2
  const batches = Chunk.chunksOf(allExpirations, 5)
  
  const results = []
  for (const batch of batches) {
    const batchRequests = batch.map(exp => 
      client.getOptionsChain('2024-01-15', exp.date)
    )
    
    const batchResults = yield* _(
      Effect.all(batchRequests, { concurrency: 2 })
    )
    
    results.push(...batchResults)
  }
  
  return results
})
```

## Benefits of Usage-Level Concurrency

1. **Flexibility**: Different operations can use different concurrency limits
2. **Explicitness**: Concurrency control is visible and intentional
3. **No Hidden Behavior**: Service doesn't impose unexpected limits
4. **Composability**: Works seamlessly with Effect's operators
5. **Zero Overhead**: No performance cost when concurrency isn't needed

## Configuration

The recommended concurrency limit is available in `AppConfig`:

```typescript
// Access configuration
const config = yield* _(AppConfig)
const maxConcurrent = config.thetaData.maxConcurrentRequests // Default: 2

// Environment variable override
CONFIG_THETADATA_MAX_CONCURRENT_REQUESTS=4 npm run app
```

## Testing Concurrency

```typescript
import { TestClock } from 'effect'

test('respects concurrency limits', () => 
  Effect.gen(function* (_) {
    const client = yield* _(ThetaDataApiClient)
    
    // Create 10 requests
    const requests = Array.from({ length: 10 }, (_, i) => 
      client.getOptionsChain('2024-01-15', `2024-01-${19 + i}`)
    )
    
    // Track concurrent executions
    const fiber = yield* _(
      Effect.all(requests, { concurrency: 2 }).pipe(
        Effect.fork
      )
    )
    
    // Verify only 2 requests execute simultaneously
    // ... test implementation
  })
)
```