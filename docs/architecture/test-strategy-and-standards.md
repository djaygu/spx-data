# Test Strategy and Standards

## Testing Philosophy
- **Approach:** Strict Test-Driven Development (TDD) - Red, Green, Refactor
- **Coverage Goals:** 80% minimum, focus on critical paths and edge cases
- **Test Pyramid:** 70% unit tests, 20% integration tests, 10% e2e tests

## Test Types and Organization

### Unit Tests
- **Framework:** @effect/vitest 0.5.0
- **File Convention:** `{module}.test.ts` in `/test` directory
- **Location:** `/test/services/`, `/test/repositories/`, etc.
- **Mocking Library:** Effect Test layers (no external mocking needed)
- **Coverage Requirement:** 90% for services, 80% for utilities

**AI Agent Requirements:**
- Generate tests for all public methods
- Cover edge cases and error conditions
- Follow AAA pattern (Arrange, Act, Assert)
- Mock all external dependencies

### Integration Tests
- **Scope:** Service interactions, file system operations, JSON persistence
- **Location:** `/test/integration/`
- **Test Infrastructure:**
  - **File System:** Use temp directories via `Bun.file()`
  - **Time:** Use TestClock for time-dependent tests
  - **External APIs:** Use recorded responses or local mock server

### End-to-End Tests
- **Framework:** CLI testing via subprocess
- **Scope:** Full command execution
- **Environment:** Isolated test data directory
- **Test Data:** Mock ThetaData terminal responses

## Test Data Management
- **Strategy:** Builder pattern for test data, deterministic fixtures
- **Fixtures:** `/test/fixtures/` with sample CSV data
- **Factories:** Type-safe test data builders
- **Cleanup:** Automatic cleanup of test files using Effect.addFinalizer

## Continuous Testing
- **CI Integration:** All tests run on every commit via GitHub Actions
- **Performance Tests:** Benchmark stream processing speed
- **Security Tests:** Validate no secrets in logs, proper file permissions

## Test Environment Setup

```typescript
export const TestEnvironmentLive = Layer.mergeAll(
  // Use test implementations
  ThetaDataApiClient.Test,
  StatusService.Test,
  InventoryService.Test,
  
  // Use real implementations for some services
  StreamProcessor.Live,
  ValidationService.Live,
  
  // Test-specific configuration
  Layer.succeed(AppConfig, {
    thetaData: { baseUrl: "http://localhost:25510" },
    download: { maxDTE: 30, concurrentExpirations: 2 },
    storage: { dataDirectory: "./test-data" }
  }),
  
  // Test utilities
  TestClock.layer,
  TestRandom.layer
)
```
