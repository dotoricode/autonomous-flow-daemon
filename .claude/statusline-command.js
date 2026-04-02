'use strict';
const fs   = require('fs');
const path = require('path');

// Claude Code statusLine — stdin으로 session JSON 수신
// Manual run (TTY) or no piped data → default output without hanging

function formatK(tokens) {
  if (tokens < 100) return '0k';
  return (tokens / 1000).toFixed(1) + 'k';
}

function render(data) {
  const model   = data.model?.display_name || '';
  const ctx     = data.context_window || {};
  const usedPct = ctx.used_percentage;
  const ctxSize = ctx.context_window_size || 200000;
  const usage   = ctx.current_usage || {};
  // 현재 컨텍스트에서 사용 중인 총 토큰 수
  // current_usage가 비어있으면 usedPct × ctxSize 로 추정
  const totalUsed = (usage.input_tokens || 0)
                  + (usage.cache_read_input_tokens || 0)
                  + (usage.cache_creation_input_tokens || 0)
                  || (usedPct != null ? Math.round(usedPct / 100 * ctxSize) : 0);

  // 컨텍스트 색상 아이콘
  let ctxIcon = '🟢';
  if      (usedPct >= 80) ctxIcon = '🔴';
  else if (usedPct >= 50) ctxIcon = '🟡';

  const parts = [];

  // 모델명: "(1M context)" 등 부가 설명 제거
  if (model) {
    parts.push(model.replace(/\s*\([^)]*\)\s*/g, '').trim());
  }

  const rate5h = data.rate_limits?.five_hour?.used_percentage;

  // 컨텍스트 사용량: "🟢 ctx 5% (46k)"
  if (usedPct != null) {
    const usedK = totalUsed > 0 ? ` (${formatK(totalUsed)})` : '';
    parts.push(`${ctxIcon} ctx ${usedPct}%${usedK}`);
  }

  // 5시간 rate limit
  if (rate5h != null) {
    const rateIcon = rate5h >= 80 ? '⚠️ ' : '';
    parts.push(`${rateIcon}rate ${rate5h}%`);
  }

  function finish() {
    console.log(parts.length ? parts.join(' │ ') : 'Autonomous Flow Daemon');
    process.exit(0);
  }

  try {
    const afdDir       = path.resolve(__dirname, '..', '.afd');
    const portFile     = path.join(afdDir, 'daemon.port');
    const pidFile      = path.join(afdDir, 'daemon.pid');
    const baselineFile = path.join(afdDir, 'session_baseline_tokens');

    if (!fs.existsSync(portFile)) {
      parts.push('🛡️ afd: OFF');
      finish();
      return;
    }

    const port = fs.readFileSync(portFile, 'utf-8').trim();

    fetch(`http://127.0.0.1:${port}/mini-status`, {
      signal: AbortSignal.timeout(200),
    })
      .then(r => r.json())
      .then(d => {
        // Flash: 8초 이내 방어 이벤트면 처방전 메시지 우선 표시
        const ld = d.latest_defense;
        if (ld && ld.at && (Date.now() - ld.at) < 8000) {
          console.log(`[afd] 🛡️ ${ld.file} 손상 감지 | 🩹 ${ld.healMs}ms 만에 자가 복구 완료`);
          process.exit(0);
          return;
        }

        // ── 세션 격리 계산 ──────────────────────────────────────
        // saved_tokens_k 가 없으면 절약 계산 스킵 (데몬 초기화 직후 등)
        const rawSavedK = d.saved_tokens_k;
        const currentTotalSaved = rawSavedK != null ? Math.round(rawSavedK * 1000) : null;

        // 현재 데몬 PID 읽기 (세션 변경 감지에 사용)
        let currentPid = null;
        try { currentPid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10) || null; } catch {}

        // 베이스라인 파일 읽기
        let baseline    = null;
        let baselinePid = null;
        try {
          const raw  = JSON.parse(fs.readFileSync(baselineFile, 'utf-8'));
          baseline    = typeof raw.baseline === 'number' ? raw.baseline : null;
          baselinePid = raw.pid;
        } catch {}

        // 베이스라인 초기화 조건:
        //   1) 파일이 없거나 손상됨 → 이번이 이 세션의 첫 실행
        //   2) 데몬 PID가 바뀜 → 데몬 재시작 = 새 세션
        //   단, currentTotalSaved 가 null 이면 아직 데이터 없음 → 초기화 안 함
        if (currentTotalSaved !== null &&
            (baseline === null || (currentPid !== null && baselinePid !== currentPid))) {
          baseline = currentTotalSaved;
          try {
            fs.writeFileSync(
              baselineFile,
              JSON.stringify({ baseline, pid: currentPid }),
              'utf-8'
            );
          } catch {}
        }

        // ── 정확한 절약률 계산 ──────────────────────────────────
        const defenseLabel = d.total_defenses > 0 ? `${d.total_defenses}건` : 'ON';

        if (currentTotalSaved !== null && baseline !== null) {
          // session_saved = 현재 세션에서 afd가 절약한 토큰
          const sessionSaved    = Math.max(0, currentTotalSaved - baseline);
          const sessionPotential = totalUsed + sessionSaved;
          const savingRate = (sessionPotential > 0 && sessionSaved > 0)
            ? Math.round(sessionSaved / sessionPotential * 100)
            : 0;
          const savingText = `(↓ ${formatK(sessionSaved)} 절약, ctx -${savingRate}%)`;
          parts.push(`🛡️ afd: ${defenseLabel} ${savingText}`);
        } else {
          parts.push(`🛡️ afd: ${defenseLabel}`);
        }
        finish();
      })
      .catch(() => {
        parts.push('🛡️ afd: OFF');
        finish();
      });
  } catch {
    parts.push('🛡️ afd: OFF');
    finish();
  }
}

// Short-circuit: TTY means manual run → no stdin data expected
if (process.stdin.isTTY) {
  render({});
} else {
  // Piped mode: read stdin but bail after 100ms if nothing arrives
  let fired  = false;
  const chunks = [];

  const timer = setTimeout(() => {
    if (!fired) {
      fired = true;
      process.stdin.destroy();
      render({});
    }
  }, 100);

  process.stdin.on('data', c => chunks.push(c));
  process.stdin.on('end', () => {
    if (fired) return;
    fired = true;
    clearTimeout(timer);
    let data = {};
    try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch {}
    render(data);
  });
}
