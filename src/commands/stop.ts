import { getDaemonInfo, isDaemonAlive, daemonRequest } from "../daemon/client";
import { unlinkSync } from "fs";
import { PID_FILE, PORT_FILE } from "../constants";
import { formatShiftSummary } from "../core/boast";
import type { ShiftSummary } from "../core/boast";
import { getSystemLanguage } from "../core/locale";
import { getMessages, t } from "../core/i18n/messages";

function cleanupFiles() {
  try { unlinkSync(PID_FILE); } catch {}
  try { unlinkSync(PORT_FILE); } catch {}
}

export async function stopCommand() {
  const lang = getSystemLanguage();
  const msg = getMessages(lang);
  const info = getDaemonInfo();

  if (!info) {
    console.log(msg.DAEMON_NOT_RUNNING);
    return;
  }

  if (await isDaemonAlive(info)) {
    // Fetch shift summary before stopping
    try {
      const summary = await daemonRequest<ShiftSummary>("/shift-summary");
      console.log(formatShiftSummary(summary, lang));
    } catch {
      // Non-fatal: summary is a nicety, not a requirement
    }

    try {
      await daemonRequest("/stop");
      console.log(t(msg.DAEMON_STOPPED, { pid: info.pid }));
    } catch {
      try {
        process.kill(info.pid, "SIGTERM");
        console.log(t(msg.DAEMON_KILLED, { pid: info.pid }));
      } catch {
        console.log("[afd] Daemon process already gone.");
      }
    }
  } else {
    console.log(msg.DAEMON_NOT_RESPONDING);
  }

  cleanupFiles();
}
