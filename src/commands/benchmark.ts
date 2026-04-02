import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { generateHologram } from "../core/hologram";
import { getSystemLanguage } from "../core/locale";

// ── ANSI helpers ──
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

interface FileResult {
  path: string;
  originalLines: number;
  hologramLines: number;
  originalChars: number;
  hologramChars: number;
  savings: number;
}

function collectTsFiles(dir: string, base: string): string[] {
  const results: string[] = [];
  const skipDirs = new Set(["node_modules", ".git", ".afd", "dist", "coverage", ".omc"]);

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) {
        results.push(...collectTsFiles(join(dir, entry.name), base));
      }
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      results.push(join(dir, entry.name));
    }
  }
  return results;
}

function formatChars(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function savingsColor(pct: number): string {
  if (pct >= 80) return C.green;
  if (pct >= 50) return C.yellow;
  return C.red;
}

function padRight(s: string, w: number): string {
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
  return s + " ".repeat(Math.max(0, w - stripped.length));
}

function padLeft(s: string, w: number): string {
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
  return " ".repeat(Math.max(0, w - stripped.length)) + s;
}

export async function benchmarkCommand(options: { sort?: string; top?: string; json?: boolean }) {
  const lang = getSystemLanguage();
  const ko = lang === "ko";
  const cwd = process.cwd();
  const files = collectTsFiles(join(cwd, "src"), cwd);

  if (files.length === 0) {
    console.error(`${C.red}[afd] ${ko ? "src/ 디렉토리에 TS/JS 파일이 없습니다." : "No TS/JS files found in src/."}${C.reset}`);
    process.exit(1);
  }

  const results: FileResult[] = [];
  const startTime = performance.now();

  for (const filePath of files) {
    try {
      const source = readFileSync(filePath, "utf-8");
      const { hologram, originalLength, hologramLength, savings } = generateHologram(filePath, source);
      results.push({
        path: relative(cwd, filePath),
        originalLines: source.split("\n").length,
        hologramLines: hologram.split("\n").length,
        originalChars: originalLength,
        hologramChars: hologramLength,
        savings: Math.round(savings * 10) / 10,
      });
    } catch {
      // Skip files that fail to parse
    }
  }

  const elapsed = Math.round(performance.now() - startTime);

  // Sort
  const sortKey = options.sort ?? "savings";
  results.sort((a, b) => {
    if (sortKey === "size") return b.originalChars - a.originalChars;
    if (sortKey === "name") return a.path.localeCompare(b.path);
    return b.savings - a.savings; // default: savings desc
  });

  const limit = options.top ? parseInt(options.top, 10) : results.length;
  const display = results.slice(0, limit);

  // JSON output
  if (options.json) {
    const totalOriginal = results.reduce((s, r) => s + r.originalChars, 0);
    const totalHologram = results.reduce((s, r) => s + r.hologramChars, 0);
    console.log(JSON.stringify({
      files: results.length,
      totalOriginalChars: totalOriginal,
      totalHologramChars: totalHologram,
      totalSavedChars: totalOriginal - totalHologram,
      overallCompression: totalOriginal > 0 ? Math.round((1 - totalHologram / totalOriginal) * 1000) / 10 : 0,
      estimatedTokensSaved: Math.round((totalOriginal - totalHologram) / 4),
      elapsedMs: elapsed,
      results: results.map(r => ({
        path: r.path,
        originalLines: r.originalLines,
        hologramLines: r.hologramLines,
        originalChars: r.originalChars,
        hologramChars: r.hologramChars,
        savings: r.savings,
      })),
    }, null, 2));
    return;
  }

  // ── Header ──
  console.log();
  console.log(`${C.bold}${C.cyan}  ╔══════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ║       ${ko ? "홀로그램 AST 압축 벤치마크" : "Hologram AST Compression Benchmark"}                       ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ╚══════════════════════════════════════════════════════════════╝${C.reset}`);
  console.log();

  // ── Table Header ──
  const colFile = ko ? "파일" : "File";
  const colLines = ko ? "원본줄" : "Lines";
  const colHolo = ko ? "홀로줄" : "Holo";
  const colOrig = ko ? "원본" : "Original";
  const colComp = ko ? "압축" : "Compressed";
  const colSave = ko ? "절감률" : "Savings";

  console.log(
    `  ${C.dim}${padRight(colFile, 40)} ${padLeft(colLines, 6)} ${padLeft(colHolo, 6)} ${padLeft(colOrig, 8)} ${padLeft(colComp, 8)} ${padLeft(colSave, 8)}${C.reset}`
  );
  console.log(`  ${C.dim}${"─".repeat(80)}${C.reset}`);

  // ── Rows ──
  for (const r of display) {
    const sc = savingsColor(r.savings);
    const savingsStr = `${sc}${r.savings.toFixed(1)}%${C.reset}`;
    console.log(
      `  ${padRight(r.path, 40)} ${padLeft(String(r.originalLines), 6)} ${padLeft(String(r.hologramLines), 6)} ${padLeft(formatChars(r.originalChars), 8)} ${padLeft(formatChars(r.hologramChars), 8)} ${padLeft(savingsStr, 8)}`
    );
  }

  if (limit < results.length) {
    console.log(`  ${C.dim}... ${ko ? `외 ${results.length - limit}개 파일` : `and ${results.length - limit} more files`}${C.reset}`);
  }

  // ── Summary ──
  const totalOriginal = results.reduce((s, r) => s + r.originalChars, 0);
  const totalHologram = results.reduce((s, r) => s + r.hologramChars, 0);
  const totalSaved = totalOriginal - totalHologram;
  const overallPct = totalOriginal > 0 ? Math.round((1 - totalHologram / totalOriginal) * 1000) / 10 : 0;
  const estimatedTokens = Math.round(totalSaved / 4);
  const high = results.filter(r => r.savings >= 70).length;

  console.log();
  console.log(`  ${C.dim}${"─".repeat(80)}${C.reset}`);
  console.log(`  ${C.bold}${ko ? "요약" : "Summary"}${C.reset}`);
  console.log();
  console.log(`  ${ko ? "분석 파일" : "Files analyzed"}     ${C.bold}${results.length}${C.reset}`);
  console.log(`  ${ko ? "전체 압축률" : "Overall compression"} ${C.bold}${savingsColor(overallPct)}${overallPct}%${C.reset}`);
  console.log(`  ${ko ? "원본 크기" : "Original size"}      ${C.bold}${formatChars(totalOriginal)}${C.reset} ${C.dim}(${(totalOriginal / 1024).toFixed(0)} KB)${C.reset}`);
  console.log(`  ${ko ? "압축 크기" : "Compressed size"}    ${C.bold}${formatChars(totalHologram)}${C.reset} ${C.dim}(${(totalHologram / 1024).toFixed(0)} KB)${C.reset}`);
  console.log(`  ${ko ? "절약 크기" : "Saved"}              ${C.bold}${C.green}${formatChars(totalSaved)}${C.reset} ${C.dim}(${(totalSaved / 1024).toFixed(0)} KB)${C.reset}`);
  console.log(`  ${ko ? "추정 토큰 절약" : "Est. tokens saved"}  ${C.bold}${C.green}~${estimatedTokens.toLocaleString()}${C.reset}`);
  console.log(`  ${ko ? "70%+ 압축 파일" : "70%+ compression"}   ${C.bold}${high}${C.reset}/${results.length} ${C.dim}(${Math.round(high / results.length * 100)}%)${C.reset}`);
  console.log(`  ${ko ? "처리 시간" : "Elapsed"}            ${C.dim}${elapsed}ms${C.reset}`);
  console.log();
}
