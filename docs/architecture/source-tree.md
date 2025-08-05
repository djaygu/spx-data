# Source Tree

```
spx-data/
├── src/
│   ├── models/                        # Domain models
│   │   ├── OptionData.ts             # Option data interface
│   │   ├── FileInfo.ts               # File metadata interface
│   │   ├── DownloadStatus.ts         # Status types
│   │   └── index.ts                  # Re-exports
│   │
│   ├── schemas/                       # Effect Schema definitions
│   │   ├── OptionData.schema.ts      # Validation schemas
│   │   ├── FileInfo.schema.ts
│   │   ├── Config.schema.ts
│   │   └── index.ts
│   │
│   ├── types/                         # Shared types
│   │   ├── common.ts                  # Enums, utility types
│   │   ├── errors.ts                  # Tagged error classes
│   │   └── index.ts
│   │
│   ├── config/                        # Configuration
│   │   ├── AppConfig.ts              # Effect Config definition
│   │   └── index.ts
│   │
│   ├── services/                      # Service interfaces & implementations
│   │   ├── ThetaDataApiClient.ts     # API client service
│   │   ├── DownloadOrchestrator.ts   # Main orchestration logic
│   │   ├── StreamProcessor.ts        # CSV stream processing
│   │   ├── ValidationService.ts      # Data validation
│   │   ├── StorageService.ts         # File operations
│   │   ├── StatusService.ts          # Status tracking interface
│   │   ├── InventoryService.ts       # File inventory interface
│   │   └── index.ts
│   │
│   ├── repositories/                  # Data access implementations
│   │   ├── types/
│   │   │   ├── StatusDatabase.ts     # JSON schema types
│   │   │   ├── InventoryDatabase.ts
│   │   │   └── index.ts
│   │   ├── JsonStatusRepository.ts   # JSON implementation
│   │   ├── JsonInventoryRepository.ts
│   │   └── index.ts
│   │
│   ├── layers/                        # Effect Layer compositions
│   │   ├── ApiClientLive.ts          # Production API client
│   │   ├── StorageLive.ts            # Production storage
│   │   ├── StatusServiceLive.ts      # JSON-based status
│   │   ├── InventoryServiceLive.ts   # JSON-based inventory
│   │   ├── AppLive.ts                # Main production layer
│   │   ├── TestLive.ts               # Test environment layer
│   │   └── index.ts
│   │
│   ├── cli/                           # CLI commands
│   │   ├── commands/
│   │   │   ├── download.ts           # Download command
│   │   │   ├── status.ts             # Status command
│   │   │   ├── update.ts             # Update command
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── formatters.ts         # Output formatting
│   │   │   ├── dates.ts              # Trading day calculations
│   │   │   └── index.ts
│   │   └── main.ts                   # CLI entry point
│   │
│   ├── utils/                         # Shared utilities
│   │   ├── dates.ts                  # Date helpers
│   │   ├── hash.ts                   # Checksum utilities
│   │   ├── stream.ts                 # Stream helpers
│   │   └── index.ts
│   │
│   └── main.ts                        # Application entry point
│
├── test/                              # Test files
│   ├── services/
│   │   ├── ThetaDataApiClient.test.ts
│   │   ├── DownloadOrchestrator.test.ts
│   │   └── StreamProcessor.test.ts
│   ├── repositories/
│   │   ├── JsonStatusRepository.test.ts
│   │   └── JsonInventoryRepository.test.ts
│   ├── integration/
│   │   ├── download.integration.test.ts
│   │   └── status.integration.test.ts
│   └── fixtures/                      # Test data
│       ├── sample-options.csv
│       └── mock-responses.ts
│
├── data/                              # Downloaded data (git-ignored)
│   ├── 20240115/
│   │   ├── spxw_exp_20240116.csv
│   │   ├── spxw_exp_20240117.csv
│   │   └── ...
│   ├── status.json                    # Status tracking
│   └── inventory.json                 # File inventory
│
├── scripts/                           # Utility scripts
│   ├── check-theta-terminal.ts       # Verify terminal is running
│   ├── validate-data.ts              # Data validation script
│   └── clean-failed.ts               # Clean up failed downloads
│
├── docs/                              # Documentation
│   ├── architecture.md               # This document
│   ├── prd.md                        # Product requirements
│   └── api-examples.md               # ThetaData API examples
│
├── .github/                           # GitHub configuration
│   └── workflows/
│       ├── test.yml                  # CI testing
│       └── release.yml               # Build releases
│
├── package.json                       # Project dependencies
├── bunfig.toml                       # Bun configuration
├── tsconfig.json                     # TypeScript config
├── vitest.config.ts                  # Test configuration
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
├── README.md                         # Project documentation
└── LICENSE                           # License file
```
