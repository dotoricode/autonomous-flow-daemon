'use strict';
const fs   = require('fs');
const path = require('path');

// Claude Code statusLine — stdin으로 session JSON 수신
// Manual run (TTY) or no piped data → default output without hanging

function render(data) {
  const model     = data.model?.display_name || '';
  const ctx       = data.context_window || {};
  const usedPct   = ctx.used_percentage;
  const ctxSize   = ctx.context_window_size || 200000;
  const usage     = ctx.current_usage || {};
  const totalUsed = (usage.input_tokens || 0)
                  + (usage.cache_read_input_tokens || 0)
                  + (usage.cache_creation_input_tokens || 0);

  const rate5h    = data.rate_limits?.five_hour?.used_percentage;

  // context 색상 아이콘
  let ctxIcon = '🟢';
  if      (usedPct >= 80) ctxIcon = '🔴';
  else if (usedPct >= 50) ctxIcon = '🟡';

  const parts = [];

  if (model) parts.push(model.replace(/\s*\([^)]*\)\s*/g, '').trim());

  if (usedPct != null) {
    parts.push(`${ctxIcon} ctx ${usedPct}%`);
  }

  if (rate5h !== undefined) {
    const rateIcon = rate5h >= 80 ? '⚠️ ' : '';
    parts.push(`${rateIcon}rate ${rate5h}%`);
  }

  function finish() {
    console.log(parts.length ? parts.join(' │ ') : 'Autonomous Flow Daemon');
    process.exit(0);
  }

  try {
    const portFile = path.resolve(__dirname, '..', '.afd', 'daemon.port');

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
        const sessionSavedK   = d.session_saved_tokens_k || 0;
        const sessionSavedRaw = sessionSavedK * 1000;
        const sessionPotential = totalUsed + sessionSavedRaw;
        const ctxSavePct = sessionPotential > 0 && sessionSavedRaw > 0
          ? Math.round(sessionSavedRaw / sessionPotential * 100)
          : 0;

        // flash: 8초 이내 방어 이벤트면 처방전 메시지 표시
        const ld = d.latest_defense;
        if (ld && ld.at && (Date.now() - ld.at) < 8000) {
          console.log(`[afd] 🛡️ ${ld.file} 손상 감지 | 🩹 ${ld.healMs}ms 만에 자가 복구 완료`);
          process.exit(0);
          return;
        }

        // 일반 요약: 방어 건수 + ctx/tok 절약률 — "🛡️ 3건 (ctx↓25% tok↓52%)"
        const defenseText  = d.total_defenses > 0 ? `${d.total_defenses}건` : 'ON';
        const ctxSavePct2  = ctxSize > 0 && sessionSavedRaw > 0
          ? Math.round(sessionSavedRaw / ctxSize * 100)
          : 0;
        const savingText = (ctxSavePct2 > 0 || ctxSavePct > 0)
          ? ` (ctx↓${ctxSavePct2}% tok↓${ctxSavePct}%)`
          : '';
        parts.push(`🛡️ ${defenseText}${savingText}`);
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
  let fired = false;
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
