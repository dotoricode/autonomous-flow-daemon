#!/usr/bin/env bun
/**
 * i18n Output Demonstration
 *
 * Runs two scenarios (heal + shift summary) in both en and ko locales.
 * Uses deterministic random seed via index override for reproducible output.
 */

import { setLanguageOverride } from "../src/core/locale";
import type { SupportedLang } from "../src/core/locale";
import {
  calcHealMetrics,
  formatHealLog,
  formatDormantLog,
  buildShiftSummary,
  formatShiftSummary,
} from "../src/core/boast";

const DIVIDER = "═".repeat(60);

function demo(lang: SupportedLang) {
  setLanguageOverride(lang);

  console.log(`\n${DIVIDER}`);
  console.log(`  LOCALE: ${lang.toUpperCase()}`);
  console.log(DIVIDER);

  // ── Scenario 1: Heal event (2KB auth.ts, 150ms) ──
  console.log(`\n▶ Scenario 1: Successful file heal (2KB auth.ts, 150ms)\n`);

  const fileSize = 2048; // 2KB
  const healMs = 150;
  const metrics = calcHealMetrics(fileSize, healMs);

  // Without boast
  console.log(formatHealLog("auth.ts", metrics, null, lang));

  // With boast (force trigger by passing a pre-picked boast)
  console.log("");
  // We call the format directly with a known boast from the dictionary
  import("../src/core/i18n/messages").then(({ getMessages }) => {
    const msg = getMessages(lang);
    const boast = msg.BOAST_HEAL[0]; // pick first for reproducibility
    console.log(formatHealLog("auth.ts", metrics, boast, lang));
  });

  // ── Scenario 1b: Dormant transition ──
  console.log(`\n▶ Scenario 1b: Dormant transition (double-tap)\n`);
  console.log(formatDormantLog("IMM-002", lang));

  // ── Scenario 2: Shift summary (5 heals today) ──
  console.log(`\n▶ Scenario 2: afd stop — Shift Summary (5 heals)\n`);

  const summary = buildShiftSummary({
    uptimeSeconds: 7200,  // 2 hours
    totalEvents: 142,
    healsPerformed: 5,
    totalFileBytesSaved: 10240, // 10KB total
    suppressionsSkipped: 2,
    dormantTransitions: 1,
  }, lang);

  console.log(formatShiftSummary(summary, lang));
}

// Run both locales
demo("en");

// Small delay to let async import resolve before ko demo
await Bun.sleep(50);
demo("ko");

// Reset
setLanguageOverride(null);
