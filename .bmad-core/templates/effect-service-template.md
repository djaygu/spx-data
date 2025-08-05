# Effect-TS Service Template

Use this template when implementing any new service with Effect-TS.

## Service Implementation Template

```typescript
// src/services/[ServiceName].ts
import { Context, Effect, Layer, Data, Schema } from "effect"
import { SqlClient, sql } from "@effect/sql"
import { [Model]Schema, Create[Model]Schema, Update[Model]Schema } from "../models/[Model]"

// 1. Define tagged errors for this service
export class [ServiceName]NotFoundError extends Data.TaggedError("[ServiceName]NotFoundError")<{
  readonly [model]Id: string
}> {}

export class [ServiceName]ValidationError extends Data.TaggedError("[ServiceName]ValidationError")<{
  readonly errors: ReadonlyArray<string>
}> {}

// 2. Define service interface and Context.Tag
export class [ServiceName] extends Context.Tag("[ServiceName]")<
  [ServiceName],
  {
    readonly findById: (id: string) => Effect.Effect<[Model], [ServiceName]NotFoundError>
    readonly create: (data: Create[Model]Dto) => Effect.Effect<[Model], [ServiceName]ValidationError>
    readonly update: (id: string, data: Update[Model]Dto) => Effect.Effect<[Model], [ServiceName]NotFoundError | [ServiceName]ValidationError>
    readonly delete: (id: string) => Effect.Effect<void, [ServiceName]NotFoundError>
  }
>() {
  // 3. Live implementation
  static readonly Live = Layer.effect(
    this,
    Effect.gen(function* (_) {
      // Inject dependencies
      const sql = yield* _(SqlClient.SqlClient)
      
      return [ServiceName].of({
        findById: (id) => 
          Effect.gen(function* (_) {
            const result = yield* _(sql`SELECT * FROM [table] WHERE id = ${id}`.pipe(
              sql.withTransaction,
              Effect.map(_ => _[0]),
              Effect.flatMap(Schema.decodeUnknown([Model]Schema))
            ))
            if (!result) {
              return yield* _(Effect.fail(new [ServiceName]NotFoundError({ [model]Id: id })))
            }
            return result
          }),
          
        create: (data) =>
          Effect.gen(function* (_) {
            const validated = yield* _(Schema.decodeUnknown(Create[Model]Schema)(data))
            const result = yield* _(sql`
              INSERT INTO [table] (${sql.unsafe(Object.keys(validated).join(", "))})
              VALUES (${sql.unsafe(Object.keys(validated).map(() => "?").join(", "))})
              RETURNING *
            `.pipe(
              sql.withTransaction,
              Effect.map(_ => _[0]),
              Effect.flatMap(Schema.decodeUnknown([Model]Schema))
            ))
            return result
          }),
          
        update: (id, data) =>
          Effect.gen(function* (_) {
            const validated = yield* _(Schema.decodeUnknown(Update[Model]Schema)(data))
            const result = yield* _(sql`
              UPDATE [table]
              SET ${sql.update(validated)},
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ${id}
              RETURNING *
            `.pipe(
              sql.withTransaction,
              Effect.map(_ => _[0]),
              Effect.flatMap(Schema.decodeUnknown([Model]Schema))
            ))
            if (!result) {
              return yield* _(Effect.fail(new [ServiceName]NotFoundError({ [model]Id: id })))
            }
            return result
          }),
          
        delete: (id) =>
          Effect.gen(function* (_) {
            const result = yield* _(sql`
              DELETE FROM [table]
              WHERE id = ${id}
            `.pipe(sql.withTransaction))
            if (result.rowsAffected === 0) {
              return yield* _(Effect.fail(new [ServiceName]NotFoundError({ [model]Id: id })))
            }
          })
      })
    })
  )
  
  // 4. Test implementation
  static readonly Test = Layer.succeed(
    this,
    [ServiceName].of({
      findById: (id) => 
        id === "test-id" 
          ? Effect.succeed({ id: "test-id", /* test data */ })
          : Effect.fail(new [ServiceName]NotFoundError({ [model]Id: id })),
          
      create: (data) => 
        Effect.succeed({ id: "generated-id", ...data }),
        
      update: (id, data) =>
        id === "test-id"
          ? Effect.succeed({ id, ...data })
          : Effect.fail(new [ServiceName]NotFoundError({ [model]Id: id })),
          
      delete: (id) =>
        id === "test-id"
          ? Effect.succeed(undefined)
          : Effect.fail(new [ServiceName]NotFoundError({ [model]Id: id }))
    })
  )
}
```

## Test File Template

```typescript
// src/services/__tests__/[ServiceName].test.ts
import { it, expect } from "@effect/vitest"
import { Effect, Exit, Layer } from "effect"
import { [ServiceName], [ServiceName]NotFoundError, [ServiceName]ValidationError } from "../[ServiceName]"

// Test with mock layer
const TestEnv = Layer.mergeAll(
  [ServiceName].Test,
  // Add other test dependencies
)

it.effect("should find [model] by id", () =>
  Effect.gen(function* () {
    const service = yield* [ServiceName]
    const result = yield* service.findById("test-id")
    expect(result.id).toBe("test-id")
  }).pipe(Effect.provide(TestEnv))
)

it.effect("should return [ServiceName]NotFoundError when [model] not found", () =>
  Effect.gen(function* () {
    const service = yield* [ServiceName]
    const exit = yield* Effect.exit(service.findById("unknown-id"))
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(exit.cause._tag).toBe("Fail")
    }
  }).pipe(Effect.provide(TestEnv))
)

it.effect("should create new [model]", () =>
  Effect.gen(function* () {
    const service = yield* [ServiceName]
    const result = yield* service.create({ /* test data */ })
    expect(result.id).toBeDefined()
  }).pipe(Effect.provide(TestEnv))
)

it.effect("should update existing [model]", () =>
  Effect.gen(function* () {
    const service = yield* [ServiceName]
    const result = yield* service.update("test-id", { /* update data */ })
    expect(result.id).toBe("test-id")
  }).pipe(Effect.provide(TestEnv))
)

it.effect("should delete [model]", () =>
  Effect.gen(function* () {
    const service = yield* [ServiceName]
    yield* service.delete("test-id")
    // Verify deletion succeeded (no error thrown)
  }).pipe(Effect.provide(TestEnv))
)
```

## Schema Definition Template

```typescript
// src/models/[Model].ts
import { Schema } from "effect"

export class [Model] extends Schema.Class<[Model]>("[Model]")({
  id: Schema.String,
  name: Schema.NonEmptyString,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf
}) {}

export const Create[Model]Schema = Schema.Struct({
  name: Schema.NonEmptyString,
  // other fields without id and timestamps
})

export const Update[Model]Schema = Schema.partial(Create[Model]Schema)
```

## Repository Pattern with Batching (Advanced)

```typescript
// src/repositories/[Model]Repository.ts
import { Context, Effect, Layer } from "effect"
import { SqlClient, SqlResolver } from "@effect/sql"
import { [Model]Schema } from "../models/[Model]"
import { [ServiceName]NotFoundError } from "../services/[ServiceName]"

export class [Model]Repository extends Context.Tag("[Model]Repository")<
  [Model]Repository,
  {
    readonly findById: (id: string) => Effect.Effect<[Model], [ServiceName]NotFoundError>
    readonly findByIds: (ids: readonly string[]) => Effect.Effect<readonly [Model][]>
  }
>() {
  static readonly Live = Layer.effect(
    this,
    Effect.gen(function* (_) {
      const sql = yield* _(SqlClient.SqlClient)
      
      // Batch multiple findById calls
      const GetById = yield* _(SqlResolver.findById("Get[Model]ById", {
        Id: Schema.String,
        Result: [Model]Schema,
        ResultId: (_) => _.id,
        execute: (ids) => sql`SELECT * FROM [table] WHERE ${sql.in("id", ids)}`
      }))
      
      return [Model]Repository.of({
        findById: (id) => 
          Effect.withRequestCaching("on")(
            GetById.execute(id).pipe(
              Effect.catchTag("ResultNotFound", () =>
                Effect.fail(new [ServiceName]NotFoundError({ [model]Id: id }))
              )
            )
          ),
          
        findByIds: (ids) =>
          Effect.forEach(ids, GetById.execute, { batching: true })
      })
    })
  )
}
```

## Usage Instructions

1. Replace all placeholders in square brackets `[ServiceName]`, `[Model]`, `[model]`, `[table]` with actual names
2. Create Schema definitions first using the Schema template
3. Write tests FIRST using the test template
4. Run tests to ensure they fail
5. Implement the service to make tests pass
6. Add service to your application Layer composition
7. Consider using Repository pattern for complex data access with batching/caching needs