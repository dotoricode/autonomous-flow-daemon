# AFD 전체 코드베이스 버그 감사 리포트

- **감사일**: 2026-04-01
- **대상 커밋**: `51468d7` (main)
- **감사 범위**: 전체 소스 (`src/`), 테스트 (`tests/`)
- **감사자**: Claude Opus 4.6 (4-agent parallel audit)

---

## 요약

| 심각도 | 서버 | CLI | 코어 모듈 | 테스트 | 합계 |
|--------|------|-----|-----------|--------|------|
| CRITICAL | 3 | 1 | 1 | — | **5** |
| HIGH | 4 | 5 | 2 | 4 | **15** |
| MEDIUM | 9 | 7 | 6 | 6 | **28** |
| LOW | 3 | 8 | 6 | 2 | **19** |
| **합계** | **19** | **21** | **15** | **12** | **67** |

---

## CRITICAL (5건)

### C-01. `/hologram` 엔드포인트 경로 탐색 (Path Traversal)
- **위치**: `src/daemon/server.ts:827`
- **분류**: 보안
- **설명**: `GET /hologram?file=../../../etc/passwd`로 워크스페이스 외부 파일 읽기 가능. `resolve(file)` 결과가 워크스페이스 내부인지 검증 없음.
- **MCP `afd_hologram`** (line 746)도 동일.
- **수정**: `resolve(file)`이 `_ws.root`로 시작하는지 검증. `..` 포함 경로 거부.

### C-02. `autoHealFile` 패치 적용 시 경로 탐색
- **위치**: `src/daemon/server.ts:383-385`
- **분류**: 보안
- **설명**: DB에 저장된 악성 항체의 `patch.path`가 `"/../../etc/cron.d/evil"` 형태일 때, 임의 파일 쓰기 가능.
- **수정**: 해석된 경로가 `process.cwd()` 내부인지 검증 후 쓰기.

### C-03. 동적 validator 로딩 — 임의 코드 실행
- **위치**: `src/daemon/server.ts:278-293`
- **분류**: 보안
- **설명**: `.afd/validators/*.js`를 동적 `import()`로 실행. 공격자가 해당 디렉토리에 파일 작성 시 RCE 가능. `?t=${Date.now()}` 캐시 버스팅으로 모듈 캐시 메모리 누수도 동반.
- **수정**: 파일 권한/소유자 검증 또는 `vm` 샌드박스 사용. 캐시 버스팅 제거.

### C-04. `diagnose.ts` — `knownIds` 미초기화 사용 가능
- **위치**: `src/commands/diagnose.ts:91-97`
- **분류**: 로직 오류
- **설명**: `/antibodies` fetch 실패 시 `process.exit(0)` 호출하나, 테스트 환경에서 `process.exit`가 mock되면 `knownIds`가 초기화 없이 사용되어 `ReferenceError` 발생.
- **수정**: `let knownIds: string[] = []`로 초기값 설정 또는 `process.exit` 후 `return` 추가.

### C-05. `boast.ts` `pick()` — 빈 배열 시 `undefined` 반환
- **위치**: `src/core/boast.ts:203-205`
- **분류**: 로직 오류 / 크래시
- **설명**: `pick(arr)`에서 `arr.length === 0`이면 `undefined` 반환. 이후 `.replaceAll()` 호출 시 `TypeError` 크래시.
- **수정**: `if (arr.length === 0) return "";` 가드 추가.

---

## HIGH (15건)

### H-01. 모듈 캐시 버스팅 메모리 누수
- **위치**: `src/daemon/server.ts:282`
- **분류**: 메모리 누수
- **설명**: `import(\`${absPath}?t=${Date.now()}\`)` — 매 호출마다 고유 URL 생성, 모듈 캐시에 영구 누적.

### H-02. `state.watchedFiles` 무한 증가
- **위치**: `src/daemon/server.ts:515`
- **분류**: 메모리 누수
- **설명**: `unlink` 이벤트에서도 Set에서 제거하지 않아 무한 증가.
- **수정**: `unlink` 핸들러에서 `state.watchedFiles.delete(path)` 추가.

### H-03. POST 엔드포인트 body 크기 제한 없음 (DoS)
- **위치**: `src/daemon/server.ts:874-906`
- **분류**: 보안 / DoS
- **설명**: `/antibodies/learn`, `/auto-heal/record` — `req.json()` 호출 전 `Content-Length` 검증 없음.
- **수정**: 1MB 이상 요청 거부.

### H-04. HTTP 서버 인증 없음 + 네트워크 노출 가능
- **위치**: `src/daemon/server.ts:803`
- **분류**: 보안
- **설명**: `Bun.serve({ port: 0 })` — `hostname` 미지정 시 `0.0.0.0` 바인딩 가능. 인증 토큰 없이 모든 로컬 프로세스가 접근 가능.
- **수정**: `hostname: "127.0.0.1"` 명시. 공유 시크릿 토큰 도입 고려.

### H-05. `start.ts` — 파일 디스크립터 미닫힘
- **위치**: `src/commands/start.ts:107`
- **분류**: 리소스 누수
- **설명**: `openSync(logPath, "a")`로 연 fd가 child spawn 후 부모 프로세스에서 close되지 않음.
- **수정**: `child.unref()` 후 `closeSync(logFd)` 추가.

### H-06. `sync.ts` — ESM 코드베이스에서 `require()` 사용
- **위치**: `src/commands/sync.ts:254-258`
- **분류**: 호환성
- **설명**: `require("../daemon/client")`는 CJS. 같은 모듈이 이미 ESM import로 불러와져 있어 이중 로딩 발생 가능.
- **수정**: 상단 import된 `getDaemonInfo()` 사용.

### H-07. `fix.ts` — 비대화형 환경에서 `readLine()` 무한 대기
- **위치**: `src/commands/fix.ts:148-158`
- **분류**: UX / 행
- **설명**: stdin이 TTY가 아닌 환경(CI/CD)에서 입력 대기로 프로세스 행.
- **수정**: `process.stdin.isTTY` 체크. 비대화형이면 자동 적용 또는 스킵.

### H-08. `doctor.ts` — 경로 탐색 가드 누락
- **위치**: `src/commands/doctor.ts:143-159`
- **분류**: 보안
- **설명**: `applyPatch`에 `..` 검증 없음. `fix.ts`, `diagnose.ts`에는 있으나 `doctor.ts`에만 누락.
- **수정**: 동일한 가드 추가 또는 공통 모듈로 추출.

### H-09. `vaccine-registry.ts` — 패키지명 경로 탐색
- **위치**: `src/core/vaccine-registry.ts:83, 121, 142`
- **분류**: 보안
- **설명**: `pkg.name`이 `"../../etc"`이면 디렉토리 탈출. `ab.id`도 미검증.
- **수정**: `/^[a-zA-Z0-9_-]+$/` 패턴 검증.

### H-10. `notify.ts` — `patternId` 커맨드 인젝션
- **위치**: `src/core/notify.ts:12-27, 67-73`
- **분류**: 보안
- **설명**: AppleScript/PowerShell로 전달 시 특수문자 이스케이프 불완전. macOS: backtick, Windows: `$()`.
- **수정**: `patternId`를 안전 문자셋으로 제한.

### H-11 ~ H-14. 테스트 미존재 (높은 위험 모듈)
- `src/core/hologram.ts` — 핵심 AST 변환, 테스트 0건
- `src/core/evolution.ts` — 자가진화 엔진, 테스트 0건
- `src/commands/*.ts` (10개 파일) — CLI 전체, 테스트 0건
- `tests/unit/notify.test.ts` — 3개 테스트 모두 의미 없는 검증

### H-15. `mcp-protocol.test.ts` — 하드코딩된 1500ms sleep (플레이키)
- **위치**: `tests/unit/mcp-protocol.test.ts:55`
- **분류**: 테스트 신뢰성
- **설명**: 느린 CI에서 데몬 미시작 시 실패. 최대 36.5초 무의미 대기 가능.

---

## MEDIUM (28건)

### M-01. SSE 클라이언트 미정리
- **위치**: `src/daemon/server.ts:88-95`
- **설명**: `cleanup()`에서 SSE `controller.close()` 미호출.

### M-02. 파일 읽기-복구 간 경쟁 조건 (TOCTOU)
- **위치**: `src/daemon/server.ts:547-601`
- **설명**: `readFileSync` → 검사 → `writeFileSync` 사이 다른 프로세스가 파일 변경 가능.

### M-03. `TextDecoder` 스트림 모드 미사용
- **위치**: `src/daemon/server.ts:770-773`
- **설명**: MCP stdin 파싱 시 멀티바이트 UTF-8이 청크 경계에서 깨질 수 있음.

### M-04. DB 컨텐츠 `JSON.parse` 미보호
- **위치**: `src/daemon/server.ts:1014`
- **설명**: `/sync` 엔드포인트에서 DB의 `patch_op` 파싱 시 try-catch 없음.

### M-05. `db.prepare` 핫 패스 인라인 호출
- **위치**: `src/daemon/server.ts:428`
- **설명**: `handleUnlink`마다 `db.prepare()` 호출. 성능 저하.

### M-06. `/score`에서 `watchedFiles` 전체 직렬화
- **위치**: `src/daemon/server.ts:924`
- **설명**: 무한 증가 Set을 통째로 JSON 변환. 대형 워크스페이스에서 DoS 벡터.

### M-07. `recentUnlinks` 비효율적 필터링
- **위치**: `src/daemon/server.ts:363-364`
- **설명**: 매 호출마다 새 배열 생성. 링 버퍼가 더 효율적.

### M-08. `selfWrites` setTimeout 핸들 미추적
- **위치**: `src/daemon/server.ts:531-532`
- **설명**: 데몬 종료 시 타이머 정리 안 됨.

### M-09. validator 타임아웃 미적용
- **위치**: `src/daemon/server.ts:325-329`
- **설명**: 500ms 경고 로그만. 악성 validator가 이벤트 루프 블로킹 가능.

### M-10. `watch.ts` ANSI 이스케이프 자르기 오류
- **위치**: `src/commands/watch.ts:66-77`
- **설명**: `\x1b`만 스킵하고 후속 문자(`[31m` 등)가 폭으로 카운트됨.

### M-11. `watch.ts` Esc키와 방향키 충돌
- **위치**: `src/commands/watch.ts:353`
- **설명**: `ch === "\x1b"`가 방향키 시퀀스의 첫 바이트와 매칭되어 의도치 않은 종료.
- **수정**: `key.length === 1 && ch === "\x1b"` 조건으로 변경.

### M-12. `applyPatch` 3개 파일 중복 (불일치 보안 가드)
- **위치**: `fix.ts:12`, `diagnose.ts:18`, `doctor.ts:143`
- **설명**: 동일 함수가 3곳에 복붙. `doctor.ts`만 보안 가드 누락.
- **수정**: `src/core/patch.ts`로 공통화.

### M-13. `sync.ts`, `vaccine.ts` — `s.length` 사용 (CJK 정렬 깨짐)
- **위치**: `src/commands/sync.ts:176,238,265`, `src/commands/vaccine.ts:64`
- **설명**: `visualWidth()` 대신 `s.length` 사용. 한국어/이모지 박스 정렬 깨짐.

### M-14. `fix.ts` `readLine` 미사용 `buf` 변수
- **위치**: `src/commands/fix.ts:149`

### M-15. `evolution.ts` — CWD 상대경로 사용
- **위치**: `src/core/evolution.ts:14, 195-207`
- **설명**: `LESSONS_FILE`, `QUARANTINE_DIR`이 상대경로. 서브디렉토리에서 CLI 실행 시 오동작.
- **수정**: `resolveWorkspacePaths()` 사용.

### M-16. `yaml-minimal.ts` — URL 콜론 오파싱
- **위치**: `src/core/yaml-minimal.ts:79, 136`
- **설명**: `- https://example.com:8080`이 키-값 쌍으로 오인식.

### M-17. `yaml-minimal.ts` — 들여쓰기 +2 하드코딩
- **위치**: `src/core/yaml-minimal.ts:145`
- **설명**: 4칸 들여쓰기 YAML에서 오파싱.

### M-18. `db.ts` — 마이그레이션 트랜잭션 미사용
- **위치**: `src/core/db.ts:69-81`
- **설명**: `hologram_stats` → `hologram_lifetime` 마이그레이션 중 크래시 시 데이터 중복/손실.

### M-19. `config.ts` — 캐시 무효화 없음
- **위치**: `src/core/config.ts:18-34`
- **설명**: 외부에서 `~/.afdrc` 변경 시 데몬이 인식 못함. 재시작 필요.

### M-20. `locale.ts` — 이중 캐싱 문제
- **위치**: `src/core/locale.ts:20`
- **설명**: config 캐시 + locale 캐시 이중 적용. `setLanguageOverride(null)`이 config 캐시를 무효화하지 않음.

### M-21. `discovery.ts` — CWD 의존 상대경로
- **위치**: `src/core/discovery.ts:53`
- **설명**: `cwd` 파라미터 없이 `process.cwd()` 기반. 서브디렉토리 실행 시 오동작.

### M-22. `semantic-diff.ts` — 타입 스트리핑 괄호 깊이 혼합
- **위치**: `src/core/semantic-diff.ts:370-396`
- **설명**: `<>`, `{}`, `()` 깊이를 단일 카운터로 추적. `{key: string}` 타입 내 `)` 발견 시 오동작.

### M-23 ~ M-28. 테스트 품질 이슈
- `log-rotate.test.ts`: 5MB 경계값, 삭제된 파일 검증 누락
- `rule-engine.test.ts`: 5개 조건 중 2개만 테스트
- `vaccine-registry.test.ts`: 순서 의존, 실제 파일시스템 오염
- `suppression-safety.test.ts`: 경계값 off-by-one 미테스트
- `adapters.test.ts`: hooks 내용 미검증, Claude 어댑터 미테스트
- `discovery.ts`, `workspace.ts`, `config.ts`, `db.ts`: 테스트 0건

---

## LOW (19건)

### L-01. `watchedFiles` 중복 JSDoc 블록
- **위치**: `src/daemon/server.ts:403-410`

### L-02. `corruptionTaps` 선언 순서 취약
- **위치**: `src/daemon/server.ts:351, 479`

### L-03. `existsSync` + `readFileSync` TOCTOU 패턴
- **위치**: `src/daemon/server.ts:199-200, 254-255, 545-548`

### L-04. `stop.ts` — 실패 시 종료 코드 0
- **위치**: `src/commands/stop.ts:46-48`

### L-05. `cli.ts` — `parseAsync()` 미사용
- **위치**: `src/cli.ts:104`
- **설명**: async 핸들러의 unhandled rejection 미포착.

### L-06. `diagnose.ts` — `replace` op이 없는 파일에도 생성
- **위치**: `src/commands/diagnose.ts:30-36`

### L-07. `mcp.ts` — 잘못된 JSON 파일 덮어쓰기
- **위치**: `src/commands/mcp.ts:59-66`

### L-08. `evolution.ts` — 진화 후 stats 미갱신 표시
- **위치**: `src/commands/evolution.ts:70-77, 91`

### L-09. `watch.ts` — `score.uptime++` 로컬 드리프트
- **위치**: `src/commands/watch.ts:371`

### L-10. `watch.ts` — stdin 리스너 미제거
- **위치**: `src/commands/watch.ts:350-363`

### L-11. TUI 유틸리티 6개 파일 중복
- **위치**: `watch.ts`, `score.ts`, `doctor.ts`, `evolution.ts`, `sync.ts`, `vaccine.ts`

### L-12. `workspace.ts` — 미사용 변수 `root`
- **위치**: `src/core/workspace.ts:10`

### L-13. `evolution.ts` — 격리 파일명 → 경로 복원 모호
- **위치**: `src/core/evolution.ts:54`

### L-14. `boast.ts` — 이모지/ZWJ 폭 계산 오류
- **위치**: `src/core/boast.ts:254-279`
- **설명**: Variation Selector(0xFE00-0xFE0F), ZWJ(0x200D)는 zero-width인데 width 2로 카운트.

### L-15. `lru-map.ts` — key 바이트 미계산
- **위치**: `src/core/lru-map.ts:23`
- **설명**: value만 `length * 2`로 계산. key 바이트 누락으로 `maxBytes` 초과 가능.

### L-16. `constants.ts` — `QUARANTINE_DIR` 상대경로 직접 export
- **위치**: `src/constants.ts:10`

### L-17. `semantic-diff.ts` — 변수 선언문 body 공유
- **위치**: `src/core/semantic-diff.ts:146-163`
- **설명**: `const a = 1, b = 2;`에서 둘 다 같은 fullText를 body로 가져 false positive diff 발생.

### L-18. `lru-map.test.ts` — bytes 검증 불충분
- **위치**: `tests/unit/lru-map.test.ts`

### L-19. `semantic-diff.test.ts` — 약한 assertion
- **위치**: `tests/unit/semantic-diff.test.ts`

---

## 버그 완료 태그 (Bug Audit Checkpoint)

> **`BUG-AUDIT-2026-04-01`**
>
> 이 태그 이후의 감사에서는 위 67건을 재검사할 필요 없이,
> **이 태그 시점 이후 변경된 파일만** 대상으로 검사하면 됩니다.
>
> 다음 감사 시 사용할 명령:
> ```bash
> git diff --name-only BUG-AUDIT-2026-04-01..HEAD
> ```
> 출력된 파일 목록에 대해서만 감사를 수행하세요.

---

## 우선 수정 권장 순서

1. **보안 (C-01, C-02, H-04, H-08, H-09, H-10)** — 경로 탐색 + 인증 + 인젝션
2. **크래시 (C-04, C-05)** — 런타임 에러
3. **메모리 누수 (C-03/H-01, H-02)** — 장기 실행 데몬 안정성
4. **DoS (H-03, M-06)** — body 크기 + watchedFiles 직렬화
5. **테스트 (H-11~H-14)** — hologram, evolution 등 핵심 모듈 커버리지
6. **UX (H-07, M-11, M-13)** — CI 행, 방향키 충돌, CJK 정렬
