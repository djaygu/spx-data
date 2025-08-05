# Components

## ThetaDataApiClient
**Responsibility:** Manages all communication with the ThetaData Terminal API

**Key Interfaces:**
- `getExpirations(root: string): Effect.Effect<string[], ApiError>`
- `getBulkGreeks(tradeDate: Date, expiration: string): Effect.Effect<Stream<OptionData>, ApiError>`
- `healthCheck(): Effect.Effect<boolean, never>`

**Dependencies:** 
- HttpClient from @effect/platform-bun
- ConfigService for API settings

**Technology Stack:** 
- @effect/platform-bun for HTTP requests
- Built-in retry logic with exponential backoff
- Rate limiting to respect API constraints

## DownloadOrchestrator
**Responsibility:** Coordinates the entire download workflow for date ranges

**Key Interfaces:**
- `downloadRange(startDate: Date, endDate: Date): Effect.Effect<void, DownloadError>`
- `downloadSingleDay(date: Date): Effect.Effect<DailyResult, DownloadError>`

**Dependencies:**
- ThetaDataApiClient
- StreamProcessingService
- StatusService
- InventoryService

**Technology Stack:**
- Effect for orchestration and error handling
- Effect.forEach for sequential day processing

## StreamProcessingService
**Responsibility:** Processes option data streams with validation

**Key Interfaces:**
- `processStream(input: Stream<OptionData>): Effect.Effect<Stream<ValidatedOptionData>, ProcessingError>`
- `validateRecord(record: OptionData): Effect.Effect<ValidatedOptionData, ValidationError>`

**Dependencies:**
- ValidationService

**Technology Stack:**
- Effect Streams for memory-efficient processing
- @effect/schema for validation

## StorageService
**Responsibility:** Handles file system operations for data storage

**Key Interfaces:**
- `saveAsCSV(tradeDate: Date, expiration: string, data: Stream<ValidatedOptionData>): Effect.Effect<FileInfo, StorageError>`
- `saveAsParquet(tradeDate: Date, expiration: string, data: Stream<ValidatedOptionData>): Effect.Effect<FileInfo, StorageError>` *(Future)*
- `calculateChecksum(filePath: string): Effect.Effect<string, never>`

**Dependencies:**
- FileSystem (Bun native)
- csv-parse for CSV operations

**Technology Stack:**
- Bun.write for file operations
- Streaming CSV writer
- SHA-256 for checksums

## StatusService
**Responsibility:** Tracks download status for each date

**Key Interfaces:**
- `getStatus(date: Date): Effect.Effect<DownloadStatus, never>`
- `updateStatus(date: Date, status: DownloadStatus): Effect.Effect<void, never>`
- `getAllStatuses(): Effect.Effect<Record<string, DownloadStatus>, never>`

**Dependencies:**
- FileSystemService (for JSON implementation)

**Technology Stack:**
- JSON file storage for MVP
- Service interface allows future SQLite migration

## InventoryService  
**Responsibility:** Maintains inventory of downloaded files

**Key Interfaces:**
- `addFile(fileInfo: FileInfo): Effect.Effect<void, never>`
- `getFile(tradeDate: Date, expiration: Date): Effect.Effect<FileInfo | null, never>`
- `listFiles(): Effect.Effect<readonly FileInfo[], never>`
- `detectGaps(startDate: Date, endDate: Date): Effect.Effect<Date[], never>`

**Dependencies:**
- FileSystemService

**Technology Stack:**
- JSON file storage for MVP
- Future SQLite support via same interface

## ConfigService
**Responsibility:** Manages application configuration using Effect Config

**Key Interfaces:**
- Configuration is provided as a Layer that supplies config values to services

**Dependencies:**
- Effect Config module (built into Effect)
- Environment variables

**Technology Stack:**
- Effect Config for type-safe configuration
- No external dependencies needed

## CLIService
**Responsibility:** Handles command-line interface and user interaction

**Key Interfaces:**
- `run(args: string[]): Effect.Effect<void, CLIError>`

**Dependencies:**
- All application services
- @effect/cli for command parsing

**Technology Stack:**
- @effect/cli for command structure
- Effect Runtime for execution
