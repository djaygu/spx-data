# Tech Stack

## Cloud Infrastructure
- **Provider:** Local/On-premise (ThetaData runs locally)
- **Key Services:** File system storage only for MVP
- **Deployment Regions:** N/A - Local deployment

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| **Runtime** | Bun | 1.1.0 | JavaScript runtime | Faster than Node.js, native TypeScript support, aligns with Effect-TS patterns doc |
| **Language** | TypeScript | 5.3.3 | Primary development language | Type safety, Effect-TS requirement, team standard |
| **CLI Framework** | @effect/cli | 0.36.0 | Command-line interface | Native Effect integration, type-safe commands, from patterns doc |
| **HTTP Client** | @effect/platform-bun | 0.36.0 | API communication | Bun-optimized, Effect native, built-in retry support |
| **CSV Parser** | csv-parse | 5.5.0 | CSV streaming parser | Memory efficient, streaming support, wide compatibility |
| **Testing** | @effect/vitest | 0.5.0 | Test framework | Effect-native testing, follows TDD requirement |
| **Build Tool** | Bun | 1.1.0 | Bundling and compilation | Native bundler, single binary output capability |
| **Config** | Effect Config | (built-in) | Configuration management | Type-safe, native Effect integration, env var support with defaults |
| **Schema Validation** | @effect/schema | 0.64.0 | Data validation | Effect-native validation, required for data integrity |
| **Date Library** | date-fns | 3.3.0 | Date manipulation | Trading day calculations, lightweight |
| **Logging** | @effect/platform | 0.36.0 | Structured logging | Effect-native, configurable levels |
