import { daemonRequest } from "../daemon/client";

interface HologramScore {
  requests: number;
  originalChars: number;
  hologramChars: number;
  savings: number;
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

const W = 46; // inner box width
const line = "\u2500".repeat(W);
const row = (content: string) => `\u2502${content.padEnd(W)}\u2502`;

export async function scoreCommand() {
  try {
    const data = await daemonRequest<ScoreData>("/score");
    const h = data.hologram;

    console.log(`\u250C${line}\u2510`);
    console.log(row("  afd score \u2014 Daemon Diagnostics"));
    console.log(`\u251C${line}\u2524`);
    console.log(row(`  Ecosystem    : ${data.ecosystem.primary}`));
    if (data.ecosystem.detected.length > 1) {
      const others = data.ecosystem.detected.slice(1).map(e => e.name).join(", ");
      console.log(row(`  Also found   : ${others}`));
    }
    console.log(`\u251C${line}\u2524`);
    console.log(row(`  Uptime       : ${formatUptime(data.uptime)}`));
    console.log(row(`  Events       : ${data.totalEvents}`));
    console.log(row(`  Files Found  : ${data.watchedFiles.length}`));
    console.log(`\u251C${line}\u2524`);
    console.log(row(`  Activity  ${heatBar(data.totalEvents, 100)}`));

    // Context Efficiency section
    console.log(`\u251C${line}\u2524`);
    console.log(row("  Context Efficiency (Hologram)"));
    console.log(row(`  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`));
    if (h.requests > 0) {
      const saved = h.originalChars - h.hologramChars;
      console.log(row(`  Requests     : ${h.requests}`));
      console.log(row(`  Original     : ${formatChars(h.originalChars)} chars`));
      console.log(row(`  Hologram     : ${formatChars(h.hologramChars)} chars`));
      console.log(row(`  Saved        : ${formatChars(saved)} chars (${h.savings}%)`));
      console.log(row(`  Efficiency   ${heatBar(h.savings, 100)}`));
    } else {
      console.log(row("  No hologram requests yet."));
      console.log(row("  Use: GET /hologram?file=<path>"));
    }

    // Immune System section
    console.log(`\u251C${line}\u2524`);
    console.log(row("  Immune System"));
    console.log(row(`  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`));
    const ab = data.immune.antibodies;
    const ah = data.immune.autoHealed;
    const immuneLevel = ab === 0 ? "Vulnerable" : ab < 3 ? "Learning" : ab < 6 ? "Guarded" : "Fortified";
    console.log(row(`  Antibodies   : ${ab}`));
    console.log(row(`  Level        : ${immuneLevel}`));
    console.log(row(`  Immunity     ${heatBar(ab, 10)}`));
    console.log(row(`  Auto-healed  : ${ah} background event${ah !== 1 ? "s" : ""}`));
    if (data.immune.lastAutoHeal) {
      const ago = formatUptime(Math.floor((Date.now() - data.immune.lastAutoHeal.at) / 1000));
      console.log(row(`  Last heal    : ${data.immune.lastAutoHeal.id} (${ago} ago)`));
    }

    // Watched files
    console.log(`\u251C${line}\u2524`);
    if (data.watchedFiles.length > 0) {
      console.log(row("  Watched Files:"));
      for (const f of data.watchedFiles.slice(0, 8)) {
        console.log(row(`    ${f.substring(0, W - 6)}`));
      }
      if (data.watchedFiles.length > 8) {
        console.log(row(`    ... +${data.watchedFiles.length - 8} more`));
      }
    } else {
      console.log(row("  No files detected yet."));
    }

    if (data.lastEvent) {
      const ago = data.lastEventAt
        ? formatUptime(Math.floor((Date.now() - data.lastEventAt) / 1000)) + " ago"
        : "unknown";
      console.log(`\u251C${line}\u2524`);
      console.log(row(`  Last: ${data.lastEvent.substring(0, 36)}`));
      console.log(row(`        ${ago}`));
    }

    console.log(`\u2514${line}\u2518`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[afd] ${msg}`);
    process.exit(1);
  }
}
