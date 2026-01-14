---
name: test
description: Run the test suite for SnipSolve. Use when the user wants to run tests, check if tests pass, verify code changes, or asks about test results. Supports watch mode and coverage reports.
---

# Test Runner

Run the Vitest test suite to verify code changes and check for regressions.

## Quick Start

Run all tests once:
```bash
npm test
```

## Instructions

When the user invokes `/test` or asks to run tests:

1. **Determine the test mode** based on arguments:
   - No args: Run all tests once (`npm test`)
   - `--watch` or `-w`: Run in watch mode (`npm run test:watch`)
   - `--coverage` or `-c`: Run with coverage report (`npm run test:coverage`)

2. **Execute the appropriate command** using the Bash tool

3. **Report results clearly**:
   - Total tests passed/failed
   - Which test files ran
   - Any failing test details with file:line references
   - For coverage: show percentage covered

4. **If tests fail**, offer to:
   - Show the failing test code
   - Navigate to the source code causing the failure
   - Suggest fixes based on the error message

## Usage Examples

| Command | Action |
|---------|--------|
| `/test` | Run all tests once |
| `/test --watch` | Run tests in watch mode (re-runs on file changes) |
| `/test --coverage` | Run tests with coverage report |
| `/test search` | Run tests matching "search" pattern |

## Test File Locations

- Test files: `src/**/*.test.ts` or `src/**/*.spec.ts`
- Test setup: `src/test/setup.ts`
- Config: `vitest.config.ts`

## Interpreting Results

**Passing output:**
```
✓ src/utils/search.test.ts (12 tests) 5ms
Test Files  1 passed (1)
Tests  12 passed (12)
```

**Failing output:**
```
✗ src/utils/search.test.ts (1 failed | 11 passed)
  ✗ should find documents matching keywords
    AssertionError: expected [] to have length > 0
```

## Adding New Tests

When asked to add tests:

1. Create test file next to source: `feature.ts` → `feature.test.ts`
2. Use this structure:
```typescript
import { describe, it, expect } from 'vitest'
import { functionToTest } from './feature'

describe('functionToTest', () => {
  it('should do something', () => {
    expect(functionToTest(input)).toBe(expected)
  })
})
```

3. Run `/test` to verify
