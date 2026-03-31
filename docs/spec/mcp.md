# MCP Integration Planning (Phase 113)

> Model Context Protocol (MCP) stdio 모드 완성을 위한 설계 및 구현 계획.

---

## 1. Current State

<!-- server.ts의 MCP 핸들러: tool listing만 반환, 실행 미구현 -->

## 2. Target MCP Tools

### 2.1 `afd_diagnose`
<!-- Run health diagnosis, return symptoms/patches -->

### 2.2 `afd_score`
<!-- Return daemon stats: uptime, events, heals, hologram savings -->

### 2.3 `afd_hologram`
<!-- Generate hologram for a given file path -->

### 2.4 `afd_antibodies` (candidate)
<!-- List/manage learned antibodies -->

## 3. JSON-RPC Protocol

### 3.1 Request Format
### 3.2 Response Format
### 3.3 Error Handling

## 4. Tool Schema (MCP Specification)

<!-- tools/list → tool definitions with inputSchema -->
<!-- tools/call → dispatch to handlers -->

## 5. Integration with Claude Code

### 5.1 mcp-config.json
### 5.2 stdio transport setup
### 5.3 Permission model

## 6. Testing Strategy

<!-- Unit tests for JSON-RPC dispatch, integration tests with mock stdin/stdout -->

## 7. Rollout Plan

### Phase 1: Core tools (diagnose, score, hologram)
### Phase 2: Interactive tools (fix, sync)
### Phase 3: Real-time notifications via MCP
