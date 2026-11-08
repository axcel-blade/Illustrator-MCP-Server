# Contributing

Thanks for helping improve Illustrator AI Design MCP.

## Ground rules

- **pnpm only.** Never commit `package-lock.json` or `yarn.lock`.
- **Never fake success.** A tool may only report success when Illustrator (or the server, for pure computations) actually did the work. Label mock results and unverified behaviour.
- **No arbitrary execution.** New capabilities must be allowlisted operations with strict Zod schemas — never a tool that runs client-supplied JSX or shell commands.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

```powershell
corepack enable
pnpm install
pnpm build
pnpm test
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the layout and how to add operations, tools, templates and styles.

## Before opening a pull request

```powershell
pnpm typecheck
pnpm lint
pnpm build
pnpm test
node scripts/gen-docs.mjs   # if you changed tools or templates
```

If you touched `illustrator-scripts/` or the bridge, also run `scripts\integration-test.ps1` against a real Illustrator and paste the summary from `output/integration/report.json` into the PR. If you could not run it, say so — the PR will be labelled *unverified in Illustrator*.

## Branches and commits

- Branch from `develop` (`feature/...`, `fix/...`, `docs/...`); PRs target `develop`. `main` holds releases.
- Keep commits focused; describe *why* in the message.
- Update `CHANGELOG.md` under an "Unreleased" heading for user-visible changes.

## Reporting bugs and requesting features

Use the issue templates. For security problems, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
