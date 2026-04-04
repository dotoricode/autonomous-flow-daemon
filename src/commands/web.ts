import { getDaemonInfo, isDaemonAlive } from "../daemon/client";
import { IS_WINDOWS, IS_MACOS } from "../platform";
import { exec } from "child_process";
import { getSystemLanguage } from "../core/locale";
import { getMessages, t } from "../core/i18n/messages";

export async function webCommand() {
  const msg = getMessages(getSystemLanguage());
  const info = getDaemonInfo();
  if (!info) {
    console.error(msg.DAEMON_NOT_RUNNING);
    process.exit(1);
  }

  const alive = await isDaemonAlive(info);
  if (!alive) {
    console.error(msg.DAEMON_NOT_RESPONDING);
    process.exit(1);
  }

  const url = `http://localhost:${info.port}/dashboard`;
  console.log(t(msg.WEB_OPENING, { url }));

  const cmd = IS_WINDOWS ? `start "" "${url}"`
    : IS_MACOS ? `open "${url}"`
    : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error(t(msg.WEB_BROWSER_FAILED, { url }));
    }
  });
}
