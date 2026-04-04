# Reddit r/ClaudeAI — Post Draft

**Title:** I built a daemon that saved 1.4M tokens in 5 days (83% compression) — and auto-heals files your AI breaks

---

I've been using Claude Code heavily for the past few months and ran into two recurring frustrations:

1. **Claude deletes or corrupts critical config files** (`.claudeignore`, `hooks.json`, `.cursorrules`) and you don't notice until your workflow is broken. Diagnosing and restoring manually kills 20–30 minutes of focus.
2. **Reading large files burns through your context window fast.** When Claude scans 8 files totaling ~114KB, that's roughly 28,600 tokens — most of which is function bodies Claude doesn't actually need.

So I built **afd** (Autonomous Flow Daemon) to solve both.

---

## What it does

**Self-healing:** afd runs as a background daemon watching your AI-sensitive files. If Claude accidentally wipes `.claudeignore`, afd detects the corruption in under 100ms and silently restores it from an antibody snapshot. Full heal cycle is < 270ms. You never have to stop coding.

**Hologram compression:** Instead of feeding Claude raw source files, afd extracts just the type signatures, interfaces, and function shapes — stripping comments and bodies. It calls this a "hologram." A 27KB TypeScript file becomes 921 characters. **97% compression.** Claude gets the structure it needs at 1/16th the token cost.

**Prompt caching:** v2.0.0 added real Anthropic prompt caching via `cache_control: ephemeral` on MCP resource responses. Repeated reads of the same hologram hit the cache instead of burning fresh tokens.

**Smart suppression:** afd distinguishes between accidents and intentional actions. If you run `git checkout` and 50 files change at once, it recognizes a "mass event" and stands down. If you delete a file twice in quick succession ("double-tap"), it respects that as intentional and doesn't restore.

---

## v2.0.0 — "Deep Context Engine" (released today)

- **4-language AST support:** TypeScript, Python, Go, Rust — Tree-sitter WASM parsing with cross-file call graph tracing up to 3 depths
- **Web dashboard:** `afd web` opens a glassmorphism-styled dashboard — single HTML file, no CDN, no build step
- **Honest token metrics:** Replaced the `chars÷4` hack with a content-aware estimator across 12 file extensions
- **Fixed port 51831:** No more hunting for a random port each session

---

## Numbers

| Situation | Without afd | With afd |
|:---|:---|:---|
| AI deletes `.claudeignore` | 30 min manual fix | 0.2s auto-heal |
| AI reads 8 large files (114KB) | ~28,600 tokens | ~860 tokens (97% saved) |
| Session token budget (full codebase scan) | Burns fast | ~60,900 tokens saved |
| CPU / RAM overhead | — | < 0.1% CPU, ~40MB RAM |

---

## Demo

[데모 GIF 삽입 자리 — demo.gif]

---

## One-line install

```bash
npx @dotoricode/afd setup
```

Interactive 4-step setup: daemon start → MCP registration → CLAUDE.md injection → health check. Done in under a minute. Zero config files to write manually.

---

## Links

- **GitHub:** https://github.com/dotoricode/autonomous-flow-daemon
- **npm:** https://www.npmjs.com/package/@dotoricode/afd

Happy to answer questions about the implementation — built on Bun with native SQLite (WAL mode), Tree-sitter WASM for AST parsing, and the MCP protocol for Claude integration.

---

*Cross-posted from a personal project. Not affiliated with Anthropic.*
