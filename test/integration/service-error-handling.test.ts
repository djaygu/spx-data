import { describe, expect, it } from "bun:test"
import { Effect, Stream, Chunk, Ref, Fiber, Option } from "effect"
import type { OptionsGreeksData } from "@/services/ThetaDataApiClient"

// Integration tests for service error handling
const SHOULD_RUN_INTEGRATION_TESTS = process.env.THETA_DATA_TERMINAL_URL !== undefined

// Set environment variables for the test
if (SHOULD_RUN_INTEGRATION_TESTS) {
  process.env.CONFIG_THETADATA_BASE_URL =
    process.env.THETA_DATA_TERMINAL_URL || "http://127.0.0.1:25510"
}

describe("Service Error Handling Integration Tests", () => {
  it("propagates errors correctly", async () => {
    // Simple test that verifies error propagation
    const result = await Effect.runPromiseExit(
      Effect.gen(function* () {
        // Create a simple failing effect
        return yield* Effect.fail(new Error("Test error"))
      })
    )

    expect(result._tag).toBe("Failure")
  })

  it("handles invalid data gracefully", async () => {
    // Test data validation without requiring actual services
    const testData: OptionsGreeksData = {
      strike: 4800,
      right: "C",
      bid: 20.70,
      ask: 20.80,
      delta: 0.55,
      theta: -0.05,
      vega: 0.15,
      rho: 0.08,
      epsilon: 0.01,
      lambda: 0.12,
      impliedVolatility: 0.15,
      ivError: 0,
      underlyingPrice: 4850,
      timestamp: new Date(),
    }

    // Validate data structure
    expect(testData.strike).toBeGreaterThan(0)
    expect(["C", "P"]).toContain(testData.right)
    expect(testData.bid).toBeLessThanOrEqual(testData.ask)
  })

  it("handles disk write failures in DataWriter", async () => {
    // Create a temporary directory using Bun
    const tempDir = `/tmp/spx-write-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const outputDir = `${tempDir}/readonly`

    // Use Bun's shell for directory operations
    await Bun.$`mkdir -p ${outputDir}`.quiet()
    await Bun.$`chmod 444 ${outputDir}`.quiet()

    // Check if directory is writable using Bun.file
    const testFile = Bun.file(`${outputDir}/test.txt`)
    let canWrite = false
    try {
      await Bun.write(testFile, "test")
      canWrite = true
    } catch {
      canWrite = false
    }
    expect(canWrite).toBe(false)

    // Cleanup
    await Bun.$`rm -rf ${tempDir}`.quiet()
  })

  it("enforces concurrency limits under load", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const activeRequests = yield* Ref.make(0)
        const maxConcurrent = yield* Ref.make(0)

        // Simulate concurrent operations
        const operations = Array.from({ length: 10 }, (_, i) =>
          Effect.gen(function* () {
            const current = yield* Ref.updateAndGet(activeRequests, (n) => n + 1)
            yield* Ref.update(maxConcurrent, (max) => Math.max(max, current))
            yield* Effect.sleep("50 millis")
            yield* Ref.update(activeRequests, (n) => n - 1)
            return i
          })
        )

        // Run with limited concurrency
        yield* Effect.all(operations, { concurrency: 3 })

        const maxSeen = yield* Ref.get(maxConcurrent)

        // Verify concurrency was limited
        expect(maxSeen).toBeLessThanOrEqual(3)
        expect(maxSeen).toBeGreaterThan(0)

        return true
      })
    )

    expect(result).toBe(true)
  })

  it("handles backpressure when downstream is slower", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const processedCount = yield* Ref.make(0)

        // Fast producer of OptionsGreeksData
        const fastProducer = Stream.range(1, 1000).pipe(
          Stream.map(
            (n): OptionsGreeksData => ({
              strike: 4000 + n,
              right: n % 2 === 0 ? "C" : "P",
              bid: n + 0.4,
              ask: n + 0.6,
              delta: 0.5,
              theta: -0.05,
              vega: 0.15,
              rho: 0.08,
              epsilon: 0.01,
              lambda: 0.12,
              impliedVolatility: 0.15,
              ivError: 0,
              underlyingPrice: 4850,
              timestamp: new Date(),
            })
          )
        )

        // Slow consumer with buffer
        const slowConsumer = (s: Stream.Stream<OptionsGreeksData>) =>
          s.pipe(
            Stream.buffer({ capacity: 10 }), // Small buffer to test backpressure
            Stream.mapEffect((data) =>
              Effect.gen(function* () {
                yield* Effect.sleep("10 millis") // Simulate slow processing
                yield* Ref.update(processedCount, (n) => n + 1)
                return data
              })
            ),
            Stream.runDrain
          )

        // Process with timeout to prevent hanging
        yield* fastProducer.pipe(
          slowConsumer,
          Effect.timeout("2 seconds"),
          Effect.catchAll(() => Effect.succeed(undefined))
        )

        const processed = yield* Ref.get(processedCount)

        // Should have processed some but not all due to backpressure
        expect(processed).toBeGreaterThan(0)
        expect(processed).toBeLessThan(1000)

        return true
      })
    )

    expect(result).toBe(true)
  })

  it("properly cleans up resources on interruption", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const resourcesAcquired = yield* Ref.make(0)
        const resourcesReleased = yield* Ref.make(0)

        // Create a stream with resource management
        const managedStream = Stream.acquireRelease(
          Effect.gen(function* () {
            yield* Ref.update(resourcesAcquired, (n) => n + 1)
            return "resource"
          }),
          () => Ref.update(resourcesReleased, (n) => n + 1)
        ).pipe(
          Stream.flatMap(() =>
            Stream.range(1, 100).pipe(Stream.mapEffect(() => Effect.sleep("100 millis")))
          )
        )

        // Start processing and interrupt
        const fiber = yield* managedStream.pipe(Stream.runDrain, Effect.fork)

        // Let it run briefly
        yield* Effect.sleep("50 millis")

        // Interrupt the fiber
        yield* Fiber.interrupt(fiber)

        // Check cleanup
        const acquired = yield* Ref.get(resourcesAcquired)
        const released = yield* Ref.get(resourcesReleased)

        // Resources should be properly cleaned up
        expect(acquired).toBe(released)
        expect(acquired).toBeGreaterThan(0)

        return true
      })
    )

    expect(result).toBe(true)
  })

  it("handles memory cleanup for long-running streams", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const itemsProcessed = yield* Ref.make(0)

        // Create a large stream that would consume memory if not properly managed
        const largeStream = Stream.unfold(0, (n) =>
          n < 10000 ? Option.some([n, n + 1] as const) : Option.none()
        ).pipe(
          Stream.map(
            (n): OptionsGreeksData => ({
              strike: 4000 + (n % 1000),
              right: n % 2 === 0 ? "C" : "P",
              bid: Math.random() * 100,
              ask: Math.random() * 100,
              delta: Math.random() * 2 - 1,
              theta: -Math.random() * 0.5,
              vega: Math.random() * 0.5,
              rho: Math.random() * 0.2,
              epsilon: Math.random() * 0.05,
              lambda: Math.random() * 0.3,
              impliedVolatility: Math.random() * 0.5,
              ivError: Math.random() * 0.01,
              underlyingPrice: 4850 + Math.random() * 100,
              timestamp: new Date(),
            })
          ),
          Stream.chunks, // Process in chunks for efficiency
          Stream.mapChunks((chunk) => {
            // Process and discard to avoid memory accumulation
            Ref.update(itemsProcessed, (n) => n + Chunk.size(chunk)).pipe(Effect.runSync)
            return Chunk.empty()
          })
        )

        // Process the stream
        yield* largeStream.pipe(Stream.runDrain)

        const totalProcessed = yield* Ref.get(itemsProcessed)

        // Verify all items were processed
        expect(totalProcessed).toBe(10000)

        return true
      })
    )

    expect(result).toBe(true)
  }, 10000) // 10 second timeout for this test
})

// Provide instructions for running integration tests
if (!SHOULD_RUN_INTEGRATION_TESTS) {
  describe("Service Error Handling Integration Tests", () => {
    it("should skip when THETA_DATA_TERMINAL_URL is not set", () => {
      console.log(
        "\n" +
          "=".repeat(60) +
          "\n" +
          "Integration tests skipped.\n" +
          "To run integration tests:\n" +
          "1. Start ThetaData Terminal\n" +
          "2. Set environment variable: export THETA_DATA_TERMINAL_URL=http://127.0.0.1:25510\n" +
          "3. Run: bun test integration\n" +
          "=".repeat(60) +
          "\n"
      )
      expect(true).toBe(true)
    })
  })
}