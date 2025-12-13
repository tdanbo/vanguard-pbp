# Codebase Validate

Run all validation checks and fix issues until the codebase is clean.

## Steps

Run each validation step in sequence. If any step fails, fix the issues and re-run from the beginning.

1. **Generate types**: `make types`
2. **Lint frontend**: `make frontend-lint`
3. **Lint backend**: `make backend-lint`
4. **Run backend tests**: `make backend-test`
5. **Build frontend**: `make frontend-build`
6. **Build backend**: `make backend-build`

## Important

**Do not stop until ALL validation steps pass.** After fixing any issue, re-run the full validation sequence to ensure no regressions were introduced. Continue iterating until all 6 steps complete successfully.
