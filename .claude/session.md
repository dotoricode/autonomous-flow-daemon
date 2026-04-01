---
date: 2026-04-02
branch: main
---

## 진행한 작업

### afd v1.5.0 "Trust-Builder" 릴리스 완료
- Pillar 1: Hologram L1 (import-based semantic compression + contextFile)
- Pillar 2: Antibody Passive Defense (mistake_history + pastMistakes a2a 주입)
- Pillar 3: HUD Counter + Reasons (방어 건수 + 사유 표시)
- Windows 경로 guard 버그 수정 (guards.ts backslash 정규화)
- package.json → 1.5.0, git tag v1.5.0, docs/roadmap.md 완료 처리

### 토큰 절감 조치
- codex 플러그인 비활성화 (`D:\.claude\settings.json`)
- afd-auto-heal matcher: `""` → `"Write|Edit|MultiEdit"` (`hooks.json`)
- OMC 훅 비활성화: `OMC_SKIP_HOOKS: "pre-tool-use,post-tool-use"` (`D:\.claude\settings.json`)
  - ⚠️ OMC 모드(/autopilot, /ralph) 사용 시엔 이 줄 임시 제거 필요

## 현재 상태
- main 브랜치, origin 대비 커밋 앞서 있음 (push 미완료)
- 87/87 tests pass, build OK

## 핵심 결정사항
- 토큰 주범: OMC MCP 툴 스키마(70+) > OMC 훅 메시지 누적 > afd-auto-heal 전 도구 실행
- OMC 사용 시 Sonnet 오케스트레이터 + Opus subagent 구조가 적합
- immune accuracy = (hit + pass) / (hit + pass + false_positive)

## 환경
- OS: Windows 10 Pro / Shell: bash
- OMC v4.9.3 설치됨 (global, CLI, HUD, Agent Teams)
- MCP: Context7, GitHub, OMC, afd (codex 비활성화)
- CLAUDE_CONFIG_DIR=D:\.claude (homedir C:\Users\SMILE\.claude 와 다름 — 주의)
- 기본 모델: sonnet
