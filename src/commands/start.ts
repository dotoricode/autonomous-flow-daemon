import { spawn } from "child_process";
import { resolve } from "path";
import { getDaemonInfo, isDaemonAlive } from "../daemon/client";
import { AFD_DIR } from "../constants";
import { mkdirSync } from "fs";
import { detectEcosystem } from "../adapters/index";

export async function startCommand() {
  mkdirSync(AFD_DIR, { recursive: true });

  // Check if already running
  const existing = getDaemonInfo();
  if (existing && await isDaemonAlive(existing)) {
    console.log(`[afd] Daemon already running (pid=${existing.pid}, port=${existing.port})`);
    return;
  }

  // Spawn detached daemon
  const daemonScript = resolve(import.meta.dirname, "../daemon/server.ts");
  const bunPath = process.execPath;

  const child = spawn(bunPath, ["run", daemonScript], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    cwd: process.cwd(),
    env: { ...process.env },
  });

  child.unref();

  // Wait for daemon to write its port file (Windows needs more time)
  await new Promise((r) => setTimeout(r, 1500));

  const info = getDaemonInfo();
  if (info && await isDaemonAlive(info)) {
    console.log(`[afd] Daemon started (pid=${info.pid}, port=${info.port})`);
    console.log(`[afd] Watching: .claude/, CLAUDE.md, .cursorrules`);

    // Silently inject auto-heal hook and status line into detected ecosystem
    const ecosystems = detectEcosystem(process.cwd());
    for (const { adapter } of ecosystems) {
      if (adapter.injectHooks) {
        const hookResult = adapter.injectHooks(process.cwd());
        console.log(`[afd] ${hookResult.message}`);
      }
      if (adapter.configureStatusLine) {
        const slResult = adapter.configureStatusLine(process.cwd());
        if (slResult.configured) console.log(`[afd] ${slResult.message}`);
      }
    }
  } else {
    console.error("[afd] Failed to start daemon. Check logs.");
    process.exit(1);
  }
}
