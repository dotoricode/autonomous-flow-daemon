/**
 * Boastful Doctor — Gamification & Delightful Logging
 *
 * Lightweight value calculations that stay well under the 270ms budget.
 * All math is O(1) — no I/O, no async.
 * All strings are localized via the i18n dictionary.
 */

import { getSystemLanguage } from "./locale";
import type { SupportedLang } from "./locale";
import { getMessages, t } from "./i18n/messages";
import type { MessageDict } from "./i18n/messages";

// ── Token & Cost Estimation ──

/** Rough chars-per-token ratio for code (conservative estimate) */
const CHARS_PER_TOKEN = 3.5;

/** Average cost per 1K input tokens (Claude Sonnet ballpark) */
const COST_PER_1K_TOKENS = 0.003;

/** Estimated minutes a developer spends debugging a missing config */
const DEBUG_MINUTES_BASE = 8;
const DEBUG_MINUTES_PER_KB = 2;

export interface HealMetrics {
  fileSize: number;
  healTimeMs: number;
  tokensSaved: number;
  minutesSaved: number;
  costSaved: number;
}

/** Calculate mock "value saved" from a heal event. O(1), no I/O. */
export function calcHealMetrics(fileSize: number, healTimeMs: number): HealMetrics {
  const tokensSaved = Math.round(fileSize / CHARS_PER_TOKEN);
  const fileSizeKB = fileSize / 1024;
  const minutesSaved = Math.round(DEBUG_MINUTES_BASE + fileSizeKB * DEBUG_MINUTES_PER_KB);
  const costSaved = Math.round(tokensSaved / 1000 * COST_PER_1K_TOKENS * 100) / 100;
  return { fileSize, healTimeMs, tokensSaved, minutesSaved, costSaved };
}

export interface ShiftSummary {
  uptimeFormatted: string;
  totalEvents: number;
  healsPerformed: number;
  totalTokensSaved: number;
  totalMinutesSaved: number;
  totalCostSaved: number;
  suppressionsSkipped: number;
  dormantTransitions: number;
  boast: string;
}

/** Build a shift summary from aggregated daemon stats. */
export function buildShiftSummary(stats: {
  uptimeSeconds: number;
  totalEvents: number;
  healsPerformed: number;
  totalFileBytesSaved: number;
  suppressionsSkipped: number;
  dormantTransitions: number;
}, lang?: SupportedLang): ShiftSummary {
  const l = lang ?? getSystemLanguage();
  const msg = getMessages(l);
  const totalTokensSaved = Math.round(stats.totalFileBytesSaved / CHARS_PER_TOKEN);
  const totalMinutesSaved = stats.healsPerformed * DEBUG_MINUTES_BASE;
  const totalCostSaved = Math.round(totalTokensSaved / 1000 * COST_PER_1K_TOKENS * 100) / 100;

  return {
    uptimeFormatted: formatUptime(stats.uptimeSeconds),
    totalEvents: stats.totalEvents,
    healsPerformed: stats.healsPerformed,
    totalTokensSaved,
    totalMinutesSaved,
    totalCostSaved,
    suppressionsSkipped: stats.suppressionsSkipped,
    dormantTransitions: stats.dormantTransitions,
    boast: pick(msg.BOAST_SHIFT_END),
  };
}

// ── Boast Selection ──

function msg(lang?: SupportedLang): MessageDict {
  return getMessages(lang ?? getSystemLanguage());
}

/** Pick a random heal boast. 1-in-N chance (anti-annoyance). */
export function maybeHealBoast(triggerChance = 5, lang?: SupportedLang): string | null {
  if (Math.floor(Math.random() * triggerChance) !== 0) return null;
  const m = msg(lang);
  return pick(m.BOAST_HEAL);
}

/** Always returns a dormant boast (rare event, always worth noting). */
export function dormantBoast(lang?: SupportedLang): string {
  return pick(msg(lang).BOAST_DORMANT);
}

/** Format a single heal log line with metrics. */
export function formatHealLog(
  fileName: string,
  metrics: HealMetrics,
  boast: string | null,
  lang?: SupportedLang,
): string {
  const m = msg(lang);
  const vars = {
    fileName,
    ms: metrics.healTimeMs,
    tokens: metrics.tokensSaved,
    mins: metrics.minutesSaved,
  };
  const base = t(m.HEAL_LOG, vars);
  if (!boast) return base;
  const boastLine = t(boast, vars);
  return `${base}\n${m.BOAST_HEAL_PREFIX} ${boastLine}`;
}

/** Format dormant log line. */
export function formatDormantLog(
  antibodyId: string,
  lang?: SupportedLang,
): string {
  const m = msg(lang);
  const boast = pick(m.BOAST_DORMANT);
  return t(m.DORMANT_LOG, { id: antibodyId, boast });
}

/** Format the full shift summary for terminal output. */
export function formatShiftSummary(s: ShiftSummary, lang?: SupportedLang): string {
  const m = msg(lang);
  const lines = [
    "",
    "┌──────────────────────────────────────────────┐",
    pad(`  ${m.SHIFT_TITLE}`),
    "├──────────────────────────────────────────────┤",
    padKV(m.SHIFT_ON_DUTY, s.uptimeFormatted),
    padKV(m.SHIFT_EVENTS, String(s.totalEvents)),
    padKV(m.SHIFT_HEALS, String(s.healsPerformed)),
    padKV(m.SHIFT_TOKENS, `~${fmtNum(s.totalTokensSaved)}`),
    padKV(m.SHIFT_TIME, `~${s.totalMinutesSaved} min`),
    padKV(m.SHIFT_COST, `~$${s.totalCostSaved.toFixed(2)}`),
  ];

  if (s.suppressionsSkipped > 0) {
    padKVPush(lines, m.SHIFT_SUPPRESSED, `${s.suppressionsSkipped} mass events`);
  }
  if (s.dormantTransitions > 0) {
    padKVPush(lines, m.SHIFT_RETIRED, `${s.dormantTransitions} antibodies`);
  }

  lines.push("├──────────────────────────────────────────────┤");
  lines.push(pad(`  ${s.boast}`));
  lines.push("└──────────────────────────────────────────────┘");
  lines.push("");

  return lines.join("\n");
}

/** Format value section for score command. */
export function formatValueSection(s: ShiftSummary, lang?: SupportedLang): string[] {
  const m = msg(lang);
  const lines: string[] = [];
  lines.push(m.SCORE_VALUE_TITLE);
  lines.push(`${m.SHIFT_TOKENS}: ~${fmtNum(s.totalTokensSaved)}`);
  lines.push(`${m.SHIFT_TIME}: ~${s.totalMinutesSaved} min`);
  lines.push(`${m.SHIFT_COST}: ~$${s.totalCostSaved.toFixed(2)}`);
  return lines;
}

// ── Helpers ──

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

const W = 46;

function pad(content: string): string {
  const visual = visualWidth(content);
  if (visual > W) {
    let len = 0;
    let cut = 0;
    for (const ch of content) {
      const cw = isWideChar(ch) ? 2 : 1;
      if (len + cw > W - 1) break;
      len += cw;
      cut += ch.length;
    }
    const trimmed = content.slice(0, cut) + "…";
    const trimVw = visualWidth(trimmed);
    return `│${trimmed}${" ".repeat(Math.max(0, W - trimVw))}│`;
  }
  return `│${content}${" ".repeat(Math.max(0, W - visual))}│`;
}

/** Pad a key-value row with aligned colon, visual-width-aware. */
function padKV(key: string, value: string): string {
  const keyVw = visualWidth(key);
  const padSize = Math.max(0, 13 - keyVw);
  return pad(`  ${key}${" ".repeat(padSize)}: ${value}`);
}

function padKVPush(lines: string[], key: string, value: string): void {
  lines.push(padKV(key, value));
}

export function visualWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    w += isWideChar(ch) ? 2 : 1;
  }
  return w;
}

function isWideChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    // CJK Unified Ideographs
    (code >= 0x4E00 && code <= 0x9FFF) ||
    // CJK Extension A
    (code >= 0x3400 && code <= 0x4DBF) ||
    // Hangul Syllables
    (code >= 0xAC00 && code <= 0xD7AF) ||
    // Hangul Jamo
    (code >= 0x1100 && code <= 0x11FF) ||
    // Hangul Compatibility Jamo
    (code >= 0x3130 && code <= 0x318F) ||
    // CJK Compatibility
    (code >= 0x3300 && code <= 0x33FF) ||
    // Fullwidth Forms
    (code >= 0xFF01 && code <= 0xFF60) ||
    // Common emoji ranges
    (code >= 0x1F300 && code <= 0x1FBFF) ||
    (code >= 0x2600 && code <= 0x27BF) ||
    (code >= 0xFE00 && code <= 0xFE0F) ||
    (code >= 0x200D && code <= 0x200D) ||
    (code >= 0x231A && code <= 0x23FA) ||
    code === 0x2764 ||
    code === 0x2139
  );
}

export function fmtNum(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
