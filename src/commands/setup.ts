/**
 * afd setup — Zero-interaction one-command setup for any project.
 *
 * Steps (all auto-confirmed):
 *   1. Start daemon
 *   2. Register MCP server (.mcp.json)
 *   3. Inject CLAUDE.md afd instructions
 *   4. Run afd fix (health check)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { getSystemLanguage } from "../core/locale";
import { platform } from "os";

// ── i18n ─────────────────────────────────────────────────────────────────────

const msgs = {
  en: {
    welcome: "afd setup — configuring your project",
    stepDaemon: "Starting daemon",
    stepMcp: "Registering MCP server (.mcp.json)",
    stepClaude: "Adding afd instructions to CLAUDE.md",
    stepFix: "Running health check",
    stepOptionalHooks: "Optional hooks",
    done: (step: string) => `  ✓ ${step}`,
    already: (step: string) => `  · Already configured: ${step}`,
    optionalHookPrompt: "Install optional hooks for better token optimization?",
    optionalHookItem: (desc: string) => `    • ${desc}`,
    optionalHookAccepted: "  ✓ Optional hooks installed",
    optionalHookSkipped: "  · Skipped optional hooks",
    allDone: "\nafd setup complete. Your project is protected.",
    hintDashboard: "  Run 'afd web' to see live token savings in your browser.",
    hintRestart: "  Run /mcp in Claude Code to connect (no restart needed).",
  },
  ko: {
    welcome: "afd setup — 프로젝트 설정 중",
    stepDaemon: "데몬 시작",
    stepMcp: "MCP 서버 등록 (.mcp.json)",
    stepClaude: "CLAUDE.md에 afd 지시 추가",
    stepFix: "상태 점검 실행",
    stepOptionalHooks: "선택 훅 설치",
    done: (step: string) => `  ✓ ${step}`,
    already: (step: string) => `  · 이미 설정됨: ${step}`,
    optionalHookPrompt: "토큰 최적화를 위한 선택 훅을 설치할까요?",
    optionalHookItem: (desc: string) => `    • ${desc}`,
    optionalHookAccepted: "  ✓ 선택 훅 설치 완료",
    optionalHookSkipped: "  · 선택 훅 건너뜀",
    allDone: "\nafd setup 완료. 프로젝트가 보호됩니다.",
    hintDashboard: "  'afd web'으로 브라우저에서 실시간 토큰 절약량을 확인하세요.",
    hintRestart: "  Claude Code에서 /mcp를 실행하면 바로 연결됩니다 (재시작 불필요).",
  },
};

// ── MCP registration ──────────────────────────────────────────────────────────

interface McpConfig {
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
}

function getMcpEntry(): { command: string; args: string[] } {
  if (platform() === "win32") {
    return { command: "cmd", args: ["/c", "npx", "-y", "@dotoricode/afd", "start", "--mcp"] };
  }
  return { command: "npx", args: ["-y", "@dotoricode/afd", "start", "--mcp"] };
}

function registerMcp(filePath: string): "done" | "already" {
  let config: McpConfig = {};
  if (existsSync(filePath)) {
    try { config = JSON.parse(readFileSync(filePath, "utf-8")); } catch { config = {}; }
  }

  const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
  const entry = getMcpEntry();
  const existing = servers.afd as { command?: string; args?: string[] } | undefined;

  if (existing?.command === entry.command &&
      JSON.stringify(existing.args) === JSON.stringify(entry.args)) {
    return "already";
  }

  servers.afd = entry;
  config.mcpServers = servers;
  writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return "done";
}

// ── CLAUDE.md injection ───────────────────────────────────────────────────────

const AFD_MARKER = "<!-- afd:setup -->";

const AFD_CLAUDE_BLOCK = `${AFD_MARKER}
## afd — AI Token Optimizer & Self-Healing

This project uses [afd](https://www.npmjs.com/package/@dotoricode/afd) for token optimization and file protection.

### File Reading Rules
- **\`afd_read\` MCP 도구를 네이티브 Read 대신 사용하라.** 10KB 이상 파일은 자동으로 홀로그램(구조 스켈레톤)으로 압축되어 반환된다. 특정 구간이 필요하면 \`startLine\`/\`endLine\` 파라미터로 정밀 조회할 수 있다.
- **프로젝트 구조를 파악할 때는 \`afd://workspace-map\` MCP 리소스를 먼저 읽어라.** 파일 트리 + export 시그니처가 한 번에 제공된다.
- **대용량 파일(100줄+)의 구조를 파악할 때는 \`afd_hologram\` MCP 도구를 사용하라.** 타입 시그니처만 추출하여 80%+ 토큰을 절약한다.

### Self-Healing
- afd가 파일을 복구했다는 \`[afd]\` 메시지가 보이면, 해당 파일 편집을 중단하고 \`afd_hologram\`으로 구조를 먼저 파악하라.
${AFD_MARKER}`;

function injectClaudeMd(cwd: string): "done" | "already" {
  const claudePath = resolve(cwd, "CLAUDE.md");

  if (existsSync(claudePath)) {
    const content = readFileSync(claudePath, "utf-8");
    if (content.includes(AFD_MARKER)) return "already";
    writeFileSync(claudePath, content + "\n\n" + AFD_CLAUDE_BLOCK + "\n", "utf-8");
    return "done";
  }

  writeFileSync(claudePath, AFD_CLAUDE_BLOCK + "\n", "utf-8");
  return "done";
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function setupCommand(): Promise<void> {
  const lang = getSystemLanguage();
  const m = msgs[lang];
  const cwd = process.cwd();

  console.log(`\n  ${m.welcome}\n`);

  // Step 1: Start daemon
  {
    const { getDaemonInfo, isDaemonAlive } = await import("../daemon/client");
    const info = getDaemonInfo();
    if (info && await isDaemonAlive(info)) {
      console.log(m.already(m.stepDaemon));
    } else {
      const { startCommand } = await import("./start");
      await startCommand({});
      console.log(m.done(m.stepDaemon));
    }
  }

  // Step 2: MCP registration
  {
    const mcpPath = resolve(cwd, ".mcp.json");
    const result = registerMcp(mcpPath);
    console.log(result === "already" ? m.already(m.stepMcp) : m.done(m.stepMcp));
  }

  // Step 3: CLAUDE.md injection
  {
    const result = injectClaudeMd(cwd);
    console.log(result === "already" ? m.already(m.stepClaude) : m.done(m.stepClaude));
  }

  // Step 4: Health check
  {
    const { fixCommand } = await import("./fix");
    await fixCommand({ autoApply: true });
    console.log(m.done(m.stepFix));
  }

  // Step 5: Optional hooks (user confirmation required)
  {
    const { getAfdOptionalHooks, getAfdDesiredHooks, readHooksFile, writeHooksFile, mergeHooks } =
      await import("../core/hook-manager");
    const optionalHooks = getAfdOptionalHooks();

    if (optionalHooks.length > 0) {
      console.log(`\n  ${m.optionalHookPrompt}`);
      for (const oh of optionalHooks) {
        console.log(m.optionalHookItem(lang === "ko" ? oh.description.ko : oh.description.en));
      }

      const answer = prompt("  [Y/n] ") ?? "y";

      if (answer.trim().toLowerCase() !== "n") {
        for (const oh of optionalHooks) {
          if (oh.scriptContent && oh.scriptPath) {
            const scriptFullPath = resolve(cwd, ".claude", oh.scriptPath);
            mkdirSync(dirname(scriptFullPath), { recursive: true });
            writeFileSync(scriptFullPath, oh.scriptContent, { mode: 0o755 });
          }
        }

        const hooksPath = resolve(cwd, ".claude", "hooks.json");
        const config = readHooksFile(hooksPath);
        if (!config.hooks) config.hooks = {};
        if (!config.hooks.PreToolUse) config.hooks.PreToolUse = [];

        const allDesired = [...getAfdDesiredHooks(), ...optionalHooks.map(oh => oh.hook)];
        const result = mergeHooks(config.hooks.PreToolUse, allDesired);
        config.hooks.PreToolUse = result.merged;
        writeHooksFile(hooksPath, config);

        console.log(m.optionalHookAccepted);
      } else {
        console.log(m.optionalHookSkipped);
      }
    }
  }

  console.log(m.allDone);
  console.log(m.hintDashboard);
  console.log(m.hintRestart);
  console.log("");
}
