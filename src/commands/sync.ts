import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { daemonRequest } from "../daemon/client";
import { AFD_DIR } from "../constants";
import { getSystemLanguage } from "../core/locale";

interface SyncResponse {
  status: string;
  path: string;
  count: number;
}

interface VaccinePayload {
  version: string;
  generatedAt: string;
  ecosystem: string;
  antibodyCount: number;
  antibodies: VaccineAntibody[];
}

interface VaccineAntibody {
  id: string;
  patternType: string;
  fileTarget: string;
  patches: { op: string; path: string; value?: string }[];
  learnedAt: string;
}

interface SyncOptions {
  push?: boolean;
  pull?: boolean;
  remote?: string;
}

const msgs = {
  en: {
    title: "afd sync — Vaccine Network",
    ecosystem: "Ecosystem",
    antibodies: "Antibodies",
    generated: "Generated",
    payload: "Payload",
    noAntibodies: "No antibodies to export. Run `afd fix` first.",
    exported: "Vaccine payload generated.",
    pushTitle: "afd sync --push",
    pushSuccess: "Pushed to team vaccine store",
    pushCreated: "Created team vaccine store",
    pullTitle: "afd sync --pull",
    pullSuccess: "Pulled from team vaccine store",
    pullMerged: "merged",
    pullNew: "new",
    pullSkipped: "skipped (already known)",
    pullNoStore: "No team vaccine store found.",
    pullHint: "Run `afd sync --push` first to create the shared store.",
    learnedVia: "Learned via pull",
    ready: "antibody(ies) ready for global federation.",
  },
  ko: {
    title: "afd sync — 백신 네트워크",
    ecosystem: "에코시스템",
    antibodies: "항체",
    generated: "생성일",
    payload: "페이로드",
    noAntibodies: "내보낼 항체가 없습니다. `afd fix`를 먼저 실행하세요.",
    exported: "백신 페이로드 생성 완료.",
    pushTitle: "afd sync --push",
    pushSuccess: "팀 백신 저장소에 푸시 완료",
    pushCreated: "팀 백신 저장소 생성",
    pullTitle: "afd sync --pull",
    pullSuccess: "팀 백신 저장소에서 풀 완료",
    pullMerged: "병합됨",
    pullNew: "신규",
    pullSkipped: "건너뜀 (이미 존재)",
    pullNoStore: "팀 백신 저장소를 찾을 수 없습니다.",
    pullHint: "`afd sync --push`를 먼저 실행하여 공유 저장소를 생성하세요.",
    learnedVia: "풀로 학습됨",
    ready: "개 항체가 글로벌 페더레이션 준비 완료.",
  },
};

const TEAM_STORE_DIR = join(AFD_DIR, "team-vaccines");
const TEAM_PAYLOAD_FILE = join(TEAM_STORE_DIR, "shared-vaccine-payload.json");

export async function syncCommand(opts: SyncOptions = {}) {
  const lang = getSystemLanguage();
  const m = msgs[lang];

  if (opts.push) {
    await syncPush(m);
    return;
  }

  if (opts.pull) {
    await syncPull(m);
    return;
  }

  // Default: export local payload (original behavior)
  await syncExport(m);
}

async function syncExport(m: typeof msgs.en) {
  let result: SyncResponse;
  try {
    result = await daemonRequest<SyncResponse>("/sync");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[afd sync] ${msg}`);
    process.exit(1);
  }

  if (result.count === 0) {
    console.log(`[afd sync] ${m.noAntibodies}`);
    return;
  }

  const payloadPath = resolve(AFD_DIR, "global-vaccine-payload.json");
  const payload = JSON.parse(readFileSync(payloadPath, "utf-8"));
  renderPayloadBox(payload, m);
  console.log(`\n[afd sync] ${m.exported} ${result.count} ${m.ready}`);
}

async function syncPush(m: typeof msgs.en) {
  // First, export latest payload
  let result: SyncResponse;
  try {
    result = await daemonRequest<SyncResponse>("/sync");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[afd sync] ${msg}`);
    process.exit(1);
  }

  if (result.count === 0) {
    console.log(`[afd sync] ${m.noAntibodies}`);
    return;
  }

  // Copy to team store
  const localPayloadPath = resolve(AFD_DIR, "global-vaccine-payload.json");
  const localPayload = readFileSync(localPayloadPath, "utf-8");

  mkdirSync(TEAM_STORE_DIR, { recursive: true });

  // Merge with existing team payload if present
  let teamPayload: VaccinePayload;
  if (existsSync(TEAM_PAYLOAD_FILE)) {
    try {
      teamPayload = JSON.parse(readFileSync(TEAM_PAYLOAD_FILE, "utf-8"));
    } catch {
      teamPayload = JSON.parse(localPayload);
    }
    // Merge: add new antibodies, update existing ones
    const newPayload = JSON.parse(localPayload) as VaccinePayload;
    const existingIds = new Set(teamPayload.antibodies.map(a => a.id));
    for (const ab of newPayload.antibodies) {
      if (existingIds.has(ab.id)) {
        // Update existing
        const idx = teamPayload.antibodies.findIndex(a => a.id === ab.id);
        if (idx >= 0) teamPayload.antibodies[idx] = ab;
      } else {
        teamPayload.antibodies.push(ab);
      }
    }
    teamPayload.antibodyCount = teamPayload.antibodies.length;
    teamPayload.generatedAt = new Date().toISOString();
  } else {
    teamPayload = JSON.parse(localPayload);
    console.log(`[afd sync] ${m.pushCreated}`);
  }

  writeFileSync(TEAM_PAYLOAD_FILE, JSON.stringify(teamPayload, null, 2), "utf-8");

  const BOX = { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│", ml: "├", mr: "┤" };
  const W = 50;
  const line = (l: string, r: string) => `${l}${BOX.h.repeat(W)}${r}`;
  const row = (s: string) => `${BOX.v}  ${s}${" ".repeat(Math.max(0, W - 2 - s.length))}${BOX.v}`;

  console.log(line(BOX.tl, BOX.tr));
  console.log(row(`📤 ${m.pushTitle}`));
  console.log(line(BOX.ml, BOX.mr));
  console.log(row(`${m.antibodies}: ${teamPayload.antibodyCount}`));
  console.log(row(`${m.payload}: ${TEAM_PAYLOAD_FILE}`));
  console.log(line(BOX.ml, BOX.mr));
  console.log(row(`✅ ${m.pushSuccess}`));
  console.log(line(BOX.bl, BOX.br));
}

async function syncPull(m: typeof msgs.en) {
  if (!existsSync(TEAM_PAYLOAD_FILE)) {
    console.log(`[afd sync] ${m.pullNoStore}`);
    console.log(`[afd sync] ${m.pullHint}`);
    return;
  }

  let teamPayload: VaccinePayload;
  try {
    teamPayload = JSON.parse(readFileSync(TEAM_PAYLOAD_FILE, "utf-8"));
  } catch {
    console.error("[afd sync] Failed to parse team vaccine payload.");
    process.exit(1);
  }

  // Learn each antibody into the daemon
  let newCount = 0;
  let skippedCount = 0;
  const results: { id: string; status: string }[] = [];

  for (const ab of teamPayload.antibodies) {
    try {
      // Try to learn via daemon API
      const res = await fetch(`http://127.0.0.1:${getDaemonPort()}/antibodies/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ab.id,
          patternType: ab.patternType,
          fileTarget: ab.fileTarget,
          patches: ab.patches,
        }),
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        results.push({ id: ab.id, status: m.pullNew });
        newCount++;
      } else {
        results.push({ id: ab.id, status: m.pullSkipped });
        skippedCount++;
      }
    } catch {
      results.push({ id: ab.id, status: m.pullSkipped });
      skippedCount++;
    }
  }

  const BOX = { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│", ml: "├", mr: "┤" };
  const W = 50;
  const line = (l: string, r: string) => `${l}${BOX.h.repeat(W)}${r}`;
  const row = (s: string) => `${BOX.v}  ${s}${" ".repeat(Math.max(0, W - 2 - s.length))}${BOX.v}`;

  console.log(line(BOX.tl, BOX.tr));
  console.log(row(`📥 ${m.pullTitle}`));
  console.log(line(BOX.ml, BOX.mr));

  for (const r of results) {
    const icon = r.status === m.pullNew ? "✅" : "⏭️";
    console.log(row(`${icon} ${r.id}: ${r.status}`));
  }

  console.log(line(BOX.ml, BOX.mr));
  console.log(row(`✅ ${m.pullSuccess}: ${newCount} ${m.pullMerged}`));
  console.log(line(BOX.bl, BOX.br));
}

function getDaemonPort(): number {
  const { getDaemonInfo } = require("../daemon/client");
  const info = getDaemonInfo();
  if (!info) throw new Error("Daemon not running");
  return info.port;
}

function renderPayloadBox(payload: VaccinePayload, m: typeof msgs.en) {
  const BOX = { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│", ml: "├", mr: "┤" };
  const W = 48;
  const line = (l: string, r: string) => `${l}${BOX.h.repeat(W)}${r}`;
  const row = (s: string) => `${BOX.v}  ${s}${" ".repeat(Math.max(0, W - 2 - s.length))}${BOX.v}`;

  console.log(line(BOX.tl, BOX.tr));
  console.log(row(`${m.title}`));
  console.log(line(BOX.ml, BOX.mr));
  console.log(row(`${m.ecosystem}  : ${payload.ecosystem}`));
  console.log(row(`${m.antibodies} : ${payload.antibodyCount}`));
  console.log(row(`${m.generated}  : ${payload.generatedAt.substring(0, 19)}`));
  console.log(line(BOX.ml, BOX.mr));

  for (const ab of payload.antibodies) {
    const patches = ab.patches.map(p => `${p.op} ${p.path}`).join(", ");
    console.log(row(`[${ab.id}] ${ab.patternType.padEnd(18)} ${patches.substring(0, 14)}`));
  }

  console.log(line(BOX.ml, BOX.mr));
  console.log(row(`${m.payload}: .afd/global-vaccine-payload.json`));
  console.log(line(BOX.bl, BOX.br));
}
