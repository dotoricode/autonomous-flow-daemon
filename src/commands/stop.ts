import { getDaemonInfo, isDaemonAlive, daemonRequest } from "../daemon/client";
import { unlinkSync } from "fs";
import { PID_FILE, PORT_FILE } from "../constants";

function cleanupFiles() {
  try { unlinkSync(PID_FILE); } catch {}
  try { unlinkSync(PORT_FILE); } catch {}
}

export async function stopCommand() {
  const info = getDaemonInfo();
  if (!info) {
    console.log("[afd] No daemon running.");
    return;
  }

  if (await isDaemonAlive(info)) {
    try {
      await daemonRequest("/stop");
      console.log(`[afd] Daemon stopped (pid=${info.pid})`);
    } catch {
      // Force kill if graceful stop fails
      try {
        process.kill(info.pid, "SIGTERM");
        console.log(`[afd] Daemon killed (pid=${info.pid})`);
      } catch {
        console.log("[afd] Daemon process already gone.");
      }
    }
  } else {
    console.log("[afd] Daemon not responding. Cleaning up stale PID files.");
  }

  cleanupFiles();
}
