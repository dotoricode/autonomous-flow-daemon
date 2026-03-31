import { daemonRequest } from "../daemon/client";
import { fmtNum, visualWidth, localizedBoast } from "../core/boast";
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
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function heatBar(value: number, max: number, width = 20): string {
  const filled = Math.min(Math.round((value / Math.max(max, 1)) * width), width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

function formatChars(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

const W = 46;
const line = "\u2500".repeat(W);
const sep = "\u2500".repeat(30);

function row(content: string): string {
  const vw = visualWidth(content);
  const padSize = Math.max(0, W - vw);
  return `\u2502${content}${" ".repeat(padSize)}\u2502`;
}

function vwPad(s: string, target: number): string {
  const vw = visualWidth(s);
  return s + " ".repeat(Math.max(0, target - vw));
}

/** Render a labeled key-value row with visual-width-aware padding. */
function kv(label: string, value: string): string {
  return row(`  ${vwPad(label, 13)}: ${value}`);
}

export async function scoreCommand() {
  const lang = getSystemLanguage();
  const i18n = getMessages(lang);

  try {
    const data = await daemonRequest<ScoreData>("/score");
    const h = data.hologram;

    // Title
    console.log(`\u250C${line}\u2510`);
    console.log(row(`  ${i18n.SCORE_TITLE}`));
    console.log(`\u251C${line}\u2524`);

    // Ecosystem
    console.log(kv(i18n.SCORE_ECOSYSTEM, data.ecosystem.primary));
    if (data.ecosystem.detected.length > 1) {
      const others = data.ecosystem.detected.slice(1).map(e => e.name).join(", ");
      console.log(kv(i18n.SCORE_ALSO_FOUND, others));
    }

    // Uptime / Events / Files
    console.log(`\u251C${line}\u2524`);
    console.log(kv(i18n.SCORE_UPTIME, formatUptime(data.uptime)));
    console.log(kv(i18n.SCORE_EVENTS, String(data.totalEvents)));
    console.log(kv(i18n.SCORE_FILES_FOUND, String(data.watchedFiles.length)));
    console.log(`\u251C${line}\u2524`);
    console.log(row(`  ${vwPad(i18n.SCORE_ACTIVITY, 10)}${heatBar(data.totalEvents, 100)}`));

    // Hologram section
    console.log(`\u251C${line}\u2524`);
    console.log(row(`  ${i18n.SCORE_HOLOGRAM_TITLE}`));
    console.log(row(`  ${sep}`));
    const lt = h.lifetime;
    if (lt.requests > 0) {
      // Today stats (if available)
      if (h.today && h.today.requests > 0) {
        const todaySaved = h.today.originalChars - h.today.hologramChars;
        console.log(kv(`${i18n.SCORE_HOLOGRAM_TODAY}`, `${h.today.requests} req / ${formatChars(todaySaved)} saved (${h.today.savings}%)`));
      }
      // Lifetime stats
      const ltSaved = lt.originalChars - lt.hologramChars;
      console.log(kv(`${i18n.SCORE_HOLOGRAM_LIFETIME}`, `${lt.requests} req / ${formatChars(ltSaved)} saved (${lt.savings}%)`));
      console.log(row(`  ${vwPad(i18n.SCORE_HOLOGRAM_EFFICIENCY, 10)}${heatBar(lt.savings, 100)}`));
    } else {
      console.log(row(`  ${i18n.SCORE_HOLOGRAM_EMPTY}`));
      console.log(row(`  ${i18n.SCORE_HOLOGRAM_HINT}`));
    }

    // Immune System section
    console.log(`\u251C${line}\u2524`);
    console.log(row(`  ${i18n.SCORE_IMMUNE_TITLE}`));
    console.log(row(`  ${sep}`));
    const ab = data.immune.antibodies;
    const ah = data.immune.autoHealed;
    const immuneLevel = ab === 0 ? i18n.SCORE_IMMUNE_VULNERABLE
      : ab < 3 ? i18n.SCORE_IMMUNE_LEARNING
      : ab < 6 ? i18n.SCORE_IMMUNE_GUARDED
      : i18n.SCORE_IMMUNE_FORTIFIED;
    console.log(kv(i18n.SCORE_ANTIBODIES, String(ab)));
    console.log(kv(i18n.SCORE_LEVEL, immuneLevel));
    console.log(row(`  ${vwPad(i18n.SCORE_IMMUNITY, 10)}${heatBar(ab, 10)}`));
    const healedStr = t(i18n.SCORE_AUTO_HEALED, { count: ah, s: ah !== 1 ? "s" : "" });
    console.log(kv(i18n.SCORE_AUTO_HEALED_LABEL, healedStr));
    if (data.immune.lastAutoHeal) {
      const ago = formatUptime(Math.floor((Date.now() - data.immune.lastAutoHeal.at) / 1000));
      const healStr = t(i18n.SCORE_LAST_HEAL, { id: data.immune.lastAutoHeal.id, ago });
      console.log(kv(i18n.SCORE_LAST_EVENT, healStr));
    }

    // Watched files
    console.log(`\u251C${line}\u2524`);
    if (data.watchedFiles.length > 0) {
      console.log(row(`  ${i18n.SCORE_WATCHED_FILES}`));
      for (const f of data.watchedFiles.slice(0, 8)) {
        console.log(row(`    ${f.substring(0, W - 6)}`));
      }
      if (data.watchedFiles.length > 8) {
        console.log(row(`    ... +${data.watchedFiles.length - 8} more`));
      }
    } else {
      console.log(row(`  ${i18n.SCORE_NO_FILES}`));
    }

    // Last event
    if (data.lastEvent) {
      const ago = data.lastEventAt
        ? t(i18n.SCORE_AGO, { time: formatUptime(Math.floor((Date.now() - data.lastEventAt) / 1000)) })
        : "unknown";
      console.log(`\u251C${line}\u2524`);
      console.log(row(`  ${vwPad(i18n.SCORE_LAST_EVENT, 6)}: ${data.lastEvent.substring(0, 34)}`));
      console.log(row(`        ${ago}`));
    }

    // Value Metrics section
    try {
      const summary = await daemonRequest<ShiftSummary>("/shift-summary");
      console.log(`\u251C${line}\u2524`);
      console.log(row(`  ${i18n.SCORE_VALUE_TITLE}`));
      console.log(row(`  ${sep}`));
      console.log(kv(i18n.SHIFT_TOKENS, `~${fmtNum(summary.totalTokensSaved)}`));
      console.log(kv(i18n.SHIFT_TIME, `~${summary.totalMinutesSaved} min`));
      console.log(kv(i18n.SHIFT_COST, `~$${summary.totalCostSaved.toFixed(2)}`));
      if (summary.suppressionsSkipped > 0) {
        console.log(kv(i18n.SHIFT_SUPPRESSED, `${summary.suppressionsSkipped}`));
      }
      console.log(`\u251C${line}\u2524`);
      const boast = localizedBoast(lang);
      console.log(row(`  \uD83D\uDDE3\uFE0F ${boast.substring(0, W - 6)}`));
    } catch {
      // Non-fatal
    }

    console.log(`\u2514${line}\u2518`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[afd] ${msg}`);
    process.exit(1);
  }
}
