# 프로젝트 헌법 갱신 프롬프트

현재 프로젝트의 `CLAUDE.md` 내용을 아래의 새로운 아키텍처 헌법으로 완전히 덮어써줘. 이것은 앞으로 네가 코딩할 때 무조건 지켜야 할 절대 원칙이야.

## Git Configuration
- **user.name**: dotori
- **user.email**: high0408@gmail.com

모든 git commit 시 위 설정을 사용한다.
- Co-Authored-By 등 다른 컨트리뷰터 정보를 절대 추가하지 않는다
- author/committer는 반드시 dotori만 사용

[새로운 CLAUDE.md 내용]
# Autonomous Flow Daemon (afd) Architecture Constitution

## 1. Core Philosophy (극단적 단순함)
- 우리는 "AI 코딩 에이전트를 위한 Meta-OS"를 만든다.
- 사용자는 `afd start`만 입력하고 존재를 잊어야 한다.
- 모든 기능은 "Magic 5 Commands" (`start`, `stop`, `score`, `fix`, `sync`) 내에서 끝난다.

## 2. Tech Stack (속도가 생명)
- Runtime: **Bun** (Node.js/npm/tsup 사용 금지. 오직 Bun API 사용)
- DB: **Bun 내장 SQLite** (WAL 모드, 빠른 응답)
- Parsing: **Tree-sitter** 또는 AST를 통한 의미론적 홀로그램 추출

## 3. The Daemon Rule (S.E.A.M Cycle)
- `afd`는 정적 검사기(Linter)가 아니라 **상주형 데몬(Daemon)**이다.
- 모든 파일 감지와 DB 저장은 100ms 이내에 백그라운드에서 처리되어야 한다.
- Crash-only 철학: 복잡한 예외 처리 대신, 패닉 시 깔끔하게 죽고 다음 호출 시 재시작한다.

## 4. Token Conservation (컨텍스트 압축)
- AI(너 자신)에게 코드를 넘길 때는 무조건 주석과 바디(Body)를 제거한 '뼈대(Hologram)'만 제공하도록 코드를 짠다.