# CLI Reference

> `afd` 명령어 전체 레퍼런스.

---

## Global Options

| Flag | Description |
|------|-------------|
| `-V, --version` | Show version |
| `-h, --help` | Show help |

---

## Commands

### `afd start`

<!-- Start the background daemon -->

| Option | Description |
|--------|-------------|
| `--mcp` | Run in MCP stdio mode (foreground, JSON-RPC on stdin/stdout) |

### `afd stop`

<!-- Stop the running daemon via HTTP /stop endpoint -->

### `afd score`

<!-- Display daemon diagnostics dashboard -->

### `afd fix`

<!-- Interactive symptom fixing with patch application -->

### `afd sync`

<!-- Export antibodies as vaccine payload JSON -->

### `afd diagnose`

<!-- Headless diagnosis for hook automation -->

| Option | Description |
|--------|-------------|
| `--format <type>` | Output format: `a2a` or `human` (default: `human`) |
| `--auto-heal` | Auto-apply patches for known antibodies |

### `afd lang [language]`

<!-- Show or change display language (en, ko) -->

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Daemon failed to start or command error |

## Environment Variables

<!-- TODO: document any env vars (none currently) -->

## Files

| Path | Purpose |
|------|---------|
| `.afd/daemon.pid` | Running daemon PID |
| `.afd/daemon.port` | HTTP IPC port |
| `.afd/daemon.log` | Daemon log (rotated at 5MB) |
| `.afd/antibodies.sqlite` | Learned antibody database |
| `.afd/global-vaccine-payload.json` | Exported vaccine payload |
