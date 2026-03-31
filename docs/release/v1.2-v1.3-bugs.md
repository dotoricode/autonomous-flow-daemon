# Bug Report — Post-Release Audit

> v1.2.0 (2026-03-31) 및 v1.3.0 (2026-04-01) 코드 리뷰에서 발견된 버그 및 수정 기록.

---

## CRITICAL

### BUG-001: Command Injection in notify.ts

- **파일:** `src/core/notify.ts:43-44, 56`
- **증상:** `title`/`body`에 싱글쿼트(PowerShell) 또는 더블쿼트(AppleScript)가 포함되면 스크립트 파싱 오류 또는 임의 명령 실행 가능.
- **원인:** 셸 문자열 리터럴에 사용자 값을 이스케이프 없이 삽입.
- **수정:** `escapePS()` (싱글쿼트 → `''` 이스케이프), `escapeAS()` (더블쿼트/백슬래시 이스케이프) 함수 추가 후 적용.
- **상태:** Fixed

### BUG-002: Memory Leak — firstTapTimestamps Never Expires

- **파일:** `src/daemon/server.ts` (state.firstTapTimestamps)
- **증상:** 파일 삭제 후 30초 내 재삭제가 없으면 Map 엔트리가 영원히 남음. 장기 실행 데몬에서 메모리 지속 증가.
- **원인:** 만료된 first-tap 엔트리를 정리하는 로직 부재.
- **수정:** 60초 주기 `setInterval`로 `DOUBLE_TAP_WINDOW_MS`를 초과한 엔트리 자동 삭제.
- **상태:** Fixed

### BUG-003: MCP stdin Buffer Overflow

- **파일:** `src/daemon/server.ts` (MCP stdin loop)
- **증상:** 개행 없는 데이터가 계속 들어오면 `buffer` 문자열이 무한히 커져 OOM 발생.
- **원인:** 버퍼 크기 제한 없이 `buffer += chunk` 반복.
- **수정:** `MCP_MAX_BUFFER` (1MB) 초과 시 버퍼 드롭 + 에러 로그. async IIFE에 `.catch()` 핸들러 추가.
- **상태:** Fixed

---

## HIGH

### BUG-004: SQL String Interpolation in Migration

- **파일:** `src/core/db.ts:73`
- **증상:** `hologram_stats` → `hologram_lifetime` 마이그레이션에서 템플릿 리터럴로 SQL 값 삽입. 현재 소스가 DB 내부값이라 즉시 위험은 없으나 위험한 패턴.
- **원인:** `db.exec()` + 템플릿 리터럴 사용.
- **수정:** `db.prepare().run()` 파라미터 바인딩으로 교체.
- **상태:** Fixed

### BUG-005: getDaemonPort() NaN 미검증 + 중복 구현

- **파일:** `src/commands/diagnose.ts:147-151`
- **증상:** PORT_FILE 손상 시 `parseInt` → `NaN` → `fetch("http://127.0.0.1:NaN/...")` 실패. 이미 `client.ts`에 `getDaemonInfo()`가 있는데 `require()`로 중복 구현.
- **원인:** auto-heal 기록 전송 시 `getDaemonPort()` 별도 함수 사용.
- **수정:** `getDaemonInfo()` import 사용 + null 체크 추가. 불필요한 `getDaemonPort()` 함수 삭제.
- **상태:** Fixed

### BUG-006: LRU Map Silent Data Drop

- **파일:** `src/core/lru-map.ts:40-41`
- **증상:** 단일 값이 `maxBytes`를 초과하면 `set()`이 조용히 무시. 호출자가 저장 실패를 감지할 수 없음.
- **원인:** `set()` 반환 타입이 `void`.
- **수정:** `set()` 반환 타입을 `boolean`으로 변경. 초과 시 `false` 반환.
- **상태:** Fixed

---

## MEDIUM

### BUG-007: persistHologramStats() Crash on Disk Error

- **파일:** `src/daemon/server.ts` (persistHologramStats)
- **증상:** 디스크 풀 또는 DB 잠금 시 `updateLifetime.run()` 예외로 데몬 전체 크래시. 통계는 비핵심 기능.
- **원인:** try-catch 미적용.
- **수정:** DB write 부분을 try-catch로 감싸고 에러 로그 출력.
- **상태:** Fixed

### BUG-008: MCP Async IIFE Unhandled Rejection

- **파일:** `src/daemon/server.ts` (MCP stdin async loop)
- **증상:** `Bun.stdin.stream()` 예외 시 unhandled promise rejection으로 예고 없는 크래시.
- **원인:** async IIFE에 `.catch()` 핸들러 없음.
- **수정:** `.catch()` 핸들러 추가, 에러 로그 후 `process.exit(1)`.
- **상태:** Fixed (BUG-003 수정에 포함)

---

# v1.3.0 Post-Release Audit (2026-04-01)

## CRITICAL

### BUG-009: SSE cancel() Memory Leak

- **파일:** `src/daemon/server.ts` (/events endpoint)
- **증상:** SSE 클라이언트 연결 해제 시 `cancel(controller)` 콜백의 `controller` 파라미터가 실제로는 `reason`을 받음. `state.sseClients.delete(reason)`은 항상 실패하여 죽은 컨트롤러가 Set에 영원히 남음.
- **원인:** `ReadableStream.cancel()` 시그니처 오해 — `cancel(reason)` not `cancel(controller)`.
- **수정:** `start()`에서 `sseController` 클로저 변수에 캡처, `cancel()`에서 해당 변수로 삭제.
- **상태:** Fixed

### BUG-010: semanticDiff() Uncaught Exception Crashes Daemon

- **파일:** `src/daemon/server.ts` (change event handler)
- **증상:** TS/JS 파일에 문법 오류가 있으면 `semanticDiff()` 호출이 예외를 던져 데몬 전체 크래시. 파일 스냅샷 업데이트(하단)도 실행 안됨.
- **원인:** `semanticDiff()` 호출에 try-catch 없음.
- **수정:** try-catch 추가, 실패 시 `lineDiff()` 텍스트 폴백.
- **상태:** Fixed

### BUG-011: Variable Declaration Only First Extracted

- **파일:** `src/core/semantic-diff.ts:147`
- **증상:** `export const x = 1, y = 2;` 같은 다중 선언문에서 첫 번째 변수(`x`)만 추적. `y`가 변경되면 변경 감지 누락.
- **원인:** `declarations[0]`만 추출.
- **수정:** `extractDeclInfos()`가 `DeclInfo[]` 배열 반환하도록 변경. 모든 선언자를 순회하여 각각 등록.
- **상태:** Fixed

---

## HIGH

### BUG-012: Import Name Collision for Same Module

- **파일:** `src/core/semantic-diff.ts:166`
- **증상:** 동일 모듈에서 여러 import가 있으면 `import:'./utils'` 키가 충돌. 두 번째 import가 첫 번째를 덮어씀.
- **원인:** import 키로 모듈 경로만 사용.
- **수정:** import 키를 전체 import 구문 텍스트(`import:import { foo } from './utils'`)로 변경하여 고유성 보장.
- **상태:** Fixed

### BUG-013: Export Declaration Key Uses Unstable node.pos

- **파일:** `src/core/semantic-diff.ts:177`
- **증상:** `export:${node.pos}` 키가 old/new 파서 트리 간 AST 위치 불일치로 동일 export를 다른 선언으로 인식.
- **원인:** AST node position은 파싱마다 달라질 수 있음.
- **수정:** export 키를 전체 export 구문 텍스트로 변경 (`export:export { foo, bar }`).
- **상태:** Fixed

### BUG-014: Type Annotation Regex Breaks on Complex Types

- **파일:** `src/core/semantic-diff.ts:269-270`
- **증상:** `/:\s*[^,)]+/g` regex가 `{ a: string, b: number }` 같은 중첩 타입에서 잘못 매칭. 시그니처 변경 감지 false negative.
- **원인:** 단순 regex로 중첩 구조(제네릭, 객체 타입) 파싱 불가.
- **수정:** 괄호/중괄호/꺾쇠 깊이를 추적하는 `stripTypeAnnotations()` 함수로 교체.
- **상태:** Fixed

### BUG-015: SSE Clients No Limit — DoS Vector

- **파일:** `src/daemon/server.ts` (/events endpoint)
- **증상:** SSE 연결 수 제한 없이 무한 수락. 악성 클라이언트가 수천 개 연결 열면 메모리/CPU 소진.
- **원인:** `state.sseClients.add()` 전 크기 체크 없음.
- **수정:** `MAX_SSE_CLIENTS = 20` 제한 추가. 초과 시 HTTP 429 응답.
- **상태:** Fixed

---

## MEDIUM

### BUG-016: Set Modification During Iteration in seam()

- **파일:** `src/daemon/server.ts` (seam → SSE broadcast)
- **증상:** `for...of` 순회 중 `state.sseClients.delete()` 호출 시 반복 순서가 예측 불가능하거나 일부 클라이언트 건너뜀.
- **원인:** Set 순회 중 삭제.
- **수정:** 실패한 컨트롤러를 `dead` 배열에 수집 후 순회 완료 뒤 일괄 삭제.
- **상태:** Fixed

---

## NOT A BUG (False Alarm)

### FA-001: log-rotate.ts Loop Logic

- **보고:** 에이전트가 로테이션 루프가 깨졌다고 보고.
- **검증:** 역순 순회 (`i=3→1`)로 `.3` 삭제 → `.2→.3` → `.1→.2` → `log→.1` 순서 정상 동작.

### FA-002: Mass Event Detection Order

- **보고:** `isMassEvent()` 호출 전에 push가 안 된다고 보고.
- **검증:** `handleUnlink()`에서 `push(now)` → `isMassEvent(now)` 순서로 호출. 정상.

---

## Summary

| Audit     | Severity | Found | Fixed |
|-----------|----------|-------|-------|
| v1.2.0    | CRITICAL | 3     | 3     |
| v1.2.0    | HIGH     | 3     | 3     |
| v1.2.0    | MEDIUM   | 2     | 2     |
| v1.3.0    | CRITICAL | 3     | 3     |
| v1.3.0    | HIGH     | 3     | 3     |
| v1.3.0    | MEDIUM   | 1     | 1     |
| **Total** |          | **15**| **15**|

All tests passing: **87 pass, 0 fail** (post-fix).
