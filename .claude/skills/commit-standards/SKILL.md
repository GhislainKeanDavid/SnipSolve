---
name: commit-standards
description: Git commit conventions and standards for consistent version control. Use when creating commits, writing commit messages, naming branches, or when the user asks about Git conventions, commit format, or version control best practices.
---

# Commit Standards

Establish consistent Git commit conventions for clean, professional version control.

## Commit Message Format

Follow **Conventional Commits** specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **chore**: Build process, dependencies, tooling
- **ci**: CI/CD configuration changes

### Scope (optional but recommended)

Indicates the section of codebase affected:
- `auth`, `api`, `ui`, `db`, `config`, etc.

### Description

- Use imperative mood ("add" not "added" or "adds")
- Start with lowercase
- No period at the end
- Max 72 characters

## When to Commit

### Atomic Commits ✅

Each commit should be a **single logical unit**:
- One feature or fix per commit
- All tests pass after the commit
- Code compiles/runs without errors
- Can be reverted independently

### Commit Frequency

**DO commit when:**
- Feature is complete (even if small)
- Bug is fixed
- Refactoring is done
- Tests are added/updated
- Documentation is updated
- Before switching context or tasks

**DON'T commit:**
- Broken code (unless WIP branch)
- Code that doesn't compile
- Failing tests (unless explicitly marking as WIP)
- Multiple unrelated changes together

## Examples

### ✅ Good Commits

```bash
feat(auth): add password reset functionality

Implements email-based password reset flow with token expiration.
Users receive reset link valid for 1 hour.

Closes #123
```

```bash
fix(api): prevent null pointer in user lookup

Added null check before accessing user.email property.
Returns 404 if user not found instead of crashing.
```

```bash
docs: update API endpoint documentation

Added examples for /auth/login and /auth/register endpoints.
```

```bash
refactor(ui): extract button component

Moved button styles into reusable Button component.
No functional changes.
```

```bash
perf(db): add index on users.email column

Improves login query performance by 60%.
```

### ❌ Bad Commits

```bash
# Too vague
fix: bug fix

# Multiple changes
feat: add login, signup, and password reset

# Wrong tense
added new feature

# Too long description
feat(auth): this commit adds a new authentication system with JWT tokens and also refactors the user model and updates the database schema and fixes a bug in the login endpoint

# Non-descriptive
update stuff
```

## Branch Naming Conventions

### Format

```
<type>/<short-description>
```

### Examples

```bash
feat/user-authentication
fix/login-validation-bug
refactor/api-error-handling
docs/api-endpoints
chore/upgrade-dependencies
```

### Branch Types

- **feat/**: New features
- **fix/**: Bug fixes
- **refactor/**: Code refactoring
- **docs/**: Documentation updates
- **chore/**: Maintenance tasks
- **test/**: Test-related changes
- **hotfix/**: Urgent production fixes

### Rules

- Use lowercase and hyphens
- Keep it short but descriptive
- No spaces or special characters
- Delete branches after merging

## When to Push vs. Keep Local

### Push to Remote When:

✅ **End of work session** - Share progress with team/backup
✅ **Feature is complete** - Ready for review or integration
✅ **Need collaboration** - Others need to see your work
✅ **CI/CD testing** - Trigger automated tests
✅ **Before switching machines** - Ensure work is backed up

### Keep Local When:

⏸️ **Work in progress** - Code is incomplete or broken
⏸️ **Experimental changes** - Trying different approaches
⏸️ **Frequent small commits** - Squash them first with `git rebase -i`
⏸️ **Private experiments** - Not ready to share

### Best Practice for Solo Dev:

1. **Commit locally often** (every logical change)
2. **Squash related commits** before pushing
3. **Push at least daily** for backup
4. **Push before EOD** always

## Quick Reference

### Commit Template

```bash
# Example workflow
git add <files>
git commit -m "feat(scope): add feature description"

# With body
git commit -m "feat(scope): add feature description" -m "Detailed explanation of changes and why they were made."

# Push when ready
git push origin <branch-name>
```

### Common Workflow

```bash
# 1. Create feature branch
git checkout -b feat/new-feature

# 2. Make changes and commit atomically
git add src/feature.js
git commit -m "feat(feature): implement core logic"

git add tests/feature.test.js
git commit -m "test(feature): add unit tests"

# 3. Push when ready
git push origin feat/new-feature

# 4. Create pull request (if using PRs)
# 5. Merge and delete branch
git checkout main
git pull
git branch -d feat/new-feature
```

## Pre-Commit Checklist

Before committing, verify:

- [ ] Code compiles/runs without errors
- [ ] All tests pass
- [ ] No debug statements or console.logs left
- [ ] No commented-out code blocks
- [ ] Commit message follows convention
- [ ] Only related changes in this commit
- [ ] Secrets/credentials not included

## Tips

1. **Use `git add -p`** for selective staging (commit parts of files)
2. **Amend last commit** if you forgot something: `git commit --amend`
3. **Squash commits** before pushing: `git rebase -i HEAD~3`
4. **Write commit body** for complex changes explaining "why"
5. **Reference issues** in commit messages: `Closes #123`, `Fixes #456`

## Integration with Code Review

After making commits:
1. Run the `code-review-checklist` skill before pushing
2. Ensure all checklist items pass
3. Push to remote
4. Create pull request (if using PR workflow)

## Common Mistakes to Avoid

❌ Committing directly to `main`/`master`
❌ Committing node_modules or build artifacts
❌ Committing secrets or API keys
❌ Making commits too large (>500 lines changed)
❌ Using vague messages like "fix", "update", "changes"
❌ Committing broken code to shared branches
❌ Not syncing with remote before starting work

## Resources

- [Conventional Commits Spec](https://www.conventionalcommits.org/)
- [How to Write a Git Commit Message](https://chris.beams.io/posts/git-commit/)
