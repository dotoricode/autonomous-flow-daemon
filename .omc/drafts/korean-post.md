# 한국 커뮤니티 게시글 초안

**타겟:** GeekNews, 디스코드 AI 채널, X(Twitter)

---

## 제목

Claude Code 쓸 때 토큰 97% 절약하는 데몬 만들었습니다

---

## 본문

Claude Code 쓰다 보면 두 가지가 진짜 스트레스였습니다.

**첫 번째 — AI가 파일을 망가뜨립니다.**
`.claudeignore` 삭제, `hooks.json` 구조 파괴, `.cursorrules` 초기화... 이런 일이 생기면 한참 지나서야 알아채고, 원인 파악하고 복구하는 데 20~30분이 사라집니다. 흐름이 완전히 끊기죠.

**두 번째 — 큰 파일 읽을 때 토큰이 폭발합니다.**
Claude가 코드베이스를 스캔할 때 파일 전체를 컨텍스트 창에 밀어 넣습니다. 114KB짜리 파일 8개면 약 28,600 토큰. 실제로 필요한 건 함수 시그니처와 타입인데, 함수 본문이랑 주석까지 전부 태워버립니다.

---

그래서 **afd (Autonomous Flow Daemon)** 를 만들었습니다.

### 자가 치유

백그라운드 데몬으로 AI가 건드리는 중요 파일들을 감시합니다. Claude가 실수로 `.claudeignore`를 지우면, 100ms 안에 감지하고 조용히 복구합니다. 전체 치유 사이클은 270ms 이하. 직접 개입할 필요가 없습니다.

실수와 의도적인 삭제는 구분합니다. 같은 파일을 연달아 두 번 지우면("더블 탭") 의도적인 삭제로 판단하고 복구하지 않습니다. `git checkout`으로 파일이 50개 바뀌는 "대규모 이벤트"도 자동으로 감지해서 개입을 멈춥니다.

### 홀로그램 압축

Claude에게 소스 파일 전체를 넘기는 대신, 타입 시그니처와 인터페이스만 뽑아낸 "홀로그램(스켈레톤)"을 제공합니다. 27KB TypeScript 파일이 921자로 줄어듭니다. **97% 압축.** Claude는 필요한 구조 정보를 1/16 토큰으로 얻습니다.

### 프롬프트 캐싱

v2.0.0부터 Anthropic 프롬프트 캐싱(`cache_control: ephemeral`)을 실제로 적용합니다. 같은 홀로그램을 반복 조회하면 캐시가 히트돼서 추가 토큰이 들지 않습니다.

---

## v2.0.0 신규 기능

- **4개 언어 AST 지원** — TypeScript, Python, Go, Rust를 Tree-sitter WASM으로 파싱. 크로스 파일 콜 그래프를 3 depth까지 추적
- **웹 대시보드** — `afd web` 한 줄로 브라우저 대시보드 오픈. 외부 CDN 없는 단일 HTML 파일
- **정직한 토큰 추정** — `chars÷4` 근사 공식 폐기, 12개 확장자별 실측 기반 추정
- **고정 포트 51831** — 매번 달라지던 포트 문제 해결

---

## 수치

| 상황 | afd 없이 | afd 있을 때 |
|:---|:---|:---|
| AI가 `.claudeignore` 삭제 | 수동 복구 20~30분 | 0.2초 자동 치유 |
| 대형 파일 8개 읽기 (114KB) | 약 28,600 토큰 | 약 860 토큰 (97% 절감) |
| 코드베이스 1회 스캔 절감량 | — | 약 60,900 토큰 |
| CPU / 메모리 | — | CPU 0.1% 미만, RAM 약 40MB |

---

## 데모

[데모 GIF/영상 삽입 자리]

---

## 설치

```bash
npx @dotoricode/afd setup
```

대화형으로 4단계 진행합니다: 데몬 시작 → MCP 등록 → CLAUDE.md 주입 → 헬스체크.
별도로 설정 파일 건드릴 필요 없습니다.

---

## 링크

- GitHub: https://github.com/dotoricode/autonomous-flow-daemon
- npm: https://www.npmjs.com/package/@dotoricode/afd

Bun 런타임 + 네이티브 SQLite(WAL 모드) + Tree-sitter WASM + MCP 프로토콜 조합으로 만들었습니다. 질문 있으면 편하게 달아주세요.

---

## X(Twitter) 단문 버전

```
Claude Code 쓰다가 토큰이랑 파일 손상 문제가 너무 심해서 데몬 만들었습니다.

• AI가 파일 망가뜨리면 184ms에 자동 복구
• 대형 파일 97% 압축 → 60,900 토큰/세션 절약
• 4개 언어 AST, 웹 대시보드, 프롬프트 캐싱

npx @dotoricode/afd setup

https://github.com/dotoricode/autonomous-flow-daemon
```
