---
name: code-review-checklist
description: Self-review checklist before committing code changes. Use when reviewing code before commits, checking for security issues, validating code quality, or when the user asks about code review, pre-commit checks, or quality standards.
---

# Code Review Checklist

A comprehensive self-review checklist for solo developers to ensure code quality, security, and performance before committing.

## How to Use

Run through this checklist **before every commit** to catch issues early and maintain high code quality.

---

## 🔒 Security Checks

### Authentication & Authorization

- [ ] **Auth checks present** - All protected routes/endpoints verify authentication
- [ ] **Authorization verified** - Users can only access their own resources
- [ ] **Session management** - Sessions expire appropriately
- [ ] **Token validation** - JWT/tokens are validated on every request
- [ ] **Password handling** - Passwords are hashed (bcrypt, argon2) never stored plain
- [ ] **Password requirements** - Min length, complexity enforced if applicable

### Input Validation

- [ ] **All inputs validated** - User input is validated on both client and server
- [ ] **Type checking** - Expected data types enforced (string, number, email, etc.)
- [ ] **Length limits** - Input length restrictions prevent overflow
- [ ] **Whitelist approach** - Accept only known-good input patterns
- [ ] **File upload checks** - File type, size, content validated if accepting uploads
- [ ] **API parameter validation** - Query params, body, headers validated

### Injection Prevention

- [ ] **SQL injection safe** - Using parameterized queries/ORMs, no string concatenation
- [ ] **XSS prevention** - Output is escaped/sanitized, using framework protections
- [ ] **Command injection safe** - No user input passed to shell commands
- [ ] **Path traversal protected** - File paths sanitized, no `../` access
- [ ] **LDAP/NoSQL injection** - Inputs sanitized for relevant database types

### Data Protection

- [ ] **Secrets not in code** - API keys, passwords in environment variables or secrets manager
- [ ] **No hardcoded credentials** - Database passwords, tokens not in source code
- [ ] **Sensitive data encrypted** - PII, financial data encrypted at rest if applicable
- [ ] **HTTPS enforced** - All production traffic over TLS/SSL
- [ ] **CORS configured** - Cross-origin settings are restrictive and intentional
- [ ] **No data leaks in errors** - Error messages don't expose sensitive info

---

## 💎 Code Quality

### Naming

- [ ] **Variables descriptive** - Names explain purpose: `userEmail` not `ue` or `data`
- [ ] **Functions verb-based** - Start with action: `getUserById`, `calculateTotal`
- [ ] **Constants uppercase** - `MAX_RETRIES`, `API_BASE_URL`
- [ ] **Boolean names clear** - Prefix with `is`, `has`, `should`: `isActive`, `hasPermission`
- [ ] **No abbreviations** - Spell out words unless widely known (`id`, `url` OK)
- [ ] **Consistent conventions** - camelCase for JS, snake_case for Python, etc.

### Comments & Documentation

- [ ] **Complex logic commented** - Non-obvious code has explanatory comments
- [ ] **"Why" not "what"** - Comments explain reasoning, not just actions
- [ ] **No commented-out code** - Delete it, git history preserves old code
- [ ] **TODO items tracked** - TODOs have issue numbers or clear next steps
- [ ] **Public APIs documented** - Functions/classes have docstrings with params and return values
- [ ] **README updated** - If adding features, update setup/usage docs

### Complexity

- [ ] **Functions focused** - Each function does one thing (< 50 lines ideal)
- [ ] **Low cyclomatic complexity** - Minimal nested if/else (< 10 complexity score)
- [ ] **DRY principle** - No duplicate code blocks, extract to functions/utils
- [ ] **Early returns** - Exit early from functions to reduce nesting
- [ ] **Avoid deep nesting** - Max 3-4 levels of indentation
- [ ] **Magic numbers extracted** - Use named constants instead of raw numbers

---

## ⚡ Performance

### Database Queries

- [ ] **No N+1 queries** - Use joins or eager loading instead of queries in loops
- [ ] **Indexes on lookups** - Frequently queried columns have database indexes
- [ ] **Pagination implemented** - Large result sets paginated, not loaded all at once
- [ ] **Query only needed fields** - Select specific columns, not `SELECT *`
- [ ] **Connection pooling** - Database connections reused, not created per request
- [ ] **Avoid OR queries** - Use `IN` clause or separate indexed queries

### Caching

- [ ] **Cache static data** - Reference data cached (countries, categories, etc.)
- [ ] **Cache expensive ops** - Slow computations or API calls cached when appropriate
- [ ] **Cache invalidation** - Stale cache cleared on data updates
- [ ] **HTTP caching headers** - Static assets have proper cache headers
- [ ] **Memo-ization used** - Repeated function calls with same inputs memoized

### Code Efficiency

- [ ] **No unnecessary loops** - Single pass when possible, avoid nested loops
- [ ] **Efficient data structures** - Use Map/Set for lookups, not array.find()
- [ ] **Lazy loading** - Load data only when needed, not upfront
- [ ] **Avoid premature optimization** - Profile first, don't optimize without measurement
- [ ] **Async/await properly** - Asynchronous operations don't block unnecessarily
- [ ] **Batch operations** - Bulk inserts/updates instead of individual operations

---

## 🧪 Testing

### Test Coverage

- [ ] **New code has tests** - All new functions/features have unit tests
- [ ] **Edge cases tested** - Test empty inputs, null values, boundary conditions
- [ ] **Happy path tested** - Normal expected use case has test coverage
- [ ] **Error paths tested** - Test error handling and failure scenarios
- [ ] **Integration points tested** - API endpoints, database queries tested
- [ ] **No tests skipped** - All tests run and pass, no `.skip()` or disabled tests

### Test Quality

- [ ] **Tests are independent** - Each test runs in isolation, no shared state
- [ ] **Descriptive test names** - Test names explain what they verify
- [ ] **Arrange-Act-Assert** - Clear setup, execution, verification structure
- [ ] **Mock external deps** - APIs, databases, file system mocked in unit tests
- [ ] **Fast test execution** - Unit tests run in < 1 second each
- [ ] **No flaky tests** - Tests pass consistently, no random failures

---

## 📚 Documentation

### When to Update Docs

- [ ] **API changes** - Update OpenAPI/Swagger specs if endpoints changed
- [ ] **New features** - Add usage examples to README or docs
- [ ] **Breaking changes** - Document migration steps in CHANGELOG
- [ ] **Config changes** - Update .env.example with new environment variables
- [ ] **Dependencies added** - Update package.json/requirements.txt properly
- [ ] **Setup changes** - Update installation/setup instructions if changed

### What to Document

- [ ] **Function signatures** - Params, return types, exceptions thrown
- [ ] **Complex algorithms** - High-level explanation of approach
- [ ] **Business logic** - Why certain decisions were made
- [ ] **Known limitations** - Document workarounds or constraints
- [ ] **Example usage** - Show how to use new features/APIs

---

## 🚨 Error Handling

### Error Patterns

- [ ] **Try-catch blocks** - Async operations wrapped in error handling
- [ ] **Specific error types** - Catch specific exceptions, not generic `catch (e)`
- [ ] **Errors logged** - All errors logged with context (user ID, timestamp, action)
- [ ] **User-friendly messages** - Show helpful errors to users, not stack traces
- [ ] **Fail gracefully** - App doesn't crash, shows fallback UI on errors
- [ ] **Retry logic** - Transient failures (network, API) have retry with backoff

### Error Prevention

- [ ] **Null/undefined checks** - Check for null before accessing properties
- [ ] **Array bounds** - Verify array has elements before accessing indexes
- [ ] **Type guards** - TypeScript type checks or runtime type validation
- [ ] **Default values** - Provide sensible defaults with destructuring/defaults
- [ ] **Validation before processing** - Validate data before operations that could fail

---

## 🐛 Common Mistakes

### Code Smells to Avoid

- [ ] **No console.log() left** - Remove debug logging before commit
- [ ] **No debugger statements** - Remove breakpoints from production code
- [ ] **No unused variables** - Clean up variables, imports, functions not being used
- [ ] **No dead code** - Delete unreachable code paths
- [ ] **No TODO without context** - Either fix now or create issue with TODO reference
- [ ] **No commented code blocks** - Delete commented code, git preserves history

### Common Pitfalls

- [ ] **Not handling promises** - All promises have `.catch()` or try-catch
- [ ] **Mutating state directly** - Use immutable updates in React, avoid direct mutation
- [ ] **Hardcoded URLs/paths** - Use config variables, not hardcoded strings
- [ ] **Not validating env vars** - Check required env vars exist at startup
- [ ] **Race conditions** - Async operations properly synchronized
- [ ] **Memory leaks** - Event listeners cleaned up, intervals cleared, subscriptions unsubscribed

---

## ✅ Pre-Commit Final Check

Before running `git commit`, verify:

1. [ ] **Code compiles** - No syntax errors, TypeScript types valid
2. [ ] **All tests pass** - Run full test suite: `npm test` or `pytest`
3. [ ] **Linter passes** - No ESLint/Flake8 errors: `npm run lint`
4. [ ] **Formatting applied** - Code formatted with Prettier/Black
5. [ ] **No secrets committed** - Scan for API keys, passwords before staging
6. [ ] **Build succeeds** - Production build completes: `npm run build`
7. [ ] **Manual smoke test** - Manually tested changed functionality works
8. [ ] **Commit message ready** - Following commit-standards skill conventions

---

## Quick Checklist (Abbreviated)

For quick reviews, focus on these critical items:

### Security (Must Have)
- [ ] Input validated
- [ ] SQL injection protected
- [ ] XSS prevented
- [ ] Secrets not in code

### Quality (Must Have)
- [ ] Descriptive names
- [ ] Functions < 50 lines
- [ ] No duplicate code
- [ ] Tests added

### Performance (Should Have)
- [ ] No N+1 queries
- [ ] Caching considered
- [ ] Async/await proper

### Pre-Commit (Must Have)
- [ ] Tests pass
- [ ] Linter clean
- [ ] No debug code
- [ ] Manual test done

---

## Integration with Workflow

### Before Committing

```bash
# 1. Run this checklist mentally or with a script
# 2. Fix any issues found
# 3. Run automated checks
npm run lint
npm test
npm run build

# 4. Review the diff
git diff

# 5. Stage and commit using commit-standards
git add <files>
git commit -m "feat(scope): description"
```

### Automation Ideas

Create pre-commit hooks to automate checks:

```bash
# .git/hooks/pre-commit
#!/bin/sh
npm run lint || exit 1
npm test || exit 1
echo "✅ Pre-commit checks passed"
```

---

## Tips for Solo Developers

1. **Don't skip this** - Even solo devs benefit from systematic review
2. **Use git diff** - Review all changes before committing
3. **Take breaks** - Review code with fresh eyes after breaks
4. **Read code aloud** - Helps catch logical errors
5. **Question everything** - "Is this the simplest solution?"
6. **Future-proof** - "Will I understand this in 6 months?"
7. **Security first** - Don't defer security fixes, handle immediately

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Security vulnerabilities
- [Clean Code Principles](https://github.com/ryanmcdermott/clean-code-javascript)
- [Code Review Best Practices](https://google.github.io/eng-practices/review/)
