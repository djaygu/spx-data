# SPX Options Data Pipeline Tool Product Requirements Document (PRD)

## Goals and Background Context

### Goals

• Reduce data management overhead by 80% through automated, reliable SPX options data acquisition
• Achieve 99.9% data completeness with automatic gap detection and recovery
• Enable processing of 5+ years of historical data without memory constraints
• Provide data within 2 hours of market close with zero manual intervention
• Create a production-grade CLI tool that "just works" for quantitative researchers

### Background Context

The SPX Options Data Pipeline Tool addresses critical challenges faced by quantitative options traders who currently lose 20-30% of their research time to data management tasks. Built entirely on Effect-TS, this CLI tool provides a streaming pipeline that downloads both historical and current SPX options data from thetadata API, storing it as integrity-validated Parquet files. The tool's streaming architecture eliminates memory constraints that plague traditional batch processing approaches, while built-in scheduling capabilities ensure datasets remain current without manual intervention.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-08-05 | 1.0 | Initial PRD creation | John (PM) |

## Requirements

### Functional

• **FR1:** Download historical SPX options data for any date range with automatic pagination and progress tracking
• **FR2:** Support parallel downloads with configurable concurrency (2-4 threads) for faster data acquisition
• **FR3:** Process options data through memory-efficient streaming pipeline handling 50K+ records/minute
• **FR4:** Validate data integrity ensuring all required fields are present and within valid ranges before storage
• **FR5:** Store all data as Apache Parquet files with proper schema enforcement and compression
• **FR6:** Provide CLI commands for common operations (e.g., `download --start-date 2023-01-01 --end-date 2023-12-31`)
• **FR7:** Detect existing data to enable incremental updates and avoid re-downloading
• **FR8:** Display real-time progress bars with ETA calculations for long-running operations
• **FR9:** Automatically retry failed requests with exponential backoff
• **FR10:** Resume interrupted downloads within 5 minutes of failure
• **FR11:** Support downloading 1-minute tick granularity data for SPX options
• **FR12:** Respect thetadata API rate limits and quotas with proper request management

### Non Functional

• **NFR1:** Maintain memory utilization below 75% when processing full options chains
• **NFR2:** Achieve 99.9% data completeness rate for specified date ranges
• **NFR3:** Complete 95% of scheduled runs without manual intervention
• **NFR4:** Process and store 1 year of SPX data (50-100GB) without memory overflow
• **NFR5:** Achieve >5:1 compression ratio using Parquet format vs CSV
• **NFR6:** Support operation on macOS (M4 MacBook Pro) with 24GB minimum RAM
• **NFR7:** Store API keys securely in environment variables, never in code
• **NFR8:** Provide clear error messages and logging for debugging failed operations
• **NFR9:** Bundle as single binary with all dependencies for easy deployment
• **NFR10:** Ensure data queries via DuckDB/pandas run 10x faster than CSV equivalents

## User Interface Design Goals

### Overall UX Vision

A professional-grade CLI tool that feels native to quantitative researchers' workflows, providing clear feedback, intelligent defaults, and recoverable operations. The interface should minimize cognitive load by using familiar command patterns while providing rich progress information for long-running operations.

### Key Interaction Paradigms

• **Command-based operations** with intuitive verbs and flags (download, validate, status)
• **Progressive disclosure** - simple commands for common tasks, advanced flags for power users
• **Real-time feedback** through progress bars, ETAs, and status updates
• **Fail-safe by default** - confirmations for destructive operations, automatic resume capabilities
• **Pipe-friendly output** - structured output formats that integrate with Unix toolchains

### Core Screens and Views

• **Progress Display** - Real-time download progress with speed, ETA, and records processed
• **Status Summary** - Overview of downloaded data, gaps, and last update times
• **Error Display** - Clear error messages with suggested remediation steps
• **Help System** - Contextual help with examples for each command
• **Configuration Display** - Current settings including API credentials status

### Accessibility: None

*Standard CLI accessibility relies on terminal emulator capabilities*

### Branding

Clean, professional output using ASCII characters only for maximum compatibility. Consistent use of color coding: green for success, yellow for warnings, red for errors, blue for informational messages. Progress bars using standard Unicode block characters.

### Target Device and Platforms: Desktop Only

macOS (M4 MacBook Pro) for initial development, with future containerization enabling Linux deployment. Terminal width assumption of 80+ characters for proper formatting.

## Technical Assumptions

### Repository Structure: Single Repository

Single repository with organized source structure under `/src` directory, containing all modules (CLI, services, models) with clear separation of concerns. This enables atomic commits across the entire system and simplified dependency management.

### Service Architecture

**Effect-TS Service Layer Architecture** - Following Effect-TS best practices with Context.Tag for service identification, Layer composition for dependency injection, and proper separation between Live and Test implementations. Services will include:
- API Client Service (rate limiting, retry logic)
- Stream Processing Service (data transformation, validation)
- Storage Service (Parquet file operations)
- Progress Tracking Service (CLI feedback)

### Testing Requirements

**Strict Test-Driven Development (TDD)** - MANDATORY Red-Green-Refactor cycle for all development:
- Write failing tests first for each feature
- Implement minimal code to pass tests
- Refactor while keeping tests green
- Create Test layers for all Effect services
- Use Effect TestClock and TestRandom for deterministic testing
- Aim for high test coverage with focus on edge cases and error scenarios

### Additional Technical Assumptions and Requests

• **Language & Framework**: TypeScript with strict mode, Effect-TS for all core functionality
• **Streaming Architecture**: Effect Streams for memory-efficient processing of 50K+ records/minute
• **Storage Format**: Apache Parquet via parquetjs with schema validation
• **CLI Framework**: Effect CLI for command parsing with proper error boundaries
• **HTTP Client**: Effect HTTP with built-in retry logic and exponential backoff
• **Configuration**: Effect Config module for environment variables and settings
• **Concurrency Control**: Configurable 2-4 threads respecting thetadata API Standard tier limits
• **Error Handling**: Tagged errors (Data.TaggedError) for type-safe error handling
• **Resource Management**: Layer.scoped for proper cleanup of file handles and connections
• **Deployment**: Single binary bundle with all dependencies included
• **Observability**: Built-in progress tracking and resumable operation state
• **Development Tools**: Use MCP Context7 for library best practices verification

## Epic List

• **Epic 1: Foundation & Streaming Pipeline with Expiration-Based Parallelization** - Establish Effect-TS project, implement streaming pipeline with expiration-based parallelization, parallel processing service (2-4 concurrent requests), API client with rate limiting, and basic CLI that can download one day's data processing expirations in parallel

• **Epic 2: Data Validation & Parquet Storage** - Implement comprehensive data validation, Parquet file writing with proper schema, compression optimization, and status tracking for monitoring progress  

• **Epic 3: Multi-Day Operations & Recovery** - Add date range downloads, incremental updates, resume capability from interruptions, existing data detection, and sequential processing across multiple days

• **Epic 4: Production Readiness** - Implement Effect Config for configuration management, status commands, data validation tools, operational metrics, and Bun deployment packaging

## Epic 1 Foundation & Streaming Pipeline with Expiration-Based Parallelization

**Goal**: Establish the core Effect-TS architecture with a working streaming pipeline that can download one day of SPX options data using parallel expiration-based processing. This epic delivers immediate value by enabling basic data downloads while proving the architecture handles memory constraints and API rate limits effectively.

### Story 1.1 Project Setup and Core Architecture

As a developer,
I want to establish the Effect-TS project structure with proper service layers,
so that I have a solid foundation for building the data pipeline.

**Acceptance Criteria:**
1. Initialize TypeScript project with strict mode and Effect-TS dependencies
2. Create project structure with clear separation: /src/services, /src/cli, /src/models, /src/layers
3. Implement base service layer architecture with Context.Tag pattern
4. Set up Effect test framework with example service and test layer
5. Configure Bun build system to produce single executable binary
6. Create basic Effect Config service for environment variables (API key)
7. Implement "health check" CLI command that verifies Effect runtime

### Story 1.2 ThetaData API Client Service

As a system,
I want a robust API client service that connects to the local ThetaTerminal,
so that I can reliably retrieve SPX options data.

**Acceptance Criteria:**
1. Implement ThetaDataApiClient service using Effect HTTP client pointing to http://127.0.0.1:25510
2. Add health check that verifies `/v2/system/mdds/status` endpoint is accessible
3. Implement configurable rate limiting and concurrent request limit
4. Add exponential backoff retry logic for transient failures
5. Create comprehensive test layer with mocked responses
6. Handle ThetaData error responses appropriately
7. Log all API requests/responses for debugging

### Story 1.3 Expiration-Based Parallel Processing Service

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

### Story 1.4 Core Streaming Pipeline

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

### Story 1.5 Basic CLI Download Command

As a user,
I want to download a single day of SPX options data with a simple command,
so that I can start acquiring data immediately.

**Acceptance Criteria:**
1. Implement `download --date YYYY-MM-DD` command using Effect CLI
2. Display progress indicator showing expirations processed
3. Save outputs to trade date directory with expiration-based files (e.g., `./data/20230101/spxw_20230106.csv`)
4. Each expiration gets its own CSV file
5. Show summary statistics (records downloaded, time taken, total file size)
6. Support --dry-run flag to preview operation
7. Provide clear error messages if ThetaTerminal is not running

### Story 1.6 Integration Tests and Documentation

As a developer,
I want comprehensive integration tests and setup documentation,
so that the system is reliable and easy to onboard.

**Acceptance Criteria:**
1. Create end-to-end test that downloads real data for a sample date
2. Add integration tests for all service layer interactions
3. Write README with setup instructions and API key configuration
4. Document basic CLI usage with examples
5. Add performance test comparing parallel vs serial processing
6. Include troubleshooting guide for common issues
7. Verify single binary deployment works on target platform

## Epic 2 Data Validation & Parquet Storage

**Goal**: Transform the basic CSV pipeline into a production-grade system with comprehensive data validation and efficient Parquet storage. This epic ensures data integrity through validation rules and provides the columnar storage format essential for fast analytical queries, achieving the 10x query performance improvement target.

### Story 2.1 Parquet Schema Definition and Writer Service

As a system,
I want to define a strict schema for SPX options data and write Parquet files,
so that I can ensure data consistency and enable efficient queries.

**Acceptance Criteria:**
1. Define Parquet schema for SPX options data with proper types (timestamp, double, int32, etc.)
2. Implement ParquetWriterService using parquetjs or similar Effect-compatible library
3. Configure compression settings (Snappy/ZSTD) for optimal size/speed tradeoff
4. Support streaming writes to handle large datasets without memory issues
5. Create test files and verify they can be read by DuckDB/pandas
6. Implement proper file finalization and metadata writing
7. Benchmark compression ratios achieving >5:1 vs CSV

### Story 2.2 Data Validation Service

As a system,
I want to validate all options data before storage,
so that I can guarantee data quality and catch issues early.

**Acceptance Criteria:**
1. Implement DataValidationService with configurable validation rules
2. Validate required fields are present (strike, expiry, bid, ask, etc.)
3. Check value ranges (prices > 0, valid dates, reasonable implied volatility)
4. Detect and flag suspicious data patterns (crossed markets, stale quotes)
5. Create validation report with pass/fail/warning counts
6. Allow configurable behavior on validation failure (skip/fail/warn)
7. Log all validation failures with sufficient context for debugging

### Story 2.3 CSV to Parquet Streaming Transformation

As a system,
I want to stream CSV data directly to Parquet format,
so that I can efficiently transform data without intermediate storage.

**Acceptance Criteria:**
1. Implement streaming transformation from CSV to Parquet row groups
2. Handle data type conversions (string dates to timestamps, etc.)
3. Batch rows efficiently for Parquet row group sizing
4. Maintain memory usage below 75% during transformation
5. Support partial write recovery if process is interrupted
6. Add metrics for transformation throughput and efficiency
7. Ensure no data loss during format conversion

### Story 2.4 Status Tracking

As a system,
I want to track download progress and status persistently,
so that users can monitor progress and resume interrupted downloads.

**Acceptance Criteria:**
1. Implement status tracking using status.json file
2. Track completed/pending expirations per trade date
3. Update status file after each expiration completes
4. Show current progress information when requested
5. Support resume from last incomplete expiration
6. Include data validation status in tracking
7. Persist status across process restarts

### Story 2.5 Enhanced Error Recovery

As a system,
I want robust error recovery mechanisms,
so that I can handle failures gracefully and minimize reprocessing.

**Acceptance Criteria:**
1. Implement checkpoint system to track completed batches
2. Store recovery state that survives process restart
3. Detect partial Parquet files and handle appropriately
4. Add retry logic specific to different error types
5. Implement "resume from checkpoint" functionality
6. Create clear error categorization (transient/permanent)
7. Log detailed error context for troubleshooting

### Story 2.6 Storage Optimization and File Organization

As a user,
I want well-organized Parquet files with optimal sizing,
so that I can efficiently query and manage my data.

**Acceptance Criteria:**
1. Implement configurable file partitioning strategy (by date/expiry)
2. Optimize Parquet row group size for query performance
3. Add file naming convention with metadata (date, record count)
4. Create index/manifest file for dataset tracking
5. Implement file size limits with automatic splitting
6. Add storage metrics (total size, compression ratio)
7. Verify query performance meets 10x improvement target

## Epic 3 Multi-Day Operations & Recovery

**Goal**: Extend the pipeline to handle date ranges efficiently, detect existing data to enable incremental updates, and provide robust resume capabilities. This epic transforms the tool from single-day operations to a production system capable of maintaining complete historical datasets with minimal manual intervention.

### Story 3.1 Date Range Command Support

As a user,
I want to download data for a date range with a single command,
so that I can efficiently acquire historical datasets.

**Acceptance Criteria:**
1. Extend CLI to support `download --start-date YYYY-MM-DD --end-date YYYY-MM-DD`
2. Validate date ranges (start before end, not future dates)
3. Generate list of trading days only (skip weekends/holidays)
4. Display total days to process before starting
5. Support date formats and relative dates (e.g., --days-back 30)
6. Add --confirm flag for large date ranges (>30 days)
7. Show estimated total time and storage requirements

### Story 3.2 Sequential Date Processing

As a system,
I want to process multiple days sequentially with proper status tracking,
so that I can download large historical datasets reliably.

**Acceptance Criteria:**
1. Process trade dates sequentially (one at a time)
2. Track completion status for each date in status.json
3. Process days in chronological order for easier monitoring
4. Update inventory after each date completes successfully
5. Add configurable inter-day delay to avoid API throttling
6. Track per-day metrics (records, time, file size)
7. Handle partial day failures without stopping entire range

### Story 3.3 Existing Data Detection

As a system,
I want to detect already downloaded data,
so that I can avoid redundant downloads and save time.

**Acceptance Criteria:**
1. Implement FileInventoryService to track existing Parquet files
2. Check file metadata to verify completeness and validity
3. Support "fill gaps" mode to only download missing dates
4. Add --force flag to override and re-download existing data
5. Display which dates will be skipped before starting
6. Handle corrupted/incomplete files appropriately
7. Maintain inventory index for fast lookups

### Story 3.4 Resume Capability Implementation

As a system,
I want to resume interrupted downloads from the last checkpoint,
so that I can recover from failures without starting over.

**Acceptance Criteria:**
1. Use status.json for checkpoint tracking
2. Save status after each completed expiration
3. Detect incomplete downloads on startup
4. Add `resume` command to continue from last incomplete date/expiration
5. Skip already downloaded expirations within a day
6. Clean up partial files before resuming
7. Show resume status (X of Y days completed, M of N expirations)

### Story 3.5 Incremental Update Mode

As a user,
I want to easily update my dataset with recent data,
so that I can maintain current datasets with minimal effort.

**Acceptance Criteria:**
1. Add `update` command that downloads from last data to today
2. Automatically detect last downloaded date from file inventory
3. Handle edge cases (gaps in historical data)
4. Support --lookback parameter for re-downloading recent days
5. Optimize for small incremental updates (single day)
6. Add scheduling recommendations to documentation
7. Show clear status of what will be updated

### Story 3.6 Multi-Day Operation Monitoring

As a user,
I want comprehensive monitoring for long-running downloads,
so that I can track progress and identify issues.

**Acceptance Criteria:**
1. Create summary dashboard showing overall progress
2. Display per-day statistics (records, errors, duration)
3. Add estimated completion time for entire operation
4. Support log file output for unattended operation
5. Include periodic progress summaries (every N days)
6. Alert on unusual patterns (day with no data, excessive errors)
7. Generate final summary report with all metrics

## Epic 4 Production Operations & Monitoring

**Goal**: Transform the tool into a production-ready system with simplified configuration management, operational commands, and deployment packaging suitable for personal use. This epic ensures the tool can be reliably operated with proper maintenance capabilities.

### Story 4.1 Effect Config Implementation

As a user,
I want configuration management using Effect Config,
so that I have type-safe, validated configuration.

**Acceptance Criteria:**
1. Implement configuration using Effect Config module
2. Support environment variables with CONFIG_ prefix
3. Add `config show` command to display current settings
4. Include configuration validation on startup with clear error messages
5. Document all configuration options with examples
6. Type-safe configuration with compile-time checking
7. Provide sensible defaults for all settings

### Story 4.2 Status and Health Commands

As a user,
I want operational commands to check system status,
so that I can monitor and troubleshoot the pipeline.

**Acceptance Criteria:**
1. Implement `status` command showing data inventory summary
2. Add `health` command checking ThetaTerminal connection
3. Display storage usage and file count statistics
4. Show last successful download timestamp per dataset
5. Include data quality metrics (validation pass rates)
6. Check for common issues (disk space, permissions)
7. Return appropriate exit codes for scripting

### Story 4.3 Data Validation Command

As a user,
I want to validate my downloaded data files,
so that I can ensure data integrity and identify issues.

**Acceptance Criteria:**
1. Implement `validate` command for Parquet file verification
2. Check file structure, schema, and metadata integrity
3. Validate data ranges and consistency rules
4. Support validating single files or date ranges
5. Generate detailed validation report
6. Add --repair flag for fixable issues
7. Include performance metrics (files/second)

### Story 4.4 Basic Logging and Metrics

As a user,
I want simple logging and performance metrics,
so that I can track pipeline operations and debug issues.

**Acceptance Criteria:**
1. Implement file-based logging with configurable verbosity
2. Log key operations (downloads, validations, errors)
3. Track basic metrics (records/day, download speeds, error rates)
4. Write metrics to simple CSV file for analysis
5. Include log rotation to prevent disk filling
6. Add --verbose flag for detailed logging
7. Create log parser script for common queries

### Story 4.5 Deployment Packaging

As a user,
I want a single deployable artifact using Bun,
so that I can easily install and run the tool anywhere.

**Acceptance Criteria:**
1. Configure Bun build to produce single executable binary
2. Bundle all dependencies including Effect runtime
3. Optimize binary size while maintaining functionality
4. Add version command with build information
5. Create installation script for Bun runtime
6. Test deployment on fresh macOS system
7. Document Bun runtime requirements and prerequisites

### Story 4.6 User Documentation

As a user,
I want clear documentation and examples,
so that I can effectively use the tool.

**Acceptance Criteria:**
1. Create comprehensive README with quick start guide
2. Document all commands with examples
3. Include troubleshooting section for common issues
4. Add example scripts for common workflows
5. Provide sample cron configurations
6. Create command reference card
7. Include FAQ section based on common questions

## Checklist Results Report

### Executive Summary

- **Overall PRD Completeness**: 94%
- **MVP Scope Appropriateness**: Just Right
- **Readiness for Architecture Phase**: Ready
- **Most Critical Gaps**: Minor gaps in user research documentation and technical risk identification

### Category Analysis

| Category                         | Status  | Critical Issues |
| -------------------------------- | ------- | --------------- |
| 1. Problem Definition & Context  | PASS    | None |
| 2. MVP Scope Definition          | PASS    | None |
| 3. User Experience Requirements  | PASS    | None |
| 4. Functional Requirements       | PASS    | None |
| 5. Non-Functional Requirements   | PASS    | None |
| 6. Epic & Story Structure        | PASS    | None |
| 7. Technical Guidance            | PARTIAL | Limited technical risk analysis |
| 8. Cross-Functional Requirements | PARTIAL | Trading calendar not specified |
| 9. Clarity & Communication       | PASS    | None |

### Key Findings

**Strengths:**
- Clear problem definition with quantified impact (20-30% time savings)
- Well-scoped MVP focusing on core SPX data acquisition
- Comprehensive epic structure with clear dependencies
- Strong technical foundation with Effect-TS architecture

**Areas for Enhancement:**
- Trading calendar specification for date range processing
- Technical risk analysis for Parquet library selection
- Data flow visualization would aid understanding

### Recommendations

1. **Add trading calendar logic** in Story 3.1 for accurate date range handling
2. **Include Parquet library benchmarking** as part of Story 2.1
3. **Document CSV to Parquet migration path** between Epic 1 and 2
4. **Consider adding data flow diagram** in architecture phase

**Verdict**: PRD is ready for architectural design phase with minor enhancements to be addressed during implementation.

## Next Steps

### UX Expert Prompt

Review the SPX Options Data Pipeline Tool PRD and create ASCII-based mockups for the CLI interface, focusing on the progress display, error messages, and help system to ensure an optimal developer experience.

### Architect Prompt

Using this PRD, design the technical architecture for the SPX Options Data Pipeline Tool, focusing on Effect-TS service layers, streaming pipeline implementation, and ensuring the system can handle 50K+ records/minute while maintaining <75% memory utilization.