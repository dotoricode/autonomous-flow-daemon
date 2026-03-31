# Contributing to afd

Welcome. **afd** is built on one principle: a single `afd start` should make any AI coding environment self-healing. If you share that goal, you belong here.

---

## Vision Roadmap

| Version | Codename | Goal |
|---------|----------|------|
| v1.0.0 | The Immortal Flow | Stable S.E.A.M core, suppression safety, Magic 5 |
| v2.0.0 | The Hospital | Diagnostics UI, rule editor, remote healing |
| v3.0.0 | The Company | Multi-agent orchestration, team-level flow management |

If you are contributing toward v2 or v3, please open a discussion issue first to align on scope.

---

## Getting Started

**Prerequisites:** [Bun](https://bun.sh) >= 1.1.0

```bash
git clone https://github.com/your-org/autonomous-flow-daemon
cd autonomous-flow-daemon
bun install
bun test          # all 9 tests must be green before any PR
```

---

## Architecture Constraints

These are non-negotiable (see `CLAUDE.md`):

1. **Bun only** — no Node.js, no npm, no tsup. Use Bun APIs exclusively.
2. **SQLite in WAL mode** — all file events must be persisted within 100ms.
3. **Crash-only** — no complex recovery logic. Panic cleanly, restart on next call.
4. **Hologram-first** — when passing code to AI, strip comments and bodies. Skeletons only.

---

## Development Workflow

```bash
bun run dev          # run CLI directly
bun test             # run E2E suite
bun run src/cli.ts start   # start daemon in foreground
```

- All new features must include a test in `tests/`.
- S.E.A.M cycle changes require updating `docs/` accordingly.
- Suppression logic changes require updating `docs/06-suppression-safety-audit.md`.

---

## Pull Request Guidelines

- One concern per PR.
- Title format: `type: short description` (Conventional Commits).
- All 9 E2E tests must pass.
- If adding a new Magic command, update `README.md`, `README.ko.md`, and `CHANGELOG.md`.

---

## Code of Conduct

Be direct. Be kind. No bloat. The daemon never stops — neither do we.
