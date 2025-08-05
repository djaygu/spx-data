# Coding Standards

**These standards are MANDATORY for AI agents and define critical rules to prevent bad code.**

## Core Standards
- **Languages & Runtimes:** TypeScript 5.3.3 with Bun 1.1.0 runtime
- **Style & Linting:** Biome for formatting and linting (faster than ESLint)
- **Test Organization:** Tests in `/test` directory mirroring `/src` structure, `*.test.ts` naming

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Services | PascalCase + "Service" suffix | `ThetaDataApiClient`, `StatusService` |
| Layers | PascalCase + "Live/Test" suffix | `ApiClientLive`, `StatusServiceTest` |
| Errors | PascalCase + "Error" suffix | `ApiConnectionError`, `ValidationError` |
| Effect Programs | camelCase | `downloadSingleDay`, `validateOptionData` |
| File names | kebab-case | `theta-data-api-client.ts`, `download-orchestrator.ts` |

## Critical Rules
- **Never use console.log in production code - use Effect.log:** All logging must go through Effect's logging system for proper structured output
- **All Effect services must have Test implementations:** Every service needs both Live and Test layers for proper testing
- **Never use plain `yield` - always use `yield*`:** Effect generators require `yield*` for proper type inference
- **All API responses must use Effect.tryPromise:** Wrap all promise-based operations in Effect.tryPromise with proper error mapping
- **File operations must be atomic:** Use temp file + rename pattern to prevent partial writes
- **Never store secrets in code:** API keys and sensitive data must come from environment variables only
- **All dates must use Date objects, not strings:** Use proper Date types in models, format only when needed for display/storage
- **Service interfaces must be defined with Context.Tag:** All services use Effect's Context pattern for dependency injection

## Language-Specific Guidelines

### TypeScript Specifics
- **Prefer `interface` over `type` for object shapes:** Interfaces provide better error messages and extend more cleanly
- **Use branded types for domain concepts:** Brand primitive types for type safety (e.g., `TradeDate`, `ExpirationDate`)
- **Effect.gen over pipe for sequential operations:** Use generators for readability when operations are sequential
- **Match.exhaustive for error handling:** Ensure all error cases are handled with exhaustive pattern matching
