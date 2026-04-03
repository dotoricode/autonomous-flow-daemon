# Session Context

> 마지막 업데이트: 2026-04-03 | 브랜치: main

## 현재 상태
- 버전: **v1.9.0** (MCP Phase 3 완료 상태 유지)
- 최신 커밋: `a0e05d6` — chore(session): sync session state and roadmap for v1.9.0
- 전체 테스트: **193/193 통과** | 빌드: 성공
- Working tree: `afd dashboard` 관련 파일들 미커밋 상태

## 이번 세션 작업 요약

### `afd dashboard` 신규 커맨드 구현
토큰·컨텍스트 절약량 실시간 TUI 대시보드.

#### 신규 파일
- `src/commands/dashboard.ts` — `afd dashboard` 커맨드 (live TUI)

#### 변경된 파일
- `src/cli.ts` — `dashboard` 커맨드 등록
- `src/core/db.ts` — `ctx_savings_daily` / `ctx_savings_lifetime` 테이블 추가
- `src/daemon/types.ts` — `DaemonContext`에 `persistCtxSavings`, `getCtxSavingsDaily`, `getCtxSavingsLifetime` 추가
- `src/daemon/server.ts` — `persistCtxSavings()` 함수, ctx savings prepared statements, wsmap 콜백
- `src/daemon/workspace-map.ts` — `onBuilt` 콜백으로 wsmap 절약량 자동 기록, `totalProjectBytes` 반환
- `src/daemon/mcp-handler.ts` — `afd_read` range/symbols 시 pinpoint 절약량 기록
- `src/daemon/http-routes.ts` — `/score` 응답에 `ctxSavings: { daily, lifetime }` 추가

#### 대시보드 레이아웃
```
┌──────────────────────────────────────────────────────────┐
│  afd token dashboard  [● live]  2026-04-03               │
├──────────────────────────────────────────────────────────┤
│  TODAY'S SAVINGS  (홀로그램 A→B 이중 바 차트)            │
├──────────────────────────────────────────────────────────┤
│  LIFETIME ROI & BREAKDOWN                                │
│  Total Saved    ~58.0K tok  │  Est. Value  $0.17         │
│  [✓] Hologram   ~58.0K  (100%)                           │
│  [·] W/S Map    ~0.0K   (0%)                             │
│  [·] Pinpoint   ~0.0K   (0%)                             │
├──────────────────────────────────────────────────────────┤
│  7-DAY HISTORY  (날짜 + 요일 + 바 + % + tok 범위)        │
├──────────────────────────────────────────────────────────┤
│  SYSTEM STATUS  (uptime / events / requests)             │
└──────────────────────────────────────────────────────────┘
```

#### 컬러 테마
- 테두리/섹션 타이틀: Cyan
- Saved (▓, %): Green
- Actual (█, 실제 토큰): Yellow
- [● live] 뱃지: Red

#### 업데이트 메커니즘
- 3초 polling + SSE `/events` push 하이브리드
- 파일 저장 → S.E.A.M 이벤트 → 즉시 갱신
- 데몬 오프라인 시 자동 재연결

#### 절약량 추적 범위 (통합 ctx 절약)
| 타입 | 트리거 | DB |
|------|--------|-----|
| Hologram | `afd_hologram`, `afd_read` (10KB↑) | `hologram_daily` |
| W/S Map | `afd://workspace-map` 접근 시 | `ctx_savings_daily` (type='wsmap') |
| Pinpoint | `afd_read` (range/symbols) | `ctx_savings_daily` (type='pinpoint') |

## 다음 세션 시작 시 확인 사항
1. `afd start` 후 `afd dashboard` 실행 확인
2. `afd_read` / `afd_hologram` 호출 → TODAY'S SAVINGS 갱신 확인
3. workspace-map 접근 → W/S Map 수치 반영 확인
4. 미커밋 파일들 커밋 여부 결정
