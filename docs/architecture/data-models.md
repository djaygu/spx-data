# Data Models

## OptionData
**Purpose:** Represents a single SPX option contract data point from ThetaData

**Key Attributes:**
- **symbol**: string - The option symbol (e.g., "SPXW")
- **strike**: number - Strike price of the option
- **expiry**: Date - Expiration date of the contract
- **optionType**: "call" | "put" - Type of option
- **bid**: number - Current bid price
- **ask**: number - Current ask price
- **last**: number - Last traded price
- **volume**: number - Trading volume
- **openInterest**: number - Open interest
- **impliedVolatility**: number - Implied volatility
- **delta**: number - Option delta
- **gamma**: number - Option gamma
- **theta**: number - Option theta
- **vega**: number - Option vega
- **timestamp**: Date - When this data was captured

**Relationships:**
- Part of a DailyOptionsDataset (many options per day)
- Can be grouped by expiry date for options chains

## DailyOptionsDataset
**Purpose:** Represents all options data for a single trading day

**Key Attributes:**
- **date**: Date - Trading date
- **recordCount**: number - Total number of option records
- **fileSize**: number - Size of the data file in bytes
- **downloadedAt**: Date - When the data was downloaded
- **checksum**: string - SHA-256 hash for data integrity

**Relationships:**
- Contains many OptionData records
- Referenced by DownloadStatus for tracking

## DownloadStatus
**Purpose:** Tracks the download progress and status for each date

**Key Attributes:**
- **date**: Date - Trading date
- **status**: "queued" | "in-progress" | "success" | "failed" - Current status
- **startTime**: Date | null - When download started
- **endTime**: Date | null - When download completed
- **attempts**: number - Number of download attempts
- **error**: string | null - Error message if failed
- **recordCount**: number | null - Records downloaded (if successful)
- **fileSize**: string | null - Human-readable file size

**Relationships:**
- References a DailyOptionsDataset when successful
- Updated by the download orchestrator

## Configuration
**Purpose:** System configuration loaded from Effect Config

**Key Attributes:**
- **thetaData.baseUrl**: string - ThetaData terminal URL
- **download.maxDTE**: number - Maximum days to expiration filter
- **download.concurrentExpirations**: number - Max parallel requests
- **download.retryAttempts**: number - Max retry attempts
- **storage.dataDirectory**: string - Where to store files
- **storage.fileFormat**: "csv" | "parquet" - Output format

**Relationships:**
- Singleton configuration used by all services

## FileInfo
**Purpose:** Tracks stored data files in the inventory

**Key Attributes:**
- **tradeDate**: Date - Trade date (directory name)
- **expirationDate**: Date - Expiration date (part of filename)
- **filename**: string - Full filename (e.g., "spxw_exp_20240116.csv")
- **path**: string - Relative path (e.g., "./data/20240115/spxw_exp_20240116.csv")
- **size**: number - File size in bytes
- **checksum**: string - SHA-256 hash
- **createdAt**: Date - When file was created
- **format**: "csv" | "parquet" - File format

**Relationships:**
- Multiple files per trading day (one per expiration)
- Referenced by inventory service
