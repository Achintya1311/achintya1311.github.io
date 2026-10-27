/* Evidence and Market X-Ray views. Reads two small JSON files the lab publishes; draws everything as SVG/HTML.
   Edge numbers are percentage points of hit rate over the market's own base rate (train split 2015-2020). */
(() => {
  const REPO = 'Achintya1311/stockstalker-lab', RAW = `https://raw.githubusercontent.com/${REPO}/main/`;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const J = async u => { const r = await fetch(u); if (!r.ok) throw new Error(u); return r.json(); };
  const pts = x => (x * 100);
  const fmt = x => (x >= 0 ? '+' : '') + pts(x).toFixed(2);

  // ---------- data ----------
  let evP = null;
  window.deskEvLoad = () => (evP = evP || J(RAW + 'reports/evidence_train.json').then(ev => Object.fromEntries(Object.entries(ev).filter(([k, v]) => /^(day|week)\/(bullish|bearish)$/.test(k) && v && v.experiments && v.joint && Array.isArray(v.joint.stepm)))).catch(() => null));
  const latestP = {};
  const latest = h => (latestP[h] = latestP[h] || (async () => {
    for (const base of ['live', 'reports/live_dryrun']) {
      try {
        const list = await J(`https://api.github.com/repos/${REPO}/contents/${base}/${h}`);
        const names = list.map(f => f.name).filter(n => n.endsWith('.json')).sort();
        if (names.length) return { dry: base !== 'live', data: await J(`${RAW}${base}/${h}/${names[names.length - 1]}`) };
      } catch {}
    }
    return null;
  })());

  window.deskLatest = latest;

  // ---------- naming ----------
  const family = id => /^(o0)/.test(id) ? 'ob' : /^(e1|e2|d01c)/.test(id) ? 'conf' : /^d01-/.test(id) ? 'oi' : 'rule';
  const pretty = id => id.replace(/-(day|week)$/, '').replace(/^([a-z]\d+[a-z]?)-?/, (m, a) => a.toUpperCase() + ' ').replace(/-/g, ' ').trim();

  // lookup used by the ranked boards: which train replay stands behind a pick's strategy?
  window.deskEv = (ev, strategy, horizon, side) => {
    const g = ev && ev[`${horizon}/${side}`];
    if (!g) return null;
    const base = String(strategy).split('@')[0].replace(/_/g, '-');
    const code = base.split('-')[0];   // strategy modules and experiment ids share a leading code, e.g. o01, a02
    const id = Object.keys(g.experiments).find(k => k === `${base}-${horizon}` || k.startsWith(base + '-') || (/^[a-z]\d+[a-z]?$/.test(code) && k.startsWith(code + '-')));
    if (!id) return null;
    const e = g.experiments[id];
    return { id, ...e, superior: g.joint.stepm.includes(id), spa: g.joint.spa.consistent };
  };

  // ---------- Evidence view ----------
  const ABLATION = {
    day: ['a02-extreme-day-reversal-day', 'o00-placebo-day', 'o01-retest-day', 'o02-oi-confirmed-day', 'o03-trend-confirmed-day', 'o04-order-block-composite-day', 'o04a-no-volume-day', 'o04b-no-d01-day', 'd01-oi-buildup-day', 'd01c-day', 'e1a-day', 'e1b-day', 'e2a-day', 'e2b-day'],
    week: ['o00-placebo-week', 'o01-retest-week', 'o03-trend-confirmed-week', 'o04-order-block-composite-week', 'o04a-no-volume-week', 'o04b-no-d01-week', 'o05-order-block-weekly-week'],
  };
  const NOTE = {
    'a02-extreme-day-reversal-day': 'the base signal that already works',
    'o00-placebo-day': 'placebo: last opposite candle, no impulse',
    'o00-placebo-week': 'placebo: last opposite candle, no impulse',
    'o01-retest-day': 'order block: impulse, then retest',
    'o01-retest-week': 'order block: impulse, then retest',
    'o02-oi-confirmed-day': 'order block + open interest agrees',
    'o03-trend-confirmed-day': 'order block + trend agrees',
    'o03-trend-confirmed-week': 'order block + trend agrees',
    'o04-order-block-composite-day': 'order block, ranked by zone closeness, open interest and volume together',
    'o04-order-block-composite-week': 'order block, ranked by zone closeness, open interest and volume together',
    'o04a-no-volume-day': 'the same ranking without the volume part',
    'o04a-no-volume-week': 'the same ranking without the volume part',
    'o04b-no-d01-day': 'the same ranking without the open-interest part',
    'o04b-no-d01-week': 'the same ranking without the open-interest part',
    'o05-order-block-weekly-week': 'order block found on weekly bars instead of daily',
    'd01-oi-buildup-day': 'open interest as continuation',
    'd01c-day': 'open interest as reversal (the flipped sign)',
    'e1a-day': 'A02 where an order-block zone agrees',
    'e1b-day': 'A02 where no zone agrees',
    'e2a-day': 'A02 on a crowded move (OI rose)',
    'e2b-day': 'A02 on a position-closing move (OI fell)',
  };

  function forest(rows, joint) {
    const W = 760, L = 250, R = 70, RH = 22, top = 24, H = top + rows.length * RH + 30;
    const lo = Math.max(-10, Math.min(-4, ...rows.map(r => pts(r.lo)))) - 0.5, hi = Math.min(10, Math.max(4, ...rows.map(r => pts(r.hi)))) + 0.5;
    const x = v => L + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (W - L - R);
    let s = `<p class="hint">Swipe or scroll sideways: row names are on the left, intervals on the right.</p><div class="scroll" tabindex="0" role="region" aria-label="Edge chart, scrolls sideways"><svg class="ch wide" viewBox="0 0 ${W} ${H}" role="img" aria-label="Edge over the market base rate with 95% intervals, one row per experiment">`;
    for (let t = Math.ceil(lo / 2) * 2; t <= hi; t += 2) s += `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 6}" y2="${H - 24}" stroke="currentColor" opacity="${t === 0 ? .55 : .12}"/><text x="${x(t)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".6">${t > 0 ? '+' : ''}${t}</text>`;
    rows.forEach((r, i) => {
      const y = top + i * RH + 9, sup = joint.stepm.includes(r.id), neg = r.hi < 0, fam = family(r.id);
      const col = sup ? 'var(--up)' : neg ? 'var(--down)' : fam === 'ob' || fam === 'conf' ? 'var(--amber)' : 'var(--muted)';
      s += `<text x="${L - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="currentColor"${sup ? ' font-weight="600"' : ''}>${esc(pretty(r.id))}</text>`;
      s += `<line x1="${x(pts(r.lo))}" x2="${x(pts(r.hi))}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="2.2"/><circle cx="${x(pts(r.mean))}" cy="${y}" r="4" fill="${col}"/>`;
      s += `<text x="${W - R + 8}" y="${y + 4}" font-size="11" class="num" fill="currentColor">${fmt(r.mean)}</text>`;
    });
    return s + '</svg></div>';
  }

  window.deskForest = forest; window.deskFamily = family; window.deskPretty = pretty;

  // a bootstrap p-value is never exactly zero: print '< 0.001' below the grid
  const pf = v => v < 0.001 ? '< 0.001' : '= ' + v.toFixed(3);

  function verdict(g) {
    const n = g.joint.stepm.length, ps = pf(g.joint.spa.consistent);
    if (n && g.joint.spa.consistent >= 0.05) return `<b>Mixed.</b> Of ${g.joint.n_models} variants tried, ${n} ${n === 1 ? 'passes' : 'pass'} the one-by-one check after correcting for how many were tried, but the all-variants joint test cannot rule out luck (p ${ps}). Treat ${n === 1 ? 'it' : 'them'} as unconfirmed.`;
    if (n) return `<b class="g">Some variants survive.</b> Across all ${g.joint.n_models} variants tried, the joint test gives p ${ps}, and ${n} ${n === 1 ? 'variant is' : 'variants are'} individually superior after correcting for how many were tried.`;
    if (g.joint.spa.consistent >= 0.05) return `<b class="r">Nothing survives.</b> Across ${g.joint.n_models} variants the joint test gives p ${ps}, so luck cannot be ruled out as the source of the best-looking results.`;
    return `<b class="r">Nothing survives.</b> Across ${g.joint.n_models} variants the joint test gives p ${ps}: the best-looking results here are what luck produces when this many are tried.`;
  }

  function drawEvidence(ev, key) {
    const g = ev[key], [hz, side] = key.split('/');
    const rows = Object.entries(g.experiments).map(([id, e]) => ({ id, ...e })).sort((a, b) => b.mean - a.mean);
    const abl = (ABLATION[hz] || []).map(id => {
      const e = g.experiments[id];
      if (!e) return `<tr><td>${esc(pretty(id))}<small>${esc(NOTE[id] || '')}</small></td><td colspan="3" class="muted">replay pending</td></tr>`;
      const beats = e.lo > 0, bad = e.hi < 0;
      return `<tr><td>${esc(pretty(id))}<small>${esc(NOTE[id] || '')}</small></td><td class="num">${fmt(e.mean)}</td><td class="num">${fmt(e.lo)} to ${fmt(e.hi)}</td><td class="${beats ? 'g' : bad ? 'r' : 'muted'}">${beats ? 'beats the market line' : bad ? 'loses to it' : 'not distinguishable from zero'}</td></tr>`;
    }).join('');
    const ob = rows.filter(r => (family(r.id) === 'ob' && !r.id.startsWith('o00')) || r.id.startsWith('e1a'));
    const obVerdict = ob.length && ob.every(r => r.lo <= 0)
      ? `No order-block variant has an interval above zero (${ob.length} tested here, placebo excluded). Order blocks, as built so far, do not beat the market line on their own.`
      : ob.length ? 'At least one order-block variant has an interval above zero here; it still needs validation on unseen years.' : 'No order-block replay is in this group yet.';
    $('#ev-body').innerHTML = `
      <div class="panel"><h2>${hz} horizon, ${side} picks</h2><p>${verdict(g)}</p>
        <p class="note">In plain words: if none of the ${g.joint.n_models} variants had a real edge, a best result at least this good would turn up by chance with p ${pf(g.joint.spa.consistent)} (Hansen SPA; its looser and stricter versions give p ${pf(g.joint.spa.lower)} and p ${pf(g.joint.spa.upper)}). The model confidence set keeps ${g.joint.mcs.length} of ${g.joint.n_models} variants as not clearly worse than the best. Days are resampled ${g.joint.block > 1 ? `in blocks of ${g.joint.block} so days that move together stay together` : 'one at a time (block length 1)'}.${Object.entries(g.joint.twins || {}).map(([a, b]) => ` ${esc(pretty(a))} makes the same picks as ${esc(pretty(b))}, so the joint tests count them once.`).join('')}</p></div>
      <div class="panel"><h2>Edge over the market base rate, 95% interval</h2>${forest(rows, g.joint)}
        <p class="note"><span class="g">Green</span> survives the correction for many trials. <span style="color:var(--amber)">Amber</span> is an order-block or confluence variant. <span class="r">Red</span> loses to the market line with an interval entirely below zero. Grey is not distinguishable from zero.</p></div>
      <div class="panel"><h2>Do order blocks help? The ablation</h2><p>${esc(obVerdict)}</p>
        <div class="scroll" tabindex="0" role="region" aria-label="Strategy table, scrolls sideways"><table class="t ab"><thead><tr><th>Strategy</th><th>Edge (pts)</th><th>95% interval</th><th>Verdict</th></tr></thead><tbody>${abl}</tbody></table></div>
        <p class="note">Read the rows in pairs. O00 against O01 shows what the impulse requirement adds; O04, O04A and O04B differ only in which ingredient is left out. Other rows use different base signals, so they are context, not a one-change comparison. The placebo uses the same zone logic with the impulse requirement removed.</p></div>`;
  }

  async function evidenceView() {
    const ev = await window.deskEvLoad();
    if (!ev) { $('#ev-body').innerHTML = `<div class="empty">Could not load the lab's evidence file right now. <a href="https://github.com/${REPO}/blob/main/reports/evidence_train.md">Read it on GitHub</a>.</div>`; return; }
    const keys = Object.keys(ev).sort();
    if (!keys.length) { $('#ev-body').innerHTML = `<div class="empty">The lab's evidence file has no results in the shape this page reads. <a href="https://github.com/${REPO}/blob/main/reports/evidence_train.md">Read it on GitHub</a>.</div>`; return; }
    const surv = keys.reduce((n, k) => n + ev[k].joint.stepm.length, 0), total = keys.reduce((n, k) => n + Object.keys(ev[k].experiments).length, 0);
    const obN = new Set(keys.flatMap(k => Object.keys(ev[k].experiments)).filter(i => family(i) === 'ob' && !i.startsWith('o00')).map(i => i.replace(/-(day|week)$/, ''))).size;
    const weekNone = keys.filter(k => k.startsWith('week')).every(k => ev[k].joint.stepm.length === 0);
    // the Limits paragraph states the weekly result from the file, never a hard-coded 'none'
    const wk = keys.filter(k => k.startsWith('week')), wn = wk.reduce((n, k) => n + ev[k].joint.stepm.length, 0);
    const wp = Math.min(...wk.map(k => ev[k].joint.spa.consistent));
    const wConf = wk.some(k => ev[k].joint.stepm.length && ev[k].joint.spa.consistent < 0.05);
    const wl = $('#ev-weekline');
    if (wl) wl.textContent = !wn ? `Among the weekly variants in the lab's evidence file, none survives; the weekly joint tests give p ${pf(wp)} at best.`
      : `Among the weekly variants in the lab's evidence file, ${wn} ${wn === 1 ? 'passes' : 'pass'} the one-by-one check` + (wp >= 0.05 ? `, but no weekly joint test is below 0.05 (p ${pf(wp)}), so this is weak evidence.` : '.');
    $('#ev-sum').innerHTML = `<div class="stat"><b>${total}</b><span>strategy results tested</span></div><div class="stat"><b>${surv}</b><span>survive the many-trials correction</span></div><div class="stat"><b>${weekNone ? 'none' : wConf ? 'some' : wn + ' unconfirmed'}</b><span>at the weekly horizon</span></div><div class="stat"><b>${obN}</b><span>distinct order-block variants tested (placebo excluded)</span></div>`;
    $('#ev-chips').innerHTML = keys.map((k, i) => `<button class="chip" data-k="${k}" aria-pressed="${i === 0}">${k.replace('/', ' · ')}</button>`).join('');
    $('#ev-chips').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; [...$('#ev-chips').children].forEach(c => c.setAttribute('aria-pressed', c === b)); drawEvidence(ev, b.dataset.k); };
    drawEvidence(ev, keys[0]);
  }

  // ---------- Market X-Ray ----------
  function histogram(b) {
    const W = 560, H = 120, n = b.counts.length, bw = W / n, mx = Math.max(...b.counts, 1), mid = b.edges_pct.indexOf(0) + 1;
    const bars = b.counts.map((c, i) => `<rect x="${i * bw + 1}" y="${H - 16 - c / mx * (H - 26)}" width="${bw - 2}" height="${c / mx * (H - 26)}" fill="${i < mid ? 'var(--down)' : 'var(--up)'}" opacity=".85"><title>${c} stocks</title></rect>`).join('');
    return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribution of the last session's open-to-close moves across the universe">${bars}<line x1="${mid * bw}" x2="${mid * bw}" y1="4" y2="${H - 16}" stroke="currentColor" opacity=".5"/><text x="2" y="${H - 3}" font-size="10" fill="currentColor" opacity=".6">down more than 4%</text><text x="${W - 2}" y="${H - 3}" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">up more than 4%</text></svg>`;
  }

  async function xrayView() {
    const r = await latest('day');
    if (!r || !r.data.xray) { $('#xr-body').innerHTML = '<div class="empty">The lab has not published an X-Ray for the next session yet.</div>'; return; }
    const x = r.data.xray, b = x.breadth;
    $('#xr-sub').textContent = `Session ${r.data.session}${r.dry ? ' (dry run: the lab has not gone live yet)' : ''} · data as of ${x.asof} · ${x.n} stocks in the universe`;
    const score = s => Math.max(s.b ?? -1, s.d ?? -1), side = s => (s.b ?? -1) >= (s.d ?? -1) ? 'b' : 'd';
    const bull = x.stocks.filter(s => s.b != null && side(s) === 'b').sort((a, c) => c.b - a.b), bear = x.stocks.filter(s => s.d != null && side(s) === 'd').sort((a, c) => c.d - a.d), none = x.stocks.filter(s => s.b == null && s.d == null);
    const dot = (s, k) => `<span class="dot-s ${k}" tabindex="0" role="img" aria-label="${esc(s.s)}, ${k === 'up' ? 'bullish rank ' + s.b : k === 'dn' ? 'bearish rank ' + s.d : 'not scored'}" data-s="${esc(s.s)}" title="${esc(s.s)} · ${k === 'up' ? 'bullish rank ' + s.b : k === 'dn' ? 'bearish rank ' + s.d : 'not scored'}" style="opacity:${k === 'no' ? .3 : (.3 + .7 * score(s) / 100).toFixed(2)}"></span>`;
    $('#xr-body').innerHTML = `
      <div class="stats"><div class="stat"><b class="g">${b.up}</b><span>stocks closed above their open</span></div><div class="stat"><b class="r">${b.down}</b><span>closed below their open</span></div><div class="stat"><b>${bull.length}</b><span>ranked bullish</span></div><div class="stat"><b>${bear.length}</b><span>ranked bearish</span></div></div>
      <div class="two"><div class="panel"><h2>Breadth: last session's moves across the universe</h2>${histogram(b)}</div>
      <div class="panel"><h2>How to read the dots</h2><p>One dot per stock. Brighter means a higher rank among the names that strategy scores on that side. Ranks only: the page shows no prices and no levels.</p>
        <p class="note">Strategies in use: bullish side ${esc(x.bullish_strategy)}, bearish side ${esc(x.bearish_strategy)}. The Evidence view shows what the lab has measured about strategies like these.</p>
        <input id="xr-find" class="find" placeholder="Find a stock, for example RELIANCE" aria-label="Find a stock"></div></div>
      <div class="panel"><h2>Bullish ranks</h2><div class="dots">${bull.map(s => dot(s, 'up')).join('') || '<span class="muted">none</span>'}</div>
        <h2 style="margin-top:16px">Bearish ranks</h2><div class="dots">${bear.map(s => dot(s, 'dn')).join('') || '<span class="muted">none</span>'}</div>
        <h2 style="margin-top:16px">Not scored</h2><div class="dots">${none.map(s => dot(s, 'no')).join('') || '<span class="muted">none</span>'}</div>
        <p class="note" id="xr-hit" aria-live="polite"></p></div>`;
    $('#xr-find').oninput = e => {
      const q = e.target.value.trim().toUpperCase(); let hit = null;
      document.querySelectorAll('.dot-s').forEach(d => { const m = q && d.dataset.s.includes(q); d.classList.toggle('hit', !!m); if (m && !hit) hit = d; });
      $('#xr-hit').textContent = !q ? '' : hit ? `${hit.dataset.s}: ${hit.title.split(' · ')[1]}` : 'No stock matches.';
    };
  }

  const boot = () => { if ($('#ev-body')) evidenceView(); if ($('#xr-body')) xrayView(); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
