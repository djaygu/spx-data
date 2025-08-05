# Database Schema

For the MVP, we're using JSON files for metadata storage, not a traditional database. However, I'll define the schema for these JSON structures and note how they could map to SQLite tables in the future.

## Status Tracking Schema (status.json)

```typescript
// Root structure
interface StatusDatabase {
  version: string              // Schema version for migrations
  lastUpdated: Date           // Last modification timestamp
  downloads: Record<string, DayStatus>  // Key: YYYY-MM-DD trade date
}

// Individual day status
interface DayStatus {
  status: "queued" | "in-progress" | "success" | "failed"
  startTime?: Date            // When download started
  endTime?: Date              // When download completed
  attempts: number            // Number of retry attempts
  error?: string              // Error message if failed
  expirations: ExpirationStatus[]  // Status per expiration
  summary?: {
    totalFiles: number
    totalSize: number         // Bytes
    totalRecords: number
    processingTimeMs: number
  }
}

// Per-expiration status
interface ExpirationStatus {
  expiration: string          // YYYYMMDD format
  status: "pending" | "downloading" | "complete" | "failed"
  recordCount?: number
  fileSize?: number           // Bytes
  retryCount: number
  error?: string
}
```

## File Inventory Schema (inventory.json)

```typescript
// Root structure
interface InventoryDatabase {
  version: string
  lastUpdated: Date
  dataDirectory: string
  files: FileRecord[]
  summary: InventorySummary
}

// Individual file record
interface FileRecord {
  tradeDate: string           // YYYY-MM-DD
  expirationDate: string      // YYYY-MM-DD
  filename: string            // spxw_exp_YYYYMMDD.csv
  relativePath: string        // 20240115/spxw_exp_20240116.csv
  size: number                // Bytes
  checksum: string            // SHA-256
  createdAt: Date
  lastModified: Date
  recordCount: number         // Number of option records
  format: "csv" | "parquet"
  compression?: string        // If compressed
}

// Summary statistics
interface InventorySummary {
  totalFiles: number
  totalSize: number           // Bytes
  tradeDateRange: {
    start: string             // YYYY-MM-DD
    end: string               // YYYY-MM-DD
  }
  expirationRange: {
    earliest: string          // YYYY-MM-DD
    latest: string            // YYYY-MM-DD
  }
  lastUpdate: Date
}
```

## Future SQLite Schema

When migrating to SQLite in the future, these schemas would map to:

```sql
-- Status tracking table
CREATE TABLE download_status (
    trade_date TEXT PRIMARY KEY,        -- YYYY-MM-DD
    status TEXT NOT NULL,               -- enum: queued|in-progress|success|failed
    start_time INTEGER,                 -- Unix timestamp
    end_time INTEGER,                   -- Unix timestamp
    attempts INTEGER DEFAULT 0,
    error TEXT,
    total_files INTEGER,
    total_size INTEGER,                 -- Bytes
    total_records INTEGER,
    processing_time_ms INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

-- Expiration status table
CREATE TABLE expiration_status (
    id INTEGER PRIMARY KEY,
    trade_date TEXT NOT NULL,           -- FK to download_status
    expiration_date TEXT NOT NULL,      -- YYYY-MM-DD
    status TEXT NOT NULL,               -- enum: pending|downloading|complete|failed
    record_count INTEGER,
    file_size INTEGER,                  -- Bytes
    retry_count INTEGER DEFAULT 0,
    error TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (trade_date) REFERENCES download_status(trade_date),
    UNIQUE(trade_date, expiration_date)
);

-- File inventory table
CREATE TABLE file_inventory (
    id INTEGER PRIMARY KEY,
    trade_date TEXT NOT NULL,
    expiration_date TEXT NOT NULL,
    filename TEXT NOT NULL,
    relative_path TEXT NOT NULL UNIQUE,
    size INTEGER NOT NULL,              -- Bytes
    checksum TEXT NOT NULL,
    record_count INTEGER,
    format TEXT DEFAULT 'csv',
    compression TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    last_modified INTEGER DEFAULT (unixepoch()),
    INDEX idx_trade_date (trade_date),
    INDEX idx_expiration (expiration_date)
);

-- Summary view for quick stats
CREATE VIEW inventory_summary AS
SELECT 
    COUNT(*) as total_files,
    SUM(size) as total_size,
    MIN(trade_date) as earliest_trade_date,
    MAX(trade_date) as latest_trade_date,
    MIN(expiration_date) as earliest_expiration,
    MAX(expiration_date) as latest_expiration
FROM file_inventory;
```
