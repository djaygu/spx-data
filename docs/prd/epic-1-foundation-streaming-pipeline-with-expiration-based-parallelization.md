# Epic 1 Foundation & Streaming Pipeline with Expiration-Based Parallelization

**Goal**: Establish the core Effect-TS architecture with a working streaming pipeline that can download one day of SPX options data using parallel expiration-based processing. This epic delivers immediate value by enabling basic data downloads while proving the architecture handles memory constraints and API rate limits effectively.

## Story 1.1 Project Setup and Core Architecture

As a developer,
I want to establish the Effect-TS project structure with proper service layers,
so that I have a solid foundation for building the data pipeline.

**Acceptance Criteria:**
1. Initialize TypeScript project with strict mode, Bun runtime, and Effect-TS dependencies
2. Create project structure with clear separation: /src/services, /src/cli, /src/models, /src/layers
3. Implement base service layer architecture with Context.Tag pattern
4. Set up Effect test framework with example service and test layer using Bun test runner
5. Configure Bun build system to produce single executable binary
6. Create basic Effect Config service for environment variables
7. Implement "health check" CLI command that verifies Effect runtime and Terminal connection

## Story 1.2 ThetaData Terminal Client Service

As a system,
I want a robust API client service that connects to the local ThetaData Terminal,
so that I can reliably retrieve SPX options data.

**Acceptance Criteria:**
1. Implement ThetaDataApiClient service using Effect HTTP client pointing to http://127.0.0.1:25510
2. Add health check that verifies Terminal is running and `/v2/system/mdds/status` endpoint is accessible
3. Implement configurable concurrency limiting (2-4 parallel requests)
4. Add exponential backoff retry logic for transient failures
5. Create comprehensive test layer with mocked responses
6. Handle ThetaData Terminal error responses appropriately
7. Log all API requests/responses for debugging

## Story 1.3 Expiration-Based Parallel Processing Service

As a system,
I want to process options data requests by expiration date in parallel,
so that I can efficiently download all data while respecting API constraints.

**Acceptance Criteria:**
1. List all available expirations for the trade date
2. Create parallel processor using configured concurrency limit (2-4 requests)
3. Process each expiration's full options chain independently
4. Add queue management for pending expirations
5. Create test scenarios with various concurrency configurations
6. Ensure proper error handling per expiration (one failure doesn't stop others)
7. Track metrics on processing times and success rates per expiration

## Story 1.4 Core Streaming Pipeline

As a system,
I want a memory-efficient streaming pipeline that processes CSV data from ThetaData,
so that I can handle large datasets without memory overflow.

**Acceptance Criteria:**
1. Implement Effect Stream pipeline for CSV data passthrough
2. Stream CSV data from API responses with minimal memory footprint
3. Add basic data validation (row count, required columns present)
4. Implement proper stream error handling and recovery
5. Handle partial responses and connection interruptions gracefully
6. Ensure streaming can process 50K+ records/minute
7. Create benchmarks measuring memory usage during streaming

## Story 1.5 Basic CLI Download Command

As a user,
I want to download a single day of SPX options data with a simple command,
so that I can start acquiring data immediately.

**Acceptance Criteria:**
1. Implement `download --date YYYY-MM-DD` command using Effect CLI
2. Display progress indicator showing expirations processed
3. Create trade date directory structure: `./data/YYYYMMDD/`
4. Save each expiration to its own file: `./data/YYYYMMDD/spxw_exp_YYYYMMDD.csv`
5. Show summary statistics (records downloaded, time taken, total file size)
6. Support --dry-run flag to preview operation
7. Provide clear error messages if ThetaData Terminal is not running

## Story 1.6 Integration Tests and Documentation

As a developer,
I want comprehensive integration tests and setup documentation,
so that the system is reliable and easy to onboard.

**Acceptance Criteria:**
1. Create end-to-end test that downloads real data for a sample date
2. Add integration tests for all service layer interactions
3. Write README with setup instructions and ThetaData Terminal configuration
4. Document basic CLI usage with examples
5. Add performance test comparing parallel vs serial processing
6. Include troubleshooting guide for common issues
7. Verify single binary deployment works on target platform
