# DX 향상: 포트 고정 및 afd web CLI 추가

## 완료 항목

### 1. 고정 포트 바인딩 (server.ts)
- 기본 포트: `51831` 우선 시도
- 이미 사용 중이면 `port: 0` (OS 할당)으로 폴백
- 브라우저 북마크 `http://localhost:51831/dashboard` 안정화

### 2. `afd web` CLI 명령어 (commands/web.ts)
- `getDaemonInfo()` + `isDaemonAlive()` 로 데몬 상태 확인
- `exec(open/start/xdg-open)` 으로 OS 기본 브라우저 자동 오픈
- Windows/macOS/Linux 크로스 플랫폼 대응

### 3. MCP 재연결 Watchdog (client.ts)
- `daemonRequest()` 에 3회 재시도 + 1초 간격 로직 추가
- 재시도 중 `[afd] 데몬 재연결 중... (N/3)` 콘솔 메시지 출력
- 3회 실패 시 원래 에러 throw

## 테스트 결과
- 217/217 전체 통과 (12.58s)
- `afd web` → 브라우저 정상 오픈 확인
