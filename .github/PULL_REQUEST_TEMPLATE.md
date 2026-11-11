## Summary

<!-- What does this change and why? Link issues: Closes #... -->

## Type

- [ ] Bug fix
- [ ] New tool / operation
- [ ] Design engine (templates, styles, planner, analyzer)
- [ ] Docs
- [ ] Other:

## Checks

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] `node scripts/gen-docs.mjs` (if tools/templates changed)
- [ ] `CHANGELOG.md` updated
- [ ] No `package-lock.json` / `yarn.lock`

## Illustrator verification

- [ ] Ran `scripts\integration-test.ps1` on Illustrator version: ____ — result: ____
- [ ] Not run (explain why). This PR is **unverified in Illustrator**.

## Security

- [ ] No new way to run arbitrary JSX/shell commands
- [ ] New file paths go through `PathPolicy`
- [ ] Destructive actions require `confirm: true`
