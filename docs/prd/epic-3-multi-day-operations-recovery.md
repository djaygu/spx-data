# Epic 3 Multi-Day Operations & Recovery

**Goal**: Extend the pipeline to handle date ranges efficiently, detect existing data to enable incremental updates, and provide robust resume capabilities. This epic transforms the tool from single-day operations to a production system capable of maintaining complete historical datasets with minimal manual intervention.

## Story 3.1 Date Range Command Support

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

## Story 3.2 Sequential Date Processing

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

## Story 3.3 Existing Data Detection

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

## Story 3.4 Resume Capability Implementation

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

## Story 3.5 Incremental Update Mode

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

## Story 3.6 Multi-Day Operation Monitoring

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
