# User-Defined Preferred Patterns and Preferences

## Development Methodology

### Test-Driven Development (TDD)
- **MANDATORY**: Follow strict TDD practices for all development
- **Process**: Red-Green-Refactor cycle
  1. RED: Write failing tests first
  2. GREEN: Write minimal code to pass tests
  3. REFACTOR: Improve code while keeping tests green
- **Coverage**: Aim for high test coverage on all new code

### MCP Context7 Integration
- **Tool**: Use `mcp__context7__search` for all framework/library decisions
- **When to use**:
  - Before implementing any new library/framework feature
  - When uncertain about best practices
  - To verify current implementation patterns
- **Search patterns**:
  - "[library] best practices [current year]"
  - "[framework] [feature] implementation guide"
  - "[technology] performance optimization"

### Sequential Thinking
- **Tool**: Use `sequential-thinking` for complex implementations
- **When to use**:
  - Tasks with multiple interdependent steps
  - Complex architectural decisions
  - Debugging intricate issues
- **Benefits**:
  - Clear step-by-step planning
  - Reduced cognitive load
  - Better error prevention

## Effect-TS Specific Patterns

### Service Layer Architecture
- **MANDATORY for Effect-TS projects**: Use service layer pattern with Context.Tag
- **Dependency Injection**: Use Layer composition for all dependencies
- **Testing**: Create Test layers for all services to enable easy mocking
- **Error Handling**: Use tagged errors (Data.TaggedError) for type-safe error handling

### Effect-TS Best Practices
1. **Service Declaration Pattern**:
   - Define interface first
   - Create Context.Tag for service identification
   - Implement with Layer.effect or Layer.succeed
   - Use "Live" suffix for production, "Test" for testing

2. **Layer Composition**:
   - Vertical layers for related services
   - Use Layer.provide for dependency injection
   - Layer.scoped for resources needing cleanup
   - Config module for environment settings

3. **Testing with Effect**:
   - Always create Test implementations of services
   - Use Layer.mock for partial mocks
   - Leverage TestClock and TestRandom for deterministic tests
   - Test error scenarios with specific error types

4. **Effect.gen Usage**:
   - Use for sequential operations
   - Avoid deeply nested generators
   - Let TypeScript infer types
   - Use yield* for Effect unwrapping

## Implementation Guidelines

### Before Writing Any Code
1. Read and understand the complete task/story
2. Use sequential-thinking if task is complex
3. Write comprehensive tests that will fail (RED phase)
4. Search Context7 for best practices related to the implementation
5. Plan the implementation approach based on findings

### During Implementation
1. Write minimal code to make tests pass (GREEN phase)
2. Continuously run tests to ensure nothing breaks
3. Refactor only after tests are green (REFACTOR phase)
4. Document any deviations from best practices with justification

### After Implementation
1. Ensure all tests pass
2. Review code against Context7 best practices
3. Update documentation if new patterns were introduced
4. Add any learned patterns to this preferences file