# Epic 2 Data Validation & Parquet Storage

**Goal**: Transform the basic CSV pipeline into a production-grade system with comprehensive data validation and efficient Parquet storage. This epic ensures data integrity through validation rules and provides the columnar storage format essential for fast analytical queries, achieving the 10x query performance improvement target.

## Story 2.1 Parquet Schema Definition and Writer Service

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

## Story 2.2 Data Validation Service

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

## Story 2.3 CSV to Parquet Streaming Transformation

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

## Story 2.4 Status Tracking

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

## Story 2.5 Enhanced Error Recovery

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

## Story 2.6 Storage Optimization and File Organization

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
