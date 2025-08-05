# Project Detection Rules

## Effect-TS Project Detection

When the dev agent detects any of the following, it should apply Effect-TS patterns:

### Detection Criteria
1. **Package.json dependencies** include:
   - `effect`
   - `@effect/*` packages
   - Effect ecosystem libraries (e.g., `@effect/schema`, `@effect/platform`)

2. **Import statements** contain:
   - `import { Effect, Layer, Context } from "effect"`
   - `import * as Effect from "effect"`
   - Any Effect-TS specific imports

3. **File patterns**:
   - Services using `Context.Tag` or `Context.GenericTag`
   - Layer definitions with `Layer.effect` or `Layer.succeed`
   - Effect types like `Effect.Effect<R, E, A>`

### Automatic Behavior When Effect-TS Detected

1. **Service Implementation**:
   - Always use service layer pattern
   - Create both Live and Test implementations
   - Use Layer composition for dependencies

2. **Testing**:
   - Write tests with Test layers first (TDD)
   - Create mock services using Layer.succeed or Layer.mock
   - Test both success and error scenarios

3. **Error Handling**:
   - Use tagged errors extending Data.TaggedError
   - Implement proper error recovery strategies
   - Type-safe error handling throughout

4. **Code Organization**:
   ```
   src/
   ├── services/          # Service interfaces and tags
   ├── layers/           # Layer implementations
   │   ├── live/        # Production layers (*Live.ts)
   │   └── test/        # Test layers (*Test.ts)
   ├── errors/          # Tagged error definitions
   └── config/          # Configuration schemas
   ```

5. **Before Implementation**:
   - Search Context7: `mcp__context7__search "Effect-TS [feature] pattern 2025"`
   - Review effect-ts-patterns.md for relevant patterns
   - Plan service boundaries and dependencies

## Other Framework Detection Rules

(Add rules for other frameworks as needed)