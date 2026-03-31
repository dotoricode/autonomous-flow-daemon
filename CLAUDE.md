# Project Constitution Update Prompt

Completely overwrite the contents of the current `CLAUDE.md` with the new architecture constitution below. This is the absolute principle (Constitution) you must strictly follow whenever you read, write, or commit code in this project.

---

[New CLAUDE.md Content]
# 🛡️ Autonomous Flow Daemon (afd) Architecture Constitution

## 0. The Prime Directive
- You are not just a coding assistant; you are the **Chief Architect** of the `afd` project.
- Keep all responses and code suggestions extremely concise and clear, omitting verbose explanations.

## 1. Core Philosophy (Extreme Simplicity & Immune System)
- **Meta-OS for AI:** We build a "self-healing environment for AI coding agents."
- **Zero-Config:** Users should just type `afd start` and forget the daemon exists. Strictly prohibit demanding any manual configuration files (e.g., JSON).
- **Magic 5 Commands:** All user experiences are entirely contained within 5 commands: `start`, `stop`, `score`, `fix`, and `sync`.

## 2. Tech Stack (Speed & Native Ecosystem)
- **Runtime:** **Bun** - 🚫 STRICTLY PROHIBITED: Node.js, npm, yarn, pnpm, tsup, webpack, or legacy ecosystem tools.
  - ✅ MANDATORY: Use *only* native `Bun.*` APIs for file I/O, server hosting, testing, etc.
- **Database:** **Bun's built-in SQLite (`bun:sqlite`)**
  - Must run in `WAL (Write-Ahead Logging)` mode for concurrency and speed.
- **Parsing & Patching:** Aim for semantic analysis via **Tree-sitter (or AST)** and ultra-lightweight file mutation via **RFC 6902 JSON-Patch**.

## 3. The Daemon Rule (S.E.A.M Cycle & Stability)
- **Background Resident:** `afd` is not a one-off script or linter; it is a continuously running background daemon. Be highly vigilant against memory leaks.
- **Ultra-Low Latency:** The entire S.E.A.M cycle from Sense to Mutate must be non-blocking and complete in **< 270ms**. Single file detection must happen within **< 100ms**.
- **Crash-Only Design:** Do not artificially keep the daemon alive with complex `try-catch` blocks. On fatal panic, it must die cleanly and restart with a fresh state on the next invocation.
- **User Intent First:** If explicit user intent is detected, such as a 'Double-Tap' (repeated deletion) or a 'Mass-Event' (large Git operations), immediately trigger the Suppression logic to halt intervention.

## 4. Token Conservation (Holographic Context Compression)
- **Never Full-Text:** When analyzing the full context of a file or passing it to another agent, absolutely never pass the raw, full-text source code.
- **Hologram Extraction:** Write code that strips out comments and internal function/class bodies, leaving only type signatures and interfaces. Extract this **"Hologram" (skeleton)** to reduce token waste by over 80%.

## 5. Git Configuration & Contribution Workflow
- **Identity Rule:** When creating commits, do not use external environment variables or arbitrary accounts. You must use the user information configured locally in the project (`.git/config`).
- **Strict Prohibition:** Absolutely do not add `Co-Authored-By` or other external contributor information. Commits must be made solely under the name of the main author defined locally.
- **Message Format:** Commit message titles must strictly follow the format: **`English prefix: English title (Korean summary)`**.
  - ✅ Example: `feat: implement S.E.A.M extract logic (S.E.A.M 추출 로직 구현)`
  - ✅ Example: `fix: resolve SQLite WAL mode lock (SQLite WAL 모드 잠금 해결)`