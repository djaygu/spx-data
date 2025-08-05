# TDD Development Checklist

## Pre-Implementation Phase
- [ ] Read and fully understand the task/story requirements
- [ ] Use sequential-thinking to break down complex tasks
- [ ] Identify all test scenarios (happy path, edge cases, error handling)
- [ ] Search Context7 for best practices: `mcp__context7__search "[library/framework] best practices 2025"`
- [ ] Document any architectural decisions based on Context7 findings

## RED Phase (Write Failing Tests)
- [ ] Write unit tests for the smallest testable units first
- [ ] Include tests for:
  - [ ] Happy path scenarios
  - [ ] Edge cases
  - [ ] Error handling
  - [ ] Input validation
- [ ] Run tests to confirm they fail appropriately
- [ ] Ensure test names clearly describe what they test

## Context7 Verification
- [ ] Search for implementation patterns: `mcp__context7__search "[feature] implementation [framework]"`
- [ ] Verify security best practices if handling user input
- [ ] Check for performance considerations
- [ ] Look for common pitfalls or anti-patterns
- [ ] Document any deviations from best practices with justification

## GREEN Phase (Implementation)
- [ ] Write minimal code to make tests pass
- [ ] Focus only on passing tests, not optimization
- [ ] Run tests frequently during implementation
- [ ] Commit once all tests pass

## REFACTOR Phase
- [ ] Improve code readability and structure
- [ ] Apply SOLID principles where appropriate
- [ ] Remove code duplication
- [ ] Ensure all tests still pass after refactoring
- [ ] Update documentation if needed

## Post-Implementation
- [ ] Run full test suite
- [ ] Verify test coverage meets project standards
- [ ] Update story file with implementation details
- [ ] Document any new patterns discovered
- [ ] Add learned best practices to technical-preferences.md