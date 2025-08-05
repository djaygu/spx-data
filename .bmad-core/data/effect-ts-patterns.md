# Effect-TS Patterns and Best Practices with Bun

## Overview

Effect-TS is a powerful TypeScript library for building robust, type-safe applications with built-in dependency injection, error handling, and composability. This guide focuses on using Effect-TS with Bun runtime for optimal performance.

**Effect type parameters**: `Effect<A, E, R>`
- `A` - Success value type
- `E` - Error type (defaults to `never`)
- `R` - Requirements/dependencies (defaults to `never`)

## Core Service Pattern

```typescript
import { Context, Effect, Layer, Data } from "effect"

// Tagged errors for type-safe error handling
class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  readonly userId: string
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly errors: ReadonlyArray<string>
}> {}

// Service definition with Context.Tag
export class UserService extends Context.Tag("UserService")<
  UserService,
  {
    readonly findById: (id: string) => Effect.Effect<User, UserNotFoundError>
    readonly create: (data: CreateUserDto) => Effect.Effect<User, ValidationError>
    readonly update: (id: string, data: UpdateUserDto) => Effect.Effect<User, UserNotFoundError | ValidationError>
  }
>() {
  // Production implementation
  static readonly Live = Layer.effect(
    this,
    Effect.gen(function* (_) {
      const database = yield* _(DatabaseService)
      const validator = yield* _(ValidationService)
      
      return UserService.of({
        findById: (id) => 
          Effect.gen(function* (_) {
            const user = yield* _(database.query(`SELECT * FROM users WHERE id = ?`, [id]))
            if (!user) {
              return yield* _(Effect.fail(new UserNotFoundError(id)))
            }
            return user
          }),
          
        create: (data) =>
          Effect.gen(function* (_) {
            const validated = yield* _(validator.validate(CreateUserSchema, data))
            return yield* _(database.insert("users", validated))
          })
      })
    })
  )
  
  // Test implementation
  static readonly Test = Layer.succeed(
    this,
    UserService.of({
      findById: (id) => 
        id === "123" 
          ? Effect.succeed({ id: "123", name: "Test User" })
          : Effect.fail(new UserNotFoundError(id)),
      create: (data) => Effect.succeed({ id: "generated", ...data })
    })
  )
}
```

### Service Architecture Types

1. **Domain Services**: Core business logic, pure functions
2. **Infrastructure Services**: External integrations (DB, APIs, files)
3. **Application Services**: Orchestration of domain and infrastructure

### Error Recovery Patterns

```typescript
// Single error recovery
const withFallback = (userId: string) =>
  UserService.findById(userId).pipe(
    Effect.catchTag("UserNotFoundError", () =>
      Effect.succeed({ id: userId, name: "Guest User" })
    )
  )

// Multiple tag error handling (Effect 3.15+)
const recovered = program.pipe(
  Effect.catchTag("NetworkError", "ValidationError", (error) => {
    if (error._tag === "NetworkError") {
      return Effect.succeed(`Network error: ${error.status}`)
    } else {
      return Effect.succeed(`Validation error: ${error.field}`)
    }
  })
)
```

### Configuration Pattern

```typescript
import { Config } from "effect"

const DatabaseConfig = Config.all({
  host: Config.string("DATABASE_HOST"),
  port: Config.number("DATABASE_PORT"),  
  username: Config.string("DATABASE_USER"),
  password: Config.secret("DATABASE_PASSWORD")
})

const ConfigLive = Layer.effect(
  DatabaseConfig,
  Config.config(DatabaseConfig)
)
```

## SQL Integration with Effect

### Setup and Configuration

```typescript
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { PgClient } from "@effect/sql-pg"
import { sql, SqlClient, SqlResolver } from "@effect/sql"
import { Schema } from "effect"

// Database client layers
const SqliteLive = SqliteClient.layer({
  filename: "./database.db"
})

const PgLive = PgClient.layer({
  host: Config.string("DB_HOST"),
  port: Config.number("DB_PORT"),
  database: Config.string("DB_NAME"),
  username: Config.string("DB_USER"),
  password: Config.secret("DB_PASSWORD")
})
```

### Safe Query Building

```typescript
// Automatic parameterization
const getUserById = (id: number) =>
  sql`SELECT * FROM users WHERE id = ${id}`

// Complex queries with sql.and/sql.or
const complexQuery = (filters: { name?: string; minAge?: number; active?: boolean }) =>
  sql`SELECT * FROM users WHERE ${sql.and([
    filters.name ? sql`name LIKE ${"%" + filters.name + "%"}` : undefined,
    filters.minAge ? sql`age >= ${filters.minAge}` : undefined,
    filters.active !== undefined ? sql`active = ${filters.active}` : undefined
  ].filter(Boolean))}`

// Safe updates
const updateUser = (id: number, data: { name?: string; email?: string }) =>
  sql`UPDATE users 
      SET ${sql.update(data, ["name", "email"])},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}`
```

### Repository with Batching and Caching

```typescript
class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String,
  createdAt: Schema.DateFromSelf
}) {}

export class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  {
    readonly findById: (id: number) => Effect.Effect<User, UserNotFoundError>
    readonly findByIds: (ids: readonly number[]) => Effect.Effect<readonly User[]>
    readonly findByEmail: (email: string) => Effect.Effect<User, UserNotFoundError>
  }
>() {
  static readonly Live = Layer.effect(
    this,
    Effect.gen(function* (_) {
      const sql = yield* _(SqlClient.SqlClient)
      
      // Batch multiple findById calls into a single query
      const GetById = yield* _(SqlResolver.findById("GetUserById", {
        Id: Schema.Number,
        Result: User,
        ResultId: (_) => _.id,
        execute: (ids) => sql`SELECT * FROM users WHERE ${sql.in("id", ids)}`
      }))
      
      // Batch findByEmail calls
      const GetByEmail = yield* _(SqlResolver.grouped("GetUserByEmail", {
        Request: Schema.String,
        RequestGroupKey: (email) => email,
        Result: User,
        ResultGroupKey: (user) => user.email,
        execute: (emails) => sql`SELECT * FROM users WHERE ${sql.in("email", emails)}`
      }))
      
      return UserRepository.of({
        findById: (id) => 
          Effect.withRequestCaching("on")(
            GetById.execute(id).pipe(
              Effect.catchTag("ResultNotFound", () =>
                Effect.fail(new UserNotFoundError({ id }))
              )
            )
          ),
          
        findByIds: (ids) =>
          Effect.forEach(ids, GetById.execute, { batching: true }),
          
        findByEmail: (email) =>
          Effect.withRequestCaching("on")(
            GetByEmail.execute(email).pipe(
              Effect.catchTag("ResultNotFound", () =>
                Effect.fail(new UserNotFoundError({ email }))
              ),
              Effect.map(users => users[0])
            )
          )
      })
    })
  )
}
```

### Migrations and Transactions

```typescript
import { SqliteMigrator } from "@effect/sql-sqlite-bun"
import { fileURLToPath } from "node:url"

const MigratorLive = SqliteMigrator.layer({
  loader: SqliteMigrator.fromFileSystem(
    fileURLToPath(new URL("./migrations", import.meta.url))
  ),
  schemaDirectory: "src/migrations"
}).pipe(Layer.provide(SqliteLive))

// Transaction example
const transferFunds = (fromId: number, toId: number, amount: number) =>
  Effect.gen(function* (_) {
    const sql = yield* _(SqlClient.SqlClient)
    
    yield* _(sql.withTransaction(
      Effect.gen(function* (_) {
        const debitResult = yield* _(sql`
          UPDATE accounts 
          SET balance = balance - ${amount}
          WHERE id = ${fromId} AND balance >= ${amount}
        `)
        
        if (debitResult.rowsAffected === 0) {
          return yield* _(Effect.fail(new InsufficientFundsError()))
        }
        
        yield* _(sql`
          UPDATE accounts 
          SET balance = balance + ${amount}
          WHERE id = ${toId}
        `)
      })
    ))
  })
```

## Bun Runtime Integration

### Installation

```bash
bun add effect @effect/platform @effect/platform-bun
bun add @effect/sql @effect/sql-sqlite-bun  # For SQLite
bun add -D vitest @effect/vitest             # For testing
```

### HTTP Server

```typescript
import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Layer } from "effect"

const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("Hello from Bun!")),
  HttpRouter.get("/health", HttpServerResponse.json({ status: "ok" }))
)

const app = router.pipe(HttpServer.serve(), HttpServer.withLogAddress)

BunRuntime.runMain(
  Layer.launch(Layer.provide(app, BunHttpServer.layer({ port: 3000 })))
)
```

### CLI Application

```typescript
import { Command, Options, Args } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

const port = Options.integer("port").pipe(
  Options.withDefault(3000),
  Options.withDescription("Port to listen on")
)

const app = Command.make("app", { port })

const cli = Command.run(app, { version: "1.0.0", name: "myapp" })

const main = cli(process.argv).pipe(
  Effect.provide(BunContext.layer),
  Effect.tapError((e) => Console.error("Error:", e))
)

BunRuntime.runMain(main)
```

## Schema Validation

```typescript
import { Schema, ParseResult } from "effect"

const User = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("UserId")),
  name: Schema.NonEmptyString,
  age: Schema.Number.pipe(Schema.between(0, 150)),
  email: Schema.String.pipe(Schema.pattern(/^.+@.+$/)),
  role: Schema.Literal("admin", "user", "guest"),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

type User = typeof User.Type

// Transformations
const PortNumber = Schema.String.pipe(
  Schema.transform(
    Schema.Number.pipe(Schema.between(1, 65535)),
    {
      decode: (s) => {
        const n = parseInt(s, 10)
        return isNaN(n) ? ParseResult.fail("Invalid number") : ParseResult.succeed(n)
      },
      encode: (n) => ParseResult.succeed(String(n))
    }
  )
)

// Recursive schemas
interface Category {
  name: string
  subcategories: ReadonlyArray<Category>
}

const Category: Schema.Schema<Category> = Schema.Struct({
  name: Schema.String,
  subcategories: Schema.Array(Schema.suspend(() => Category))
})
```

## HTTP Client

```typescript
import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform"
import { BunHttpClient, BunRuntime } from "@effect/platform-bun"
import { Effect, Schedule } from "effect"

const program = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  
  const todo = yield* client.get("https://jsonplaceholder.typicode.com/todos/1").pipe(
    HttpClientResponse.json
  )
  
  const newTodo = yield* client.post("https://jsonplaceholder.typicode.com/todos", {
    body: HttpClientRequest.jsonBody({
      title: "Learn Effect with Bun",
      completed: false
    })
  })
})

BunRuntime.runMain(
  program.pipe(Effect.provide(BunHttpClient.layer))
)

// Resilient requests
const resilientRequest = HttpClientRequest.get("/api/data").pipe(
  HttpClient.fetchOk,
  HttpClientResponse.json,
  Effect.retry(Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(3)))),
  Effect.timeout("30 seconds")
)
```

## Testing with Vitest

```typescript
import { it, expect } from "@effect/vitest"
import { Effect, Exit, TestClock, Layer } from "effect"

// Basic test
it.effect("should get user by id", () =>
  Effect.gen(function* () {
    const userService = yield* UserService
    const user = yield* userService.findById("123")
    expect(user.name).toBe("Test User")
  })
)

// Error handling test
it.effect("should handle user not found", () =>
  Effect.gen(function* () {
    const userService = yield* UserService
    const result = yield* Effect.exit(userService.findById("999"))
    expect(Exit.isFailure(result)).toBe(true)
  })
)

// Time-based test
it.effect("should handle timeouts", () =>
  Effect.gen(function* () {
    const service = yield* AsyncService
    const fiber = yield* service.longRunningOperation().pipe(Effect.fork)
    yield* TestClock.adjust("5 seconds")
    const result = yield* Fiber.join(fiber).pipe(Effect.either)
    expect(Either.isLeft(result)).toBe(true)
  })
)

// Test environment setup
export const TestEnv = Layer.mergeAll(
  UserService.Test,
  DatabaseService.Test,
  TestClock.layer
)
```

### Test Modifiers Reference

| Modifier | Usage | Description |
|----------|-------|-------------|
| `it.effect` | Standard Effect test | Provides Effect runtime |
| `it.live` | Integration test | Uses real implementations |
| `it.scoped` | Resource test | Manages scoped resources |
| `it.effect.skip` | Skip test | Temporarily disable |
| `it.effect.only` | Focus test | Run only this test |
| `it.effect.fails` | Expect failure | Test should fail |

## Best Practices and Guidelines

### Layer Composition

```typescript
// Production layers
export const AppLive = Layer.mergeAll(
  UserService.Live,
  PaymentService.Live,
  EmailService.Live
).pipe(
  Layer.provide(SqliteLive),
  Layer.provide(ConfigLive),
  Layer.provide(BunHttpClient.layer)
)

// Test layers
export const TestLive = Layer.mergeAll(
  UserService.Test,
  PaymentService.Test,
  EmailService.Test
).pipe(
  Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
  Layer.provide(ConfigTest)
)
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| **Services** | PascalCase + "Service" | `UserService`, `PaymentService` |
| **Layers** | PascalCase + suffix | `UserServiceLive`, `AppLive`, `TestLive` |
| **Errors** | PascalCase + "Error" | `UserNotFoundError`, `ValidationError` |
| **Schemas** | PascalCase | `User`, `CreateUserDto` |
| **Effect Programs** | camelCase | `getUser`, `processPayment` |
| **Config** | PascalCase + "Config" | `DatabaseConfig`, `AppConfig` |

### Code Style

- Use `Effect.gen` for sequential operations
- Use `pipe` for transformations
- Always use `yield*` (never plain `yield`)
- Let TypeScript infer types when possible
- Use `Bun.env` instead of `process.env` for Bun projects

### Common Patterns

| Pattern | Implementation | Use Case |
|---------|----------------|----------|
| **Repository** | `interface Repository<T, ID> { findById, save, delete }` | Data access |
| **Circuit Breaker** | `CircuitBreaker.make({ maxFailures: 5, timeout: "30s" })` | Prevent cascading failures |
| **Retry** | `Effect.retry(Schedule.exponential("100ms"))` | Transient failures |
| **Timeout** | `Effect.timeout("5 seconds")` | Prevent hanging |
| **Rate Limiting** | `RateLimiter.make({ requests: 100, window: "1 minute" })` | API throttling |

### Key Principles

1. **Service Design**: Single responsibility, pure interfaces, dependency injection
2. **Testing**: Mock external dependencies, use test utilities, ensure determinism
3. **Error Handling**: Use tagged errors, implement recovery strategies
4. **Performance**: Implement caching, use circuit breakers, add timeouts
5. **Code Organization**: Follow consistent naming, separate concerns, use layers

## Project Structure

```
my-effect-bun-app/
├── src/
│   ├── services/          # Service definitions
│   ├── layers/            # Layer compositions
│   ├── models/            # Domain models and schemas
│   ├── errors/            # Custom error types
│   ├── config/            # Configuration schemas
│   ├── db/
│   │   └── migrations/    # SQL migrations
│   └── main.ts
├── test/
│   ├── services/
│   └── integration/
├── bunfig.toml
├── vitest.config.ts
└── package.json
```

## Performance Tips

1. **Use Bun's Native APIs**: Prefer `Bun.file()`, `Bun.write()`, `Bun.password`
2. **SQLite Performance**: Bun's native SQLite is significantly faster
3. **Hot Reloading**: Use `bun --hot` for development
4. **Bundle for Production**: `bun build ./src/main.ts --outdir ./dist --target bun`

## Resources

- [Effect Documentation](https://effect.website/)
- [Effect GitHub](https://github.com/Effect-TS/effect)
- [Bun Documentation](https://bun.sh/)
- [@effect/platform-bun](https://github.com/Effect-TS/effect/tree/main/packages/platform-bun)
- Always search Context7: `mcp__context7__search "Effect-TS [topic] 2025"`