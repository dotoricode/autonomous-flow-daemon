/**
 * afd watch — Real-time Security Dashboard
 *
 * Connects to daemon SSE endpoint and renders live events
 * with user-friendly narrative messages.
 */

import { daemonRequest, getDaemonInfo } from "../daemon/client";
import { getSystemLanguage } from "../core/locale";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
};

const msgs = {
  en: {
    title: "Security Monitor",
    connecting: "Connecting to daemon...",
    notRunning: "Daemon not running. Start with: afd start",
    uptime: "Uptime",
    events: "Events",
    heals: "Protected",
    antibodies: "Antibodies",
    hologram: "Efficiency",
    ecosystem: "Ecosystem",
    liveEvents: "Live Activity",
    evolution: "Evolution",
    quit: "Press Ctrl+C to quit",
    noEvents: "All quiet. Watching for threats...",
    noise: "system events filtered",
  },
  ko: {
    title: "보안 모니터",
    connecting: "데몬에 연결 중...",
    notRunning: "데몬이 실행 중이 아닙니다. afd start로 시작하세요.",
    uptime: "가동 시간",
    events: "이벤트",
    heals: "보호됨",
    antibodies: "항체",
    hologram: "효율",
    ecosystem: "에코시스템",
    liveEvents: "실시간 활동",
    evolution: "진화 상태",
    quit: "Ctrl+C로 종료",
    noEvents: "이상 없음. 위협을 감시 중...",
    noise: "시스템 이벤트 필터링됨",
  },
};

const BOX = { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│", ml: "├", mr: "┤" };
const W = 62;

function hline(l: string, r: string) { return `${l}${BOX.h.repeat(W)}${r}`; }
function row(s: string) {
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
  const pad = Math.max(0, W - 2 - visualWidth(stripped));
  return `${BOX.v} ${s}${" ".repeat(pad)} ${BOX.v}`;
}

function visualWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x2e80 && cp <= 0x9fff) ||
        (cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0xf900 && cp <= 0xfaff) ||
        (cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0x20000 && cp <= 0x2fa1f)) w += 2;
    else w += 1;
  }
  return w;
}

function kv(label: string, value: string) {
  const stripped = label.replace(/\x1b\[[0-9;]*m/g, "");
  const gap = 14 - visualWidth(stripped);
  return row(`${C.dim}${label}${C.reset}${" ".repeat(Math.max(1, gap))}${value}`);
}

function gaugeBar(value: number, max: number, width = 16): string {
  const ratio = Math.min(value / Math.max(max, 1), 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const color = ratio >= 0.7 ? C.green : ratio >= 0.4 ? C.yellow : C.red;
  return `${color}${"█".repeat(filled)}${C.dim}${"░".repeat(empty)}${C.reset}`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/** Noise filter: skip tmp files, metadata-only changes */
const NOISE_PATTERNS = [/\.tmp$/, /\.swp$/, /~$/, /\.DS_Store/, /thumbs\.db/i];

function isNoise(msg: string): boolean {
  return NOISE_PATTERNS.some(p => p.test(msg));
}

/** Transform raw S.E.A.M events into user-friendly narratives */
function narrativeEvent(phase: string, msg: string, lang: "en" | "ko"): { icon: string; text: string; color: string } {
  const fileName = extractFileName(msg);

  // Mutate (heal/restore) — highest priority
  if (phase === "Mutate") {
    if (msg.includes("Restoring") || msg.includes("Restored") || msg.includes("corruption")) {
      return {
        icon: "🚨",
        text: lang === "ko"
          ? `PROTECTED: ${fileName} AI 손상 복구 완료`
          : `PROTECTED: AI-induced corruption in ${fileName} reverted`,
        color: C.red,
      };
    }
    return { icon: "💉", text: msg.slice(0, 50), color: C.yellow };
  }

  // Adapt (learning)
  if (phase === "Adapt") {
    if (msg.includes("seeded") || msg.includes("updated")) {
      return {
        icon: "🧬",
        text: lang === "ko"
          ? `${fileName} 유전 메모리 업데이트`
          : `Genetic memory updated for ${fileName}`,
        color: C.cyan,
      };
    }
    if (msg.includes("Double-tap") || msg.includes("dormant")) {
      return {
        icon: "🤝",
        text: lang === "ko"
          ? `사용자 의도 확인 — ${fileName} 보호 해제`
          : `User intent confirmed — standing down on ${fileName}`,
        color: C.dim,
      };
    }
    return { icon: "🧪", text: msg.slice(0, 50), color: C.yellow };
  }

  // Quarantine
  if (phase === "Quarantine") {
    return {
      icon: "🔒",
      text: lang === "ko"
        ? `${fileName} 격리 저장됨`
        : `Quarantined ${fileName} for analysis`,
      color: C.magenta,
    };
  }

  // Sense (scanning/detection)
  if (phase === "Sense") {
    if (msg.includes("unlink")) {
      return {
        icon: "⚠️",
        text: lang === "ko"
          ? `삭제 감지: ${fileName}`
          : `Deletion detected: ${fileName}`,
        color: C.red,
      };
    }
    if (msg.includes("change")) {
      return {
        icon: "👀",
        text: lang === "ko"
          ? `${fileName} 변경 스캔 중...`
          : `Scanning changes in ${fileName}...`,
        color: C.dim,
      };
    }
    if (msg.includes("Smart Discovery")) {
      return { icon: "🔍", text: msg.slice(0, 50), color: C.cyan };
    }
    return { icon: "📡", text: msg.slice(0, 50), color: C.dim };
  }

  // Extract (hologram tips)
  if (phase === "Extract") {
    return { icon: "💡", text: msg.slice(0, 50), color: C.cyan };
  }

  return { icon: "📌", text: msg.slice(0, 50), color: C.dim };
}

function extractFileName(msg: string): string {
  const match = msg.match(/→\s*(\S+)/) || msg.match(/(?:in|on|for)\s+(\S+)/);
  if (match) {
    const name = match[1].replace(/[().,;]+$/, "");
    return name.length > 30 ? "..." + name.slice(-27) : name;
  }
  return "file";
}

interface ScoreData {
  uptime: number;
  filesDetected: number;
  totalEvents: number;
  immune: { antibodies: number; autoHealed: number };
  hologram: { lifetime: { requests: number; savings: number } };
  ecosystem: { primary: string };
  evolution?: { totalQuarantined: number; totalLearned: number; pending: number };
}

interface LiveEvent {
  phase: string;
  msg: string;
  ts: number;
}

interface DisplayEvent {
  icon: string;
  text: string;
  color: string;
  time: string;
}

export async function watchCommand() {
  const lang = getSystemLanguage();
  const m = msgs[lang];

  const info = getDaemonInfo();
  if (!info) {
    console.error(`${C.red}${m.notRunning}${C.reset}`);
    process.exit(1);
  }

  console.log(`${C.dim}${m.connecting}${C.reset}`);

  let score: ScoreData | null = null;
  const displayLog: DisplayEvent[] = [];
  const MAX_EVENTS = 12;
  let noiseCount = 0;

  async function refreshScore() {
    try {
      score = await daemonRequest<ScoreData>("/score");
    } catch { /* daemon might stop */ }
  }

  await refreshScore();
  const scoreInterval = setInterval(refreshScore, 5000);

  // Connect SSE
  const sseAbort = new AbortController();
  connectSSE();

  function connectSSE() {
    fetch(`http://127.0.0.1:${info!.port}/events`, {
      signal: sseAbort.signal,
    }).then(async (res) => {
      if (!res.body) return;
      const decoder = new TextDecoder();
      const reader = res.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as LiveEvent;

            // Filter noise
            if (isNoise(evt.msg)) {
              noiseCount++;
              continue;
            }

            const narrative = narrativeEvent(evt.phase, evt.msg, lang);
            const time = new Date(evt.ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
            displayLog.push({ ...narrative, time });
            if (displayLog.length > MAX_EVENTS) displayLog.shift();
            render();
          } catch { /* skip */ }
        }
      }
    }).catch(() => { /* connection lost */ });
  }

  function render() {
    const lines: string[] = [];

    lines.push("\x1b[2J\x1b[H");

    // Header
    lines.push(hline(BOX.tl, BOX.tr));
    lines.push(row(`${C.bold}🛡️  ${m.title}${C.reset}`));
    lines.push(hline(BOX.ml, BOX.mr));

    if (score) {
      lines.push(kv(m.ecosystem, `${C.bold}${C.white}${score.ecosystem.primary}${C.reset}`));
      lines.push(kv(m.uptime, `${C.green}${formatUptime(score.uptime)}${C.reset}`));
      lines.push(kv(m.events, `${score.totalEvents}`));
      lines.push(kv(m.heals, `${C.bold}${C.green}${score.immune.autoHealed}${C.reset}`));
      lines.push(kv(m.antibodies, `${score.immune.antibodies}  ${gaugeBar(score.immune.antibodies, 10, 12)}`));

      const holoSav = score.hologram.lifetime.savings;
      lines.push(kv(m.hologram, `${score.hologram.lifetime.requests} req  ${gaugeBar(holoSav, 100, 12)}`));

      if (score.evolution) {
        const evo = score.evolution;
        lines.push(kv(m.evolution, `${evo.totalLearned} learned / ${evo.pending} pending`));
      }
    }

    // Live events
    lines.push(hline(BOX.ml, BOX.mr));
    lines.push(row(`${C.bold}${m.liveEvents}${C.reset}`));
    lines.push(row(`${C.dim}${BOX.h.repeat(W - 4)}${C.reset}`));

    if (displayLog.length === 0) {
      lines.push(row(`  ${C.dim}${m.noEvents}${C.reset}`));
    } else {
      for (const evt of displayLog) {
        const truncText = evt.text.length > 42 ? evt.text.slice(0, 39) + "..." : evt.text;
        lines.push(row(`${evt.icon} ${C.dim}${evt.time}${C.reset} ${evt.color}${truncText}${C.reset}`));
      }
    }

    if (noiseCount > 0) {
      lines.push(row(`  ${C.dim}(${noiseCount} ${m.noise})${C.reset}`));
    }

    lines.push(hline(BOX.ml, BOX.mr));
    lines.push(row(`${C.dim}💡 ${m.quit}${C.reset}`));
    lines.push(hline(BOX.bl, BOX.br));

    process.stdout.write(lines.join("\n") + "\n");
  }

  render();

  const renderInterval = setInterval(() => {
    if (score) score.uptime++;
    render();
  }, 1000);

  process.on("SIGINT", () => {
    clearInterval(scoreInterval);
    clearInterval(renderInterval);
    sseAbort.abort();
    console.log("\n");
    process.exit(0);
  });
}
