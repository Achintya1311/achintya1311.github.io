/* StockStalker market board: every stock in the F&O universe as one cell, ordered and coloured by its last session's
   open-to-close move (the lab's xray.stocks[].m), the lab's picks ringed, and an inspector that says for any stock whether
   a rule picked it, where it ranked, or that no rule fired. Percentages, ranks and shapes only: no prices, no levels. */
(() => {
  const RAW = 'https://raw.githubusercontent.com/Achintya1311/stockstalker-lab/main/';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hue = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const pct = m => (m > 0 ? '+' : m < 0 ? '−' : '') + Math.abs(m).toFixed(2) + '%';
  const rule = s => String(s || '').replace(/@v\d+$/, '').replace(/_/g, ' ');

  // candles with the zone as a shaded band, from the lab's 0-100 scaled chart payload (shape only)
  function chart(c, side) {
    if (!c || !c.bars) return '';
    const W = 320, H = 120, bars = c.bars, n = bars.length, bw = W / n, y = v => (100 - v) / 100 * (H - 10) + 5, z = c.zone;
    const col = u => u ? 'var(--up)' : 'var(--down)';
    const zone = z && Number.isFinite(z.low) && Number.isFinite(z.high) ? `<rect x="${Math.max(0, Number(z.from) || 0) * bw}" y="${y(z.high)}" width="${W - Math.max(0, Number(z.from) || 0) * bw}" height="${Math.max(y(z.low) - y(z.high), 1)}" fill="${side === 'up' ? 'var(--up)' : 'var(--down)'}" opacity=".16"/>` : '';
    const body = bars.map(([o, hi, lo, cl], i) => { const x = i * bw + bw / 2, up = cl >= o; return `<line x1="${x}" x2="${x}" y1="${y(hi)}" y2="${y(lo)}" stroke="${col(up)}" stroke-width="1"/><rect x="${x - bw * .32}" y="${y(Math.max(o, cl))}" width="${bw * .64}" height="${Math.max(Math.abs(y(o) - y(cl)), 1)}" fill="${col(up)}"/>`; }).join('');
    return `<figure class="in-ch"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Candle shape of the last ${n} sessions, scaled 0 to 100, with the nearest order-block zone shaded">${zone}${body}</svg><figcaption>Shape of the last ${n} sessions. Shaded: nearest order-block zone. Chart structure only, not the reason for the pick. Not a level to act on.</figcaption></figure>`;
  }

  async function run() {
    const box = $('#cells'), insp = $('#insp');
    if (!box) return;
    const r = await window.deskLatest('day');
    if (!r || !r.data || !r.data.xray) { box.innerHTML = '<p class="note">The board needs the lab’s picks file, which could not be loaded. <a href="#picks">Open the Live lab</a>.</p>'; insp.innerHTML = ''; return; }
    const d = r.data, x = d.xray, st = x.stocks.map(s => ({ ...s }));
    // the move per stock joined the feed on 10 Nov 2026; for a session written before that, read it from the lab's rehearsal file of the same data day
    if (!st.some(s => typeof s.m === 'number')) {
      try { const j = await (await fetch(`${RAW}reports/live_dryrun/day/${encodeURIComponent(d.session)}.json`)).json();
        if (j.xray && j.xray.asof === x.asof) { const mm = {}; j.xray.stocks.forEach(s => mm[s.s] = s.m); st.forEach(s => { if (typeof mm[s.s] === 'number') s.m = mm[s.s]; }); } } catch {}
    }
    const hasM = st.some(s => typeof s.m === 'number');
    const picks = {}; ['bullish', 'bearish'].forEach(k => (d.tables[k] || []).forEach((p, i) => picks[p.symbol] = { pick: p, side: k === 'bullish' ? 'up' : 'dn', pos: i + 1 }));
    st.sort((a, b) => hasM ? ((b.m ?? -99) - (a.m ?? -99)) || a.s.localeCompare(b.s) : a.s.localeCompare(b.s));
    const cap = 3; // percent at which a cell reaches full colour
    let zero = false;
    box.innerHTML = st.map((s, i) => {
      const m = typeof s.m === 'number' ? s.m : null, q = picks[s.s], cls = m == null || m === 0 ? 'fl' : m > 0 ? 'up' : 'dn';
      const k = m == null ? 0 : Math.min(Math.abs(m) / cap, 1) * .8 + .12;
      let sep = ''; if (hasM && !zero && m != null && m < 0) { zero = true; sep = '<i class="zero" aria-hidden="true"><span>fell ▼</span></i>'; }
      return `${sep}<button type="button" class="c ${cls}${q ? ' pk ' + (q.side === 'up' ? 'pb' : 'pr') : ''}" data-i="${i}" style="--k:${k.toFixed(2)}" aria-label="${esc(s.s)}${m != null ? ', ' + pct(m) : ''}${q ? ', ' + (q.side === 'up' ? 'bullish' : 'bearish') + ' pick' : ''}"><b>${esc(s.s)}</b>${m != null ? `<small>${pct(m)}</small>` : ''}</button>`;
    }).join('') + (hasM ? '' : '<p class="note c-note">Per-stock moves join the board after the lab’s next end-of-day run; picks are ringed.</p>');

    const total = st.length;
    function show(s) {
      const q = picks[s.s], p = q && q.pick, m = typeof s.m === 'number' ? s.m : null;
      const state = p ? `<span class="in-st ${q.side}">${q.side === 'up' ? 'BULLISH' : 'BEARISH'} PICK #${q.pos}</span>` : '<span class="in-st no">NOT PICKED</span>';
      const why = p ? `${esc(rule(p.strategy))} · rank p${esc(q.side === 'up' ? s.b : s.d)}` : s.b != null || s.d != null ? 'Ranked, but outside the table' : 'Neither rule fired on this stock';
      const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
      insp.innerHTML = `<div class="in-h"><span class="logo" style="background:hsl(${hue(s.s)} 55% 62%)">${esc(s.s.slice(0, 2))}</span><div><b>${esc(s.s)}</b>${state}</div>${m != null ? `<span class="in-m ${m > 0 ? 'up' : m < 0 ? 'dn' : ''}">${pct(m)}<small>last session, open to close</small></span>` : ''}</div>
        <dl class="in-t">${row('Bullish rank', s.b != null ? 'p' + esc(s.b) : 'rule did not fire')}${row('Bearish rank', s.d != null ? 'p' + esc(s.d) : 'rule did not fire')}${row('Rule', why)}${row('Session', esc(d.session) + ' · data to ' + esc(x.asof))}</dl>
        ${p ? chart(p.chart, q.side) + `<p class="in-why">${esc(window.deskNoLevels ? window.deskNoLevels(p.reasoning || '') : '')}</p>` : `<p class="in-why">${s.b != null || s.d != null ? 'A rule scored this stock but others ranked higher, so it is not in the table.' : `Most stocks are not picked on most days: a rule has to fire first. ${total} stocks were checked for this session.`}</p>`}
        <a class="in-a" href="${p ? '#picks' : '#xray'}">${p ? 'Open the pick and its evidence →' : 'See every rank in Market X-Ray →'}</a>`;
      box.querySelectorAll('.c.on').forEach(e => e.classList.remove('on'));
      const el = box.querySelector(`.c[data-i="${st.indexOf(s)}"]`); if (el) el.classList.add('on');
    }
    const pickCell = e => { const b = e.target.closest('.c'); if (b) show(st[+b.dataset.i]); };
    box.addEventListener('click', pickCell); box.addEventListener('focusin', pickCell);
    if (matchMedia('(hover:hover)').matches) box.addEventListener('mouseover', pickCell);
    show(st.find(s => picks[s.s]) || st[0]);

    // live record: hits against the market's own base rate, straight from the lab's summary file
    try {
      const sm = await (await fetch(RAW + 'live/summary.json')).json(), L = sm.live || {}, names = { day_bullish: 'Day · bullish', day_bearish: 'Day · bearish', week_bullish: 'Week · bullish', week_bearish: 'Week · bearish' };
      const rows = Object.keys(names).filter(k => L[k] && L[k].n_scored).map(k => { const t = L[k], h = t.n_hits / t.n_scored * 100, b = t.market_line * 100;
        return `<tr><th scope="row">${names[k]}</th><td>${Number(t.n_hits)} of ${Number(t.n_scored)}</td><td class="${h > b ? 'up' : 'dn'}">${h.toFixed(0)}%</td><td>${b.toFixed(0)}%</td></tr>`; }).join('');
      if (rows) $('#rec').innerHTML = `<h2>Live record since 2 Nov 2026</h2><table><thead><tr><th scope="col">Table</th><th scope="col">Right way</th><th scope="col">Hit rate</th><th scope="col">Market's base rate</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Counts of picks that closed in the picked direction, set against how often any stock did. A few weeks of picks prove nothing yet; misses stay on the record. <a href="#picks">Every pick →</a></p>`;
    } catch {}
  }
  run();
})();
