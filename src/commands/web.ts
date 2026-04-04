import { getDaemonInfo, isDaemonAlive } from "../daemon/client";
import { IS_WINDOWS, IS_MACOS } from "../platform";
import { exec } from "child_process";

export async function webCommand() {
  const info = getDaemonInfo();
  if (!info) {
    console.error("[afd] 데몬이 실행 중이 아닙니다. `afd start`를 먼저 실행하세요.");
    process.exit(1);
  }

  const alive = await isDaemonAlive(info);
  if (!alive) {
    console.error("[afd] 데몬 프로세스가 응답하지 않습니다. `afd start --restart`를 시도하세요.");
    process.exit(1);
  }

  const url = `http://localhost:${info.port}/dashboard`;
  console.log(`[afd] 대시보드 열기: ${url}`);

  const cmd = IS_WINDOWS ? `start "" "${url}"`
    : IS_MACOS ? `open "${url}"`
    : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error(`[afd] 브라우저 오픈 실패 — 직접 열어주세요: ${url}`);
    }
  });
}
