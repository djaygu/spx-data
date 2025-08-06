# Effect.all() vs Stream.mapEffect() - Concurrency Comparison

## Quick Decision Guide

### Use `Effect.all()` when:
- ✅ You have a **fixed, known set** of operations
- ✅ You need **all results at once**
- ✅ The dataset fits **comfortably in memory**
- ✅ You want **simpler code** and error handling
- ✅ Operations are **relatively quick** (seconds, not minutes)

### Use `Stream.mapEffect()` when:
- ✅ You have a **large or unbounded** dataset
- ✅ You want to **process results as they arrive**
- ✅ You need **memory efficiency** (streaming)
- ✅ You want **backpressure** handling
- ✅ Operations are **long-running** or continuous

## Detailed Comparison

### Effect.all() - Batch Processing

```typescript
import { Effect } from 'effect'
import { ThetaDataApiClient } from '@/services/ThetaDataApiClient'

const batchFetch = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  
  const expirations = ['2024-01-19', '2024-01-26', '2024-02-02']
  
  // Create all requests
  const requests = expirations.map(exp => 
    client.getOptionsChain('2024-01-15', exp)
  )
  
  // Execute with concurrency
  const results = yield* _(
    Effect.all(requests, { concurrency: 2 })
  )
  
  // All results available at once
  return results // Array<OptionData[]>
})
```

**Pros:**
- ✅ Simple and straightforward
- ✅ All results available together for processing
- ✅ Easy error handling (fails fast by default)
- ✅ Good for small to medium datasets
- ✅ Type inference is excellent

**Cons:**
- ❌ Loads all results into memory at once
- ❌ Can't process results until all complete
- ❌ Not suitable for very large datasets
- ❌ No backpressure control

### Stream.mapEffect() - Streaming Processing

```typescript
import { Stream, Effect } from 'effect'
import { ThetaDataApiClient } from '@/services/ThetaDataApiClient'

const streamFetch = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  
  // Can handle large or infinite streams
  const expirationStream = Stream.fromIterable([
    '2024-01-19', '2024-01-26', '2024-02-02',
    // ... could be hundreds more
  ])
  
  const processedStream = expirationStream.pipe(
    Stream.mapEffect(
      (exp) => client.getOptionsChain('2024-01-15', exp),
      { concurrency: 2 }
    ),
    // Process results as they arrive
    Stream.tap(chains => 
      Effect.log(`Processed ${chains.length} options`)
    )
  )
  
  // Can process incrementally or collect all
  return yield* _(Stream.runCollect(processedStream))
})
```

**Pros:**
- ✅ Memory efficient - processes items incrementally
- ✅ Can handle infinite/large datasets
- ✅ Results available as they complete
- ✅ Built-in backpressure handling
- ✅ Composable with other stream operations

**Cons:**
- ❌ More complex API
- ❌ Overkill for small datasets
- ❌ Error handling can be more complex
- ❌ Slightly more overhead for small operations

## Real-World Recommendations

### For ThetaData API, use `Effect.all()` when:

```typescript
// ✅ RECOMMENDED: Fetching a day's worth of options (typically < 50 expirations)
const fetchDailyOptions = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  const config = yield* _(AppConfig)
  
  const expirations = yield* _(client.listExpirations('2024-01-15'))
  
  // Usually 10-30 expirations, perfect for Effect.all
  const requests = expirations
    .filter(exp => exp.daysToExpiration <= 30)
    .map(exp => client.getOptionsChain('2024-01-15', exp.date))
  
  return yield* _(
    Effect.all(requests, { 
      concurrency: config.thetaData.maxConcurrentRequests 
    })
  )
})
```

### For ThetaData API, use `Stream.mapEffect()` when:

```typescript
// ✅ RECOMMENDED: Processing historical data across many dates
const fetchHistoricalData = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  
  // 365 days of data - too much for memory at once
  const dates = generateTradingDays('2023-01-01', '2024-01-01')
  
  const dataStream = Stream.fromIterable(dates).pipe(
    Stream.mapEffect(
      (date) => client.listExpirations(date),
      { concurrency: 2 }
    ),
    Stream.flatMap(expirations => 
      Stream.fromIterable(expirations)
    ),
    Stream.mapEffect(
      (exp) => client.getOptionsChain(exp.date, exp.date),
      { concurrency: 2 }
    ),
    // Process and save incrementally
    Stream.tap(chains => saveToDatabase(chains))
  )
  
  return yield* _(Stream.runDrain(dataStream))
})
```

## Performance Comparison

```typescript
// Small dataset (< 100 items): Effect.all is faster
const small = ['2024-01-19', '2024-01-26', '2024-02-02']

// Effect.all - Simple and fast
Effect.all(small.map(fetchData), { concurrency: 2 }) // ~500ms

// Stream - Unnecessary overhead
Stream.fromIterable(small).pipe(
  Stream.mapEffect(fetchData, { concurrency: 2 }),
  Stream.runCollect
) // ~550ms

// Large dataset (> 1000 items): Stream is better
const large = generateThousandsOfDates()

// Effect.all - Uses too much memory
Effect.all(large.map(fetchData), { concurrency: 2 }) // ⚠️ High memory

// Stream - Memory efficient
Stream.fromIterable(large).pipe(
  Stream.mapEffect(fetchData, { concurrency: 2 }),
  Stream.runDrain
) // ✅ Constant memory
```

## Hybrid Approach

```typescript
// Best of both: Chunk large datasets and use Effect.all per chunk
const hybridFetch = Effect.gen(function* (_) {
  const client = yield* _(ThetaDataApiClient)
  
  const allExpirations = yield* _(client.listExpirations('2024-01-15'))
  
  // Process in chunks of 10
  const chunks = chunk(allExpirations, 10)
  
  for (const chunk of chunks) {
    // Use Effect.all for each small chunk
    const results = yield* _(
      Effect.all(
        chunk.map(exp => client.getOptionsChain('2024-01-15', exp.date)),
        { concurrency: 2 }
      )
    )
    
    // Process chunk results
    yield* _(processResults(results))
  }
})
```

## Summary Recommendation

For **ThetaDataApiClient** specifically:

1. **Default to `Effect.all()`** - Most common use cases involve fetching 10-50 items
2. **Use `Stream.mapEffect()`** only for:
   - Historical data processing (hundreds of dates)
   - Continuous monitoring/polling
   - When you need to process results incrementally
3. **Consider the hybrid approach** for medium-sized datasets (50-500 items)

The key insight: **Effect.all() is simpler and more appropriate for 90% of ThetaData API use cases**.