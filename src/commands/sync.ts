import { readFileSync } from "fs";
import { resolve } from "path";
import { daemonRequest } from "../daemon/client";
import { AFD_DIR } from "../constants";

interface SyncResponse {
  status: string;
  path: string;
  count: number;
}

export async function syncCommand() {
  let result: SyncResponse;
  try {
    result = await daemonRequest<SyncResponse>("/sync");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[afd sync] ${msg}`);
    process.exit(1);
  }

  if (result.count === 0) {
    console.log("[afd sync] No antibodies to export. Run `afd fix` first to learn patterns.");
    return;
  }

  // Read the generated payload for display
  const payloadPath = resolve(AFD_DIR, "global-vaccine-payload.json");
  const payload = JSON.parse(readFileSync(payloadPath, "utf-8"));

  const box = "\u2500".repeat(46);
  console.log(`\u250C${box}\u2510`);
  console.log(`\u2502  afd sync \u2014 Vaccine Network                    \u2502`);
  console.log(`\u251C${box}\u2524`);
  console.log(`\u2502  Ecosystem  : ${payload.ecosystem.padEnd(31)}\u2502`);
  console.log(`\u2502  Antibodies : ${String(payload.antibodyCount).padEnd(31)}\u2502`);
  console.log(`\u2502  Generated  : ${payload.generatedAt.substring(0, 19).padEnd(31)}\u2502`);
  console.log(`\u251C${box}\u2524`);

  for (const ab of payload.antibodies) {
    const patches = ab.patches.map((p: { op: string; path: string }) => `${p.op} ${p.path}`).join(", ");
    console.log(`\u2502  [${ab.id}] ${ab.patternType.padEnd(20)} ${patches.substring(0, 12).padEnd(12)}\u2502`);
  }

  console.log(`\u251C${box}\u2524`);
  console.log(`\u2502  Payload: .afd/global-vaccine-payload.json     \u2502`);
  console.log(`\u2514${box}\u2518`);
  console.log();
  console.log(`[afd sync] Vaccine payload generated. ${result.count} antibody(ies) ready for global federation.`);
}
