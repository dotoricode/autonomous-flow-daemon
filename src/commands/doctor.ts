import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { loadAllRules, evaluateRules } from "../core/rule-engine";
import type { DiagnosticRule } from "../core/rule-engine";
import type { PatchOp, Symptom } from "../core/immune";
import { notifyAutoHeal } from "../core/notify";
import { getSystemLanguage } from "../core/locale";

interface DoctorOptions {
  fix?: boolean;
}

// ── i18n ──
const msgs = {
  en: {
    title: "afd doctor — Deep Health Analysis",
    ruleCount: "Rules loaded",
    builtIn: "built-in",
    custom: "custom",
    scanning: "Scanning project health...",
    healthy: "All checks passed. Project is healthy!",
    grade: "Health Grade",
    passed: "Passed",
    failed: "Failed",
    findings: "Findings",
    recommendation: "Recommendation",
    fixable: "auto-fixable",
    fixApplied: "Fixed",
    fixSkipped: "Skipped (no patches)",
    fixSummary: "Auto-fix complete",
    fixHint: "Run `afd doctor --fix` to auto-fix {count} issue(s).",
    severity: { critical: "CRITICAL", warning: "WARNING", info: "INFO" },
  },
  ko: {
    title: "afd doctor — 딥 헬스 분석",
    ruleCount: "로드된 규칙",
    builtIn: "내장",
    custom: "사용자",
    scanning: "프로젝트 건강 상태 스캔 중...",
    healthy: "모든 검사 통과. 프로젝트가 건강합니다!",
    grade: "건강 등급",
    passed: "통과",
    failed: "실패",
    findings: "발견 사항",
    recommendation: "권고사항",
    fixable: "자동 수정 가능",
    fixApplied: "수정 완료",
    fixSkipped: "건너뜀 (패치 없음)",
    fixSummary: "자동 수정 완료",
    fixHint: "`afd doctor --fix`로 {count}건 자동 수정 가능합니다.",
    severity: { critical: "심각", warning: "경고", info: "정보" },
  },
};

// ── Box Drawing ──
const BOX = { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│", ml: "├", mr: "┤" };
const W = 52;

function line(left: string, right: string) {
  return `${left}${BOX.h.repeat(W)}${right}`;
}

function row(content: string) {
  const visible = visualWidth(content);
  const pad = Math.max(0, W - 2 - visible);
  return `${BOX.v}  ${content}${" ".repeat(pad)}${BOX.v}`;
}

function divider() {
  return line(BOX.ml, BOX.mr);
}

function visualWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    // CJK + emoji ranges → width 2
    if (
      (cp >= 0x1100 && cp <= 0x11ff) ||
      (cp >= 0x2e80 && cp <= 0x9fff) ||
      (cp >= 0xac00 && cp <= 0xd7af) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0x1f000 && cp <= 0x1faff) ||
      (cp >= 0x20000 && cp <= 0x2fa1f)
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

function kv(label: string, value: string) {
  const gap = 16 - visualWidth(label);
  return row(`${label}${" ".repeat(Math.max(1, gap))}: ${value}`);
}

function severityIcon(sev: "critical" | "warning" | "info"): string {
  return sev === "critical" ? "🔴" : sev === "warning" ? "🟡" : "🔵";
}

function healthGrade(passed: number, total: number): { grade: string; icon: string } {
  if (total === 0) return { grade: "A+", icon: "💎" };
  const pct = (passed / total) * 100;
  if (pct === 100) return { grade: "A+", icon: "💎" };
  if (pct >= 80) return { grade: "A", icon: "🟢" };
  if (pct >= 60) return { grade: "B", icon: "🟡" };
  if (pct >= 40) return { grade: "C", icon: "🟠" };
  return { grade: "D", icon: "🔴" };
}

// ── Recommendations ──
const recommendations: Record<string, { en: string; ko: string }> = {
  "file-missing": {
    en: "Create the missing file to ensure proper AI agent behavior.",
    ko: "파일을 생성하여 AI 에이전트가 정상 동작하도록 하세요.",
  },
  "file-empty": {
    en: "Add meaningful content to the file.",
    ko: "파일에 유의미한 내용을 추가하세요.",
  },
  "file-invalid-json": {
    en: "Fix the JSON syntax error. Use a JSON validator.",
    ko: "JSON 구문 오류를 수정하세요. JSON 검증기를 사용해보세요.",
  },
  "file-missing-line": {
    en: "Add the required pattern to the file.",
    ko: "필수 패턴을 파일에 추가하세요.",
  },
  "file-contains": {
    en: "Remove the unwanted content from the file.",
    ko: "파일에서 비허용 콘텐츠를 제거하세요.",
  },
};

function getRecommendation(patternType: string, lang: "en" | "ko"): string {
  return recommendations[patternType]?.[lang] ?? (lang === "ko" ? "수동 확인이 필요합니다." : "Manual review required.");
}

// ── Patch Applier ──
function applyPatch(patch: PatchOp): boolean {
  const filePath = patch.path.replace(/^\//, "");
  if (patch.op === "add") {
    if (existsSync(filePath)) return false;
    const dir = dirname(filePath);
    if (dir !== ".") mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, patch.value ?? "", "utf-8");
    return true;
  }
  if (patch.op === "replace") {
    const dir = dirname(filePath);
    if (dir !== ".") mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, patch.value ?? "", "utf-8");
    return true;
  }
  return false;
}

// ── Main Command ──
export async function doctorCommand(opts: DoctorOptions) {
  const lang = getSystemLanguage();
  const m = msgs[lang];

  const rules = loadAllRules();
  const builtInCount = rules.filter(r => r.id.startsWith("IMM-")).length;
  const customCount = rules.length - builtInCount;

  // Evaluate all rules (raw mode — ignore antibody immunization for full picture)
  const result = evaluateRules(rules, [], { raw: true });
  const totalChecks = result.symptoms.length + result.healthy.length;
  const passedCount = result.healthy.length;
  const failedCount = result.symptoms.length;
  const { grade, icon } = healthGrade(passedCount, totalChecks);

  const output: string[] = [];
  output.push(line(BOX.tl, BOX.tr));
  output.push(row(`${m.title}`));
  output.push(divider());
  output.push(kv(m.ruleCount, `${rules.length} (${builtInCount} ${m.builtIn} + ${customCount} ${m.custom})`));
  output.push(kv(m.grade, `${icon} ${grade} (${passedCount}/${totalChecks})`));
  output.push(kv(m.passed, `✅ ${passedCount}`));
  output.push(kv(m.failed, `❌ ${failedCount}`));

  if (failedCount === 0) {
    output.push(divider());
    output.push(row(`✅ ${m.healthy}`));
    output.push(line(BOX.bl, BOX.br));
    console.log(output.join("\n"));
    return;
  }

  // ── Findings ──
  output.push(divider());
  output.push(row(`${m.findings}`));
  output.push(row("─".repeat(W - 4)));

  let fixableCount = 0;

  for (const symptom of result.symptoms) {
    const sevLabel = m.severity[symptom.severity];
    const hasPatches = symptom.patches.length > 0;
    if (hasPatches) fixableCount++;

    output.push(row(`${severityIcon(symptom.severity)} [${sevLabel}] ${symptom.id}: ${symptom.title}`));
    output.push(row(`  ${symptom.fileTarget}`));
    output.push(row(`  ${m.recommendation}: ${getRecommendation(symptom.patternType, lang)}`));
    if (hasPatches) output.push(row(`  🔧 ${m.fixable}`));
    output.push(row(""));
  }

  // ── Fix Mode ──
  if (opts.fix) {
    output.push(divider());
    let fixedCount = 0;
    for (const symptom of result.symptoms) {
      if (symptom.patches.length === 0) {
        output.push(row(`⏭️  ${symptom.id}: ${m.fixSkipped}`));
        continue;
      }
      let applied = false;
      for (const patch of symptom.patches) {
        if (applyPatch(patch)) applied = true;
      }
      if (applied) {
        output.push(row(`✅ ${symptom.id}: ${m.fixApplied}`));
        notifyAutoHeal(symptom.id);
        fixedCount++;
      } else {
        output.push(row(`⏭️  ${symptom.id}: ${m.fixSkipped}`));
      }
    }
    output.push(divider());
    output.push(row(`🩺 ${m.fixSummary}: ${fixedCount}/${failedCount}`));
  } else if (fixableCount > 0) {
    output.push(divider());
    output.push(row(`💡 ${m.fixHint.replace("{count}", String(fixableCount))}`));
  }

  output.push(line(BOX.bl, BOX.br));
  console.log(output.join("\n"));
}
