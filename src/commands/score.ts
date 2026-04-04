import { daemonRequest } from "../daemon/client";
import { fmtNum, visualWidth, localizedBoast, formatUptime } from "../core/boast";
import type { ShiftSummary } from "../core/boast";
import { getSystemLanguage } from "../core/locale";
import { getMessages, t } from "../core/i18n/messages";

interface HologramEntry {
  requests: number;
  originalChars: number;
  hologramChars: number;
  savings: number;
}

interface HologramDailyRow {
  date: string;
  requests: number;
  originalChars: number;
  hologramChars: number;
}

interface HologramScore {
  lifetime: HologramEntry;
  today: HologramEntry | null;
  daily: HologramDailyRow[];
}

interface AutoHealEntry {
  id: string;
  at: number;
}

interface ImmuneScore {
  antibodies: number;
  autoHealed: number;
  lastAutoHeal: AutoHealEntry | null;
}

interface EcosystemEntry {
  name: string;
  confidence: string;
}

interface EcosystemScore {
  detected: EcosystemEntry[];
  primary: string;
}

interface SuppressionScore {
  massEventsSkipped: number;
  dormantTransitions: number;
  activeTaps: number;
}

interface DynamicImmuneScore {
  activeValidators: number;
  validatorNames: string[];
}

interface ScoreData {
  uptime: number;
  filesDetected: number;
  totalEvents: number;
  lastEvent: string | null;
  lastEventAt: number | null;
  watchedFiles: string[];
  watchTargets: string[];
  hologram: HologramScore;
  immune: ImmuneScore;
  ecosystem: EcosystemScore;
  suppression: SuppressionScore;
  dynamicImmune?: DynamicImmuneScore;
}

// ── ANSI helpers ──
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};


function gaugeBar(value: number, max: number, width = 20): string {
  const ratio = Math.min(value / Math.max(max, 1), 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const color = ratio >= 0.7 ? C.green : ratio >= 0.4 ? C.yellow : C.red;
  const pct = Math.round(ratio * 100);
  return `${color}${"█".repeat(filled)}${C.dim}${"░".repeat(empty)}${C.reset} ${pct}%`;
}

function formatChars(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

const W = 52;
const line = "─".repeat(W);

function row(content: string): string {
  // Strip ANSI for width calculation
  const stripped = content.replace(/\x1b\[[0-9;]*m/g, "");
  const vw = visualWidth(stripped);
  const padSize = Math.max(0, W - vw);
  return `│${content}${" ".repeat(padSize)}│`;
}

function section(title: string): string {
  return row(`  ${C.bold}${C.cyan}${title}${C.reset}`);
}

function kv(label: string, value: string): string {
  const stripped = label.replace(/\x1b\[[0-9;]*m/g, "");
  const gap = 18 - visualWidth(stripped);
  return row(`  ${C.dim}${label}${C.reset}${" ".repeat(Math.max(1, gap))}${value}`);
}

function guardianGrade(antibodies: number, heals: number, holoSavings: number): { grade: string; label: string; color: string } {
  const score = Math.min(antibodies * 15, 40) + Math.min(heals * 10, 30) + Math.min(holoSavings * 0.3, 30);
  if (score >= 80) return { grade: "A+", label: "FORTIFIED", color: C.green };
  if (score >= 60) return { grade: "A", label: "GUARDED", color: C.green };
  if (score >= 40) return { grade: "B", label: "LEARNING", color: C.yellow };
  if (score >= 20) return { grade: "C", label: "EXPOSED", color: C.yellow };
  return { grade: "D", label: "VULNERABLE", color: C.red };
}

export async function scoreCommand() {
  const lang = getSystemLanguage();
  const i18n = getMessages(lang);

  try {
    const data = await daemonRequest<ScoreData>("/score");
    const h = data.hologram;
    const holoSav = h.lifetime.savings;
    const grade = guardianGrade(data.immune.antibodies, data.immune.autoHealed, holoSav);

    const out: string[] = [];

    // ── Header ──
    out.push(`┌${line}┐`);
    out.push(row(`  ${C.bold}🛡️  Guardian Status${C.reset}              ${grade.color}${C.bold}[ ${grade.grade} ]${C.reset} ${grade.color}${grade.label}${C.reset}`));
    out.push(`├${line}┤`);

    // ── Health Gauge ──
    const healthPct = Math.min(data.immune.antibodies * 15 + data.immune.autoHealed * 10 + holoSav * 0.3, 100);
    out.push(row(`  ${gaugeBar(healthPct, 100, 30)}`));
    out.push(`├${line}┤`);

    // ── System Info ──
    out.push(section(lang === "ko" ? "시스템 정보" : "System Info"));
    out.push(kv(i18n.SCORE_ECOSYSTEM, `${C.white}${C.bold}${data.ecosystem.primary}${C.reset}`));
    if (data.ecosystem.detected.length > 1) {
      const others = data.ecosystem.detected.slice(1).map(e => e.name).join(", ");
      out.push(kv(i18n.SCORE_ALSO_FOUND, `${C.dim}${others}${C.reset}`));
    }
    out.push(kv(i18n.SCORE_UPTIME, `${C.green}${formatUptime(data.uptime)}${C.reset}`));
    out.push(kv(i18n.SCORE_EVENTS, `${data.totalEvents}`));
    out.push(kv(i18n.SCORE_FILES_FOUND, `${data.watchedFiles.length}`));

    // ── Immune System ──
    out.push(`├${line}┤`);
    out.push(section(lang === "ko" ? "면역 시스템" : "Immune System"));
    const ab = data.immune.antibodies;
    const ah = data.immune.autoHealed;
    out.push(kv(i18n.SCORE_ANTIBODIES, `${C.bold}${ab}${C.reset}`));
    out.push(row(`  ${lang === "ko" ? "면역력" : "Immunity"}        ${gaugeBar(ab, 10, 20)}`));
    out.push(kv(lang === "ko" ? "차단 횟수" : "Prevented", `${C.bold}${C.green}${ah}${C.reset}${C.dim} disaster${ah !== 1 ? "s" : ""}${C.reset}`));
    if (data.immune.lastAutoHeal) {
      const ago = formatUptime(Math.floor((Date.now() - data.immune.lastAutoHeal.at) / 1000));
      out.push(kv(lang === "ko" ? "마지막 치유" : "Last Heal", `${data.immune.lastAutoHeal.id} ${C.dim}(${ago} ago)${C.reset}`));
    }

    // ── Dynamic Immune Synthesis ──
    if (data.dynamicImmune && data.dynamicImmune.activeValidators > 0) {
      out.push(`├${line}┤`);
      out.push(section(lang === "ko" ? "진화 상태 (동적 면역)" : "Evolution (Dynamic Immune)"));
      out.push(kv(
        lang === "ko" ? "활성 검증기" : "Validators",
        `${C.bold}${C.green}${data.dynamicImmune.activeValidators} Active${C.reset}`
      ));
      const names = data.dynamicImmune.validatorNames.slice(0, 3).join(", ");
      const extra = data.dynamicImmune.validatorNames.length > 3
        ? ` ${C.dim}+${data.dynamicImmune.validatorNames.length - 3} more${C.reset}`
        : "";
      out.push(kv(
        lang === "ko" ? "스크립트" : "Scripts",
        `${C.dim}${names}${C.reset}${extra}`
      ));
    }

    // ── Hologram Efficiency ──
    out.push(`├${line}┤`);
    out.push(section(lang === "ko" ? "토큰 효율 (홀로그램)" : "Token Efficiency (Hologram)"));
    const lt = h.lifetime;
    if (lt.requests > 0) {
      const ltSaved = lt.originalChars - lt.hologramChars;
      out.push(kv(lang === "ko" ? "총 요청" : "Requests", `${lt.requests}`));
      out.push(kv(lang === "ko" ? "절약된 컨텍스트" : "Saved Context", `${C.green}${formatChars(ltSaved)} chars${C.reset}`));
      out.push(row(`  ${lang === "ko" ? "효율" : "Efficiency"}       ${gaugeBar(lt.savings, 100, 20)}`));
      if (h.today && h.today.requests > 0) {
        const todaySaved = h.today.originalChars - h.today.hologramChars;
        out.push(kv(lang === "ko" ? "오늘" : "Today", `${h.today.requests} req / ${C.green}${formatChars(todaySaved)} saved${C.reset}`));
      }
    } else {
      out.push(row(`  ${C.dim}${i18n.SCORE_HOLOGRAM_EMPTY}${C.reset}`));
      out.push(row(`  ${C.dim}${i18n.SCORE_HOLOGRAM_HINT}${C.reset}`));
    }

    // ── Value Delivered (ROI) ──
    try {
      const summary = await daemonRequest<ShiftSummary>("/shift-summary");
      out.push(`├${line}┤`);
      out.push(section(lang === "ko" ? "전달된 가치 (ROI)" : "Value Delivered (ROI)"));

      // Breakdown: Auto-Heal
      if (summary.healTokensSaved > 0) {
        out.push(kv(
          lang === "ko" ? "🩹 치유 절약" : "🩹 Heal Saved",
          `${C.dim}~${fmtNum(summary.healTokensSaved)} tok / $${summary.healCostSaved.toFixed(2)}${C.reset}`
        ));
      }

      // Breakdown: Hologram
      if (summary.hologramTokensSaved > 0) {
        out.push(kv(
          lang === "ko" ? "💎 홀로그램" : "💎 Hologram",
          `${C.dim}~${fmtNum(summary.hologramTokensSaved)} tok / $${summary.hologramCostSaved.toFixed(2)}${C.reset}`
        ));
      }

      // Total
      out.push(kv(
        lang === "ko" ? "총 절약 토큰" : "Total Tokens",
        `${C.bold}${C.green}~${fmtNum(summary.totalTokensSaved)}${C.reset}`
      ));
      out.push(kv(lang === "ko" ? "절약 시간" : "Time Saved", `${C.green}~${summary.totalMinutesSaved} min${C.reset}`));
      out.push(kv(
        lang === "ko" ? "총 절약 비용" : "Total Cost",
        `${C.bold}${C.green}~$${summary.totalCostSaved.toFixed(2)}${C.reset}`
      ));
      if (summary.suppressionsSkipped > 0) {
        out.push(kv(lang === "ko" ? "억제 횟수" : "Suppressed", `${summary.suppressionsSkipped}`));
      }
    } catch { /* non-fatal */ }

    // ── Boast ──
    out.push(`├${line}┤`);
    const boast = localizedBoast(lang);
    const truncBoast = boast.length > W - 6 ? boast.slice(0, W - 9) + "..." : boast;
    out.push(row(`  ${C.magenta}🗣️ ${truncBoast}${C.reset}`));
    out.push(`└${line}┘`);

    console.log(out.join("\n"));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${C.red}[afd] ${msg}${C.reset}`);
    process.exit(1);
  }
}
