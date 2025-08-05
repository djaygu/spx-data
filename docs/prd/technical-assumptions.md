# Technical Assumptions

## Repository Structure: Single Repository

Single repository with organized source structure under `/src` directory, containing all modules (CLI, services, models) with clear separation of concerns. This enables atomic commits across the entire system and simplified dependency management.

## Service Architecture

**Effect-TS Service Layer Architecture** - Following Effect-TS best practices with Context.Tag for service identification, Layer composition for dependency injection, and proper separation between Live and Test implementations. Services will include:
- API Client Service (rate limiting, retry logic)
- Stream Processing Service (data transformation, validation)
- Storage Service (Parquet file operations)
- Progress Tracking Service (CLI feedback)

## Testing Requirements

**Strict Test-Driven Development (TDD)** - MANDATORY Red-Green-Refactor cycle for all development:
- Write failing tests first for each feature
- Implement minimal code to pass tests
- Refactor while keeping tests green
- Create Test layers for all Effect services
- Use Effect TestClock and TestRandom for deterministic testing
- Aim for high test coverage with focus on edge cases and error scenarios
- Use Bun test runner for faster test execution

## Additional Technical Assumptions and Requests

• **Runtime**: Bun for better performance, native SQLite support, and faster startup
• **Language & Framework**: TypeScript with strict mode, Effect-TS for all core functionality
• **Streaming Architecture**: Effect Streams for memory-efficient processing of 50K+ records/minute
• **Storage Format**: Apache Parquet via parquetjs with schema validation
• **CLI Framework**: Effect CLI for command parsing with proper error boundaries
• **HTTP Client**: Effect HTTP with built-in retry logic and exponential backoff
• **Configuration**: Effect Config module for environment variables and settings
• **Concurrency Control**: Configurable 2-4 parallel requests respecting ThetaData Terminal Standard tier limits
• **Error Handling**: Tagged errors (Data.TaggedError) for type-safe error handling
• **Resource Management**: Layer.scoped for proper cleanup of file handles and connections
• **Deployment**: Single binary bundle with all dependencies included
• **Observability**: Built-in progress tracking and resumable operation state
• **Development Tools**: Use MCP Context7 for library best practices verification
