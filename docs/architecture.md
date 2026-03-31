# Architecture Overview

> afd 프로젝트의 전체 아키텍처와 핵심 설계 원칙을 기술한다.

---

## 1. System Diagram

<!-- TODO: ASCII or Mermaid diagram of daemon ↔ CLI ↔ hooks ↔ MCP flow -->

## 2. Core Modules

### 2.1 Daemon (`src/daemon/`)
<!-- server.ts: HTTP IPC, file watcher, S.E.A.M cycle -->
<!-- client.ts: daemon discovery, health check -->

### 2.2 Commands (`src/commands/`)
<!-- start, stop, score, fix, sync, diagnose -->

### 2.3 Core (`src/core/`)
<!-- immune.ts, hologram.ts, db.ts, notify.ts, log-utils.ts, lru-map.ts, log-rotate.ts -->

### 2.4 Adapters (`src/adapters/`)
<!-- Claude Code, Cursor — hook injection, status line -->

### 2.5 Platform (`src/platform.ts`)
<!-- Cross-platform abstraction: spawn, notify, hook command resolution -->

## 3. S.E.A.M Cycle

### 3.1 Sense
<!-- File watcher (chokidar), smart discovery -->

### 3.2 Extract
<!-- Hologram generation, antibody lookup -->

### 3.3 Adapt
<!-- Antibody learning, auto-seed, dormant transitions -->

### 3.4 Mutate
<!-- Auto-heal, file restoration, patch application -->

## 4. Suppression Safety

### 4.1 Double-Tap Heuristic
### 4.2 Mass-Event Detection

## 5. IPC Strategy

<!-- HTTP on dynamic port, PID/port file discovery, no Unix sockets -->

## 6. Data Layer

### 6.1 SQLite (bun:sqlite, WAL mode)
### 6.2 Tables: events, antibodies, unlink_log

## 7. Performance Constraints

<!-- < 270ms S.E.A.M cycle, < 100ms single file detection, < 0.1% CPU, ~40MB RAM -->
