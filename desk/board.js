/* StockStalker market flow (first screen of the desk). One market read left to right, like a flowchart:
   every F&O stock as a line (its path over the last sessions) -> the lab's four live rules as gates (the criteria) ->
   the stocks each rule picked -> the lead picks as cards. A line bends into the gate of the rule that scored it; every
   other line joins the "no rule fired" bundle. Data: the lab's day and week picks files (xray.stocks[].p, m, b, d and
   tables), its train evidence file, and reports/flow/<session>.json for the intraday path once the lab publishes it.
   Percentages, ranks and shapes only: no prices. */
(() => {
  const RAW = 'https://raw.githubusercontent.com/Achintya1311/stockstalker-lab/main/';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hue = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const pct = (m, dp = 2) => (m > 0 ? '+' : m < 0 ? '−' : '') + Math.abs(m).toFixed(dp) + '%';
  const J = async u => { const r = await fetch(u); if (!r.ok) throw 0; return r.json(); };
  // the four live rules in plain words (from the lab's strategy cards); an unknown strategy shows its own name
  const RULES = {
    t04: ['Connors RSI-2', 'Oversold inside an uptrend: 2-day RSI under 10, above the 200-day average.'],
    e2a: ['Crowded-move reversal', 'Extreme up day on rising futures open interest; crowded moves tend to fade.'],
    a05b: ['Max-effect rank', 'Ranks on the largest one-day gain of the past month against usual volatility.'],
    a01: ['Weekly reversal', 'Last week’s biggest winners score bearish for the coming week.'],
  };
  const ruleOf = s => { const base = String(s || '').replace(/@v\d+$/, ''), k = base.split('_')[0]; return RULES[k] || [base.replace(/_/g, ' '), '']; };

  // candles with the order-block zone as a band and the nearest swing highs and lows as dashed lines, from the
  // lab's 0-100 scaled chart payload: shapes and letters only, never a price
  function chart(c, up) {
    if (!c || !c.bars) return '';
    const W = 320, H = 90, bars = c.bars, n = bars.length, bw = W / n, y = v => (100 - v) / 100 * (H - 10) + 5, z = c.zone, lv = Array.isArray(c.levels) ? c.levels : [];
    const col = u => u ? 'var(--up)' : 'var(--down)', zx = z ? Math.max(0, Number(z.from) || 0) * bw : 0, zok = z && Number.isFinite(z.low) && Number.isFinite(z.high), zc = zok ? col(z.side === 'demand') : '';
    const zone = zok ? `<rect x="${zx}" y="${y(z.high)}" width="${W - zx}" height="${Math.max(y(z.low) - y(z.high), 1)}" fill="${zc}" opacity=".2"/><rect x="${zx}" y="${y(z.high)}" width="${W - zx}" height="${Math.max(y(z.low) - y(z.high), 1)}" fill="none" stroke="${zc}" stroke-width="1" opacity=".7" vector-effect="non-scaling-stroke"/>` : '';
    const seen = { r: 0, s: 0 }, tags = [];
    const lines = lv.filter(q => Number.isFinite(q.at) && (q.k === 'r' || q.k === 's')).map(q => { const x0 = Math.max(0, Number(q.from) || 0) * bw + bw / 2, yy = y(q.at); tags.push(`<i class="${q.k}" style="top:${(yy / H * 100).toFixed(1)}%">${q.k === 'r' ? 'R' : 'S'}${++seen[q.k]}</i>`);
      return `<line x1="${x0}" x2="${W}" y1="${yy}" y2="${yy}" stroke="${col(q.k === 's')}" stroke-width="1" stroke-dasharray="5 4" opacity=".85" vector-effect="non-scaling-stroke"/>`; }).join('');
    if (zok) tags.push(`<i class="z" style="left:${(zx / W * 100).toFixed(1)}%;top:${((y(z.high) + y(z.low)) / 2 / H * 100).toFixed(1)}%">OB</i>`);
    const body = bars.map(([o, hi, lo, cl], i) => { const x = i * bw + bw / 2, u = cl >= o; return `<line x1="${x}" x2="${x}" y1="${y(hi)}" y2="${y(lo)}" stroke="${col(u)}" stroke-width="1"/><rect x="${x - bw * .32}" y="${y(Math.max(o, cl))}" width="${bw * .64}" height="${Math.max(Math.abs(y(o) - y(cl)), 1)}" fill="${col(u)}"/>`; }).join('');
    const what = [zok ? `the nearest order-block zone (${z.side === 'demand' ? 'demand' : 'supply'}) shaded` : '', seen.r ? `${seen.r} swing-high line${seen.r > 1 ? 's' : ''} above` : '', seen.s ? `${seen.s} swing-low line${seen.s > 1 ? 's' : ''} below` : ''].filter(Boolean).join(', ');
    return `<span class="fc-cw"><svg class="fc-ch" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Candle shape of the last ${n} sessions, scaled 0 to 100${what ? ', with ' + what : ''}">${zone}${lines}${body}</svg>${tags.join('')}</span>`;
  }
  const chartKey = c => { if (!c) return ''; const z = c.zone, lv = c.levels || []; const bits = [z ? `OB ${z.side === 'demand' ? 'demand' : 'supply'}${z.retested ? ', retested' : ''}` : '', lv.some(q => q.k === 'r') ? 'R resistance' : '', lv.some(q => q.k === 's') ? 'S support' : ''].filter(Boolean); return bits.length ? `<span class="fc-k">${bits.join(' · ')}</span>` : ''; };

  async function run() {
    const host = $('#fl-svg'), cardsEl = $('#fl-cards'), tip = $('#fl-tip'), wrap = $('#flow');
    if (!host) return;
    const [r, rw, ev] = await Promise.all([window.deskLatest('day'), window.deskLatest('week').catch(() => null), window.deskEvLoad().catch(() => null)]);
    if (!r || !r.data || !r.data.xray) { host.innerHTML = '<p class="note">The flow needs the lab’s picks file, which could not be loaded. <a href="#picks">Open the Live lab</a>.</p>'; return; }
    const d = r.data, x = d.xray, st = x.stocks.map(s => ({ ...s })), wk = rw && rw.data;
    // the move and the path per stock joined the feed on 10 Nov 2026; for a session written before that, read them from the lab's rehearsal file of the same data day
    let pathDates = x.path_dates || null;
    if (!st.some(s => Array.isArray(s.p))) {
      try { const j = await J(`${RAW}reports/live_dryrun/day/${encodeURIComponent(d.session)}.json`);
        if (j.xray && j.xray.asof === x.asof) { const mm = {}; j.xray.stocks.forEach(s => mm[s.s] = s); pathDates = j.xray.path_dates || pathDates;
          st.forEach(s => { const o = mm[s.s]; if (!o) return; if (typeof s.m !== 'number' && typeof o.m === 'number') s.m = o.m; if (Array.isArray(o.p)) s.p = o.p; });
          // same data day, so the rehearsal's chart shapes are the same bars: borrow the swing lines the live file predates
          ['bullish', 'bearish'].forEach(k => ((d.tables || {})[k] || []).forEach(q => { const o = ((j.tables || {})[k] || []).find(w => w.symbol === q.symbol); if (o && o.chart && q.chart && !q.chart.levels && o.chart.levels) q.chart.levels = o.chart.levels; })); } } catch {}
    }
    // intraday path per stock, when the lab has published the flow file for this data day
    let flow = null; try { const f = await J(`${RAW}reports/flow/${encodeURIComponent(x.asof)}.json`); if (f && f.session === x.asof && Array.isArray(f.stocks)) flow = f; } catch {}
    const series = {};
    if (flow) flow.stocks.forEach(s => series[s.s] = s.ret);
    else st.forEach(s => { if (Array.isArray(s.p)) series[s.s] = [0, ...s.p]; else if (typeof s.m === 'number') series[s.s] = null; });
    const mode = flow ? 'day' : st.some(s => Array.isArray(s.p)) ? 'path' : 'move';
    const endOf = s => { const a = series[s.s]; if (a) { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; } return typeof s.m === 'number' ? s.m : null; };
    const all = st.filter(s => endOf(s) != null);
    if (!all.length) { host.innerHTML = '<p class="note">Per-stock moves join the flow after the lab’s next end-of-day run. <a href="#picks">Open the picks</a>.</p>'; return; }
    const by = {}; st.forEach(s => by[s.s] = s);
    const nUp = all.filter(s => endOf(s) > 0).length, nDn = all.filter(s => endOf(s) < 0).length;

    // the four gates: day and week, bullish and bearish, each with the rule that owns it, what it scored and what it picked
    const tbl = (src, k) => (src && src.tables && src.tables[k]) || [];
    const gate = (hz, side, src, strat, scored) => { const list = tbl(src, side), sname = strat || (list[0] && list[0].strategy) || '', e = ev && sname ? window.deskEv(ev, sname, hz, side) : null;
      return { hz, up: side === 'bullish', side, strat: sname, rule: ruleOf(sname), ev: e, scored, picks: list.map((q, i) => ({ s: q.symbol, pick: q, pos: i + 1 })) }; };
    const gates = [
      gate('day', 'bullish', d, x.bullish_strategy, st.filter(s => s.b != null).length),
      gate('week', 'bullish', wk, null, null),
      gate('day', 'bearish', d, x.bearish_strategy, st.filter(s => s.d != null).length),
      gate('week', 'bearish', wk, null, null),
    ];
    const role = {}; // stock -> its gates, picked or only scored
    gates.forEach((g, gi) => { g.picks.forEach(q => (role[q.s] = role[q.s] || []).push({ gi, pos: q.pos }));
      if (g.hz === 'day') st.forEach(s => { if ((g.up ? s.b : s.d) != null && !(role[s.s] || []).some(o => o.gi === gi)) (role[s.s] = role[s.s] || []).push({ gi, pos: 0 }); }); });
    const label = s => { const rs = (role[s.s] || []).filter(o => o.pos); return rs.length ? rs.map(o => `${gates[o.gi].up ? 'Bullish' : 'Bearish'} ${gates[o.gi].hz} pick #${o.pos}`).join(' · ') : (role[s.s] || []).length ? 'Scored by a rule, not picked' : 'Not picked: no rule fired'; };
    const nPicked = Object.values(role).filter(a => a.some(o => o.pos)).length;
    // the cards of a half: the lead pick of each gate first, then the next picks in table order, three at most
    const leads = up => { const gs = gates.map((G, gi) => ({ G, gi })).filter(o => o.G.up === up), out = [], has = new Set();
      const add = (o, q) => { if (q && !has.has(q.s) && out.length < 3) { has.add(q.s); out.push({ G: o.G, gi: o.gi, q }); } };
      gs.forEach(o => add(o, o.G.picks[0])); for (let i = 1; i < 5; i++) gs.forEach(o => add(o, o.G.picks[i])); return out; };

    function draw() {
      const W = Math.max(host.clientWidth, 300), narrow = W < 620, H = narrow ? 280 : 720, mid = H / 2;
      const vals = all.map(s => Math.abs(endOf(s)));
      vals.sort((a, b) => a - b); const top = vals[Math.floor(vals.length * .98)] || 4, CLIP = mode === 'path' ? Math.min(40, Math.max(10, Math.ceil(top / 5) * 5)) : Math.min(10, Math.max(2, Math.ceil(top)));
      const y = v => mid - Math.max(-CLIP, Math.min(CLIP, v)) / CLIP * (mid - 16);
      const xL = 38, xR = narrow ? W - 6 : Math.round(W * .45), tA = narrow ? 0 : xR + Math.round(W * .075), gw = Math.round(W * .2), tB = tA + gw + 22, tw = W - tB - 16;
      const line = s => { const a = series[s.s];
        if (a && a.length > 1) { let dd = '', pen = false; const n = a.length; a.forEach((v, i) => { if (v == null) return; dd += `${pen ? 'L' : 'M'}${(xL + i / (n - 1) * (xR - xL)).toFixed(1)},${y(v).toFixed(1)}`; pen = true; }); return dd; }
        const c = xL + (xR - xL) * .55, e = endOf(s); return `M${xL},${mid} C${c},${mid} ${c},${y(e).toFixed(1)} ${xR},${y(e).toFixed(1)}`; };
      const curve = (x1, y1, x2, y2) => { const c = (x1 + x2) / 2; return `M${x1},${y1.toFixed(1)} C${c},${y1.toFixed(1)} ${c},${y2.toFixed(1)} ${x2},${y2.toFixed(1)}`; };
      // gate boxes: two in the green half, two in the red half
      const gh = (mid - 30) / 2, gy = gi => (gi < 2 ? 8 : mid + 16) + (gi % 2) * (gh + 6);
      // pick tiles: every pick of the two gates of a half, in gate order
      const tiles = []; [0, 2].forEach(g0 => { const list = []; [g0, g0 + 1].forEach(gi => gates[gi].picks.forEach(q => list.push({ gi, ...q })));
        const rows = Math.max(list.length, 6), rh = (mid - 24) / rows; list.forEach((t, i) => tiles.push({ ...t, x: tB, y: (g0 ? mid + 16 : 8) + i * rh, h: Math.min(rh - 4, 34) })); });
      const tileOf = (s, gi) => tiles.find(t => t.s === s && t.gi === gi);
      let g = '', html = '';
      [-CLIP, -CLIP / 2, 0, CLIP / 2, CLIP].forEach(v => g += `<line class="fl-grid${v ? '' : ' z'}" x1="${xL}" x2="${xR}" y1="${y(v)}" y2="${y(v)}"/><text class="fl-ax" x="${xL - 6}" y="${y(v) + 3}" text-anchor="end">${v > 0 ? '+' : ''}${v}%</text>`);
      const ax = mode === 'day' ? [flow.times[0], flow.times[flow.times.length - 1]] : mode === 'path' ? [(pathDates && pathDates[0]) ? pathDates[0].slice(5) + ' open' : '20 sessions ago', x.asof.slice(5) + ' close'] : ['open', 'close'];
      g += `<text class="fl-ax" x="${xL}" y="${H - 2}">${esc(ax[0])}</text><text class="fl-ax" x="${xR}" y="${H - 2}" text-anchor="end">${esc(ax[1])}</text>`;
      // one line per stock, then its bend into the gate that scored it, or into the bundle of everything no rule fired on
      const slotN = gates.map(() => 0), slotT = gates.map((_, gi) => Object.values(role).filter(a => a.some(o => o.gi === gi)).length);
      all.slice().sort((a, b) => endOf(b) - endOf(a)).forEach(s => { const e = endOf(s), cls = e > 0 ? 'up' : e < 0 ? 'dn' : 'fl0', rs = role[s.s] || [], picked = rs.some(o => o.pos);
        let bend = '';
        if (!narrow) { if (rs.length) rs.forEach(o => { const yy = gy(o.gi) + 10 + (gh - 20) * ((slotN[o.gi]++ + .5) / slotT[o.gi]); bend += `<path class="${gates[o.gi].up ? 'gu' : 'gd'}" d="${curve(xR, y(e), tA, yy)}"/>`; });
          else bend = `<path class="bundle" d="${curve(xR, y(e), tA - 4, mid)}"/>`; }
        g += `<g class="ln ${cls}${picked ? ' pk' : rs.length ? ' sc' : ''}" data-s="${esc(s.s)}"><path d="${line(s)}"/>${bend}</g>`; });
      if (flow && flow.market && flow.market.ret) { const n = flow.market.ret.length; let dd = ''; flow.market.ret.forEach((v, i) => { if (v != null) dd += `${dd ? 'L' : 'M'}${(xL + i / (n - 1) * (xR - xL)).toFixed(1)},${y(v).toFixed(1)}`; }); g += `<path class="mk" d="${dd}"/>`; }
      if (!narrow) {
        g += `<line class="fl-div" x1="${tA - 4}" x2="${W}" y1="${mid}" y2="${mid}"/><circle class="fl-dot" cx="${tA - 4}" cy="${mid}" r="3.5"/>`;
        g += `<text class="fl-ax" x="${tA + 6}" y="${mid - 5}">${all.length - Object.keys(role).length} stocks: no rule fired</text>`;
        gates.forEach((G, gi) => { const top = gy(gi), n = G.picks.length, e = G.ev;
          html += `<div class="gt ${G.up ? 'up' : 'dn'}" style="left:${tA}px;top:${top}px;width:${gw}px;height:${gh}px"><span class="gt-k">${G.hz.toUpperCase()} · ${G.up ? 'BULLISH' : 'BEARISH'}</span><b>${esc(G.rule[0] || 'No rule on file')}</b><span class="gt-r">${esc(G.rule[1])}</span><span class="gt-n">${G.scored != null ? `fired on ${G.scored} of ${st.length} · ` : ''}${n} picked</span>${e ? `<span class="gt-e ${e.superior ? 'ok' : ''}">train edge ${(e.mean * 100 >= 0 ? '+' : '') + (e.mean * 100).toFixed(2)} pts · ${e.superior ? 'passes' : 'fails'} many-trials check</span>` : '<span class="gt-e">no train replay on file</span>'}</div>`;
          G.picks.forEach((q, i) => { const t = tileOf(q.s, gi); if (t) g += `<path class="go ${G.up ? 'up' : 'dn'}" data-s="${esc(q.s)}" d="${curve(tA + gw, top + 10 + (gh - 20) * ((i + .5) / n), t.x, t.y + t.h / 2)}"/>`; }); });
        tiles.forEach(t => { const G = gates[t.gi], s = by[t.s] || { s: t.s }, e = endOf(s);
          g += `<g class="tile ${G.up ? 'up' : 'dn'}${t.pos === 1 ? ' pk' : ''}" data-s="${esc(t.s)}" tabindex="0" role="button" aria-label="${esc(t.s)}, ${esc(label(s))}"><rect x="${t.x}" y="${t.y}" width="${tw}" height="${t.h}" rx="5"/><text class="tg" x="${t.x + 7}" y="${t.y + t.h / 2 + 3.5}">${G.hz === 'day' ? 'D' : 'W'}${t.pos}</text><text class="tn" x="${t.x + 30}" y="${t.y + t.h / 2 + 4}">${esc(t.s.length > 11 && tw < 150 ? t.s.slice(0, 10) + '…' : t.s)}</text>${e != null && tw > 120 ? `<text class="tv" x="${t.x + tw - 7}" y="${t.y + t.h / 2 + 4}" text-anchor="end">${esc(pct(e, 1))}</text>` : ''}</g>`; });
        // the lead picks go on to their cards
        [true, false].forEach(up => { const L = leads(up); L.forEach((o, i) => { const t = tileOf(o.q.s, o.gi); if (t) g += `<path class="go ${up ? 'up' : 'dn'}" data-s="${esc(t.s)}" d="${curve(t.x + tw, t.y + t.h / 2, W, (up ? 0 : mid) + (i + .5) * (mid / L.length))}"/>`; }); });
      }
      host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Market flow: ${all.length} stocks drawn as lines, ${nUp} up and ${nDn} down over the window. The lab's four live rules are the gates; ${nPicked} stocks are picked and the rest pass no rule.">${g}</svg>${html}`;
      cardsEl.style.height = narrow ? '' : H + 'px';
    }

    // lead picks as cards (the first pick of each gate, then the next ones, three a side); an empty side says why (W130)
    const card = (G, q) => { const s = by[q.s] || { s: q.s }, e = endOf(s), rk = G.hz === 'day' ? (G.up ? s.b : s.d) : null;
      return `<a class="fc ${G.up ? 'up' : 'dn'}" href="#picks" data-s="${esc(q.s)}"><span class="fc-h"><span class="logo" style="background:hsl(${hue(q.s)} 55% 62%)">${esc(q.s.slice(0, 2))}</span><span class="fc-n"><b>${esc(q.s)}</b><i class="fc-st">${G.up ? 'BULLISH' : 'BEARISH'} ${G.hz === 'day' ? 'D' : 'W'}${q.pos}</i></span>${e != null ? `<span class="fc-m ${e > 0 ? 'up' : e < 0 ? 'dn' : ''}">${pct(e, 1)}</span>` : ''}</span>${chart(q.pick.chart, G.up)}${chartKey(q.pick.chart) || `<span class="fc-k">${esc(G.rule[0])}${rk != null ? ' · rank p' + esc(rk) : ''}</span>`}</a>`; };
    const none = up => { const G = gates[up ? 0 : 2]; return `<div class="fc none ${up ? 'up' : 'dn'}"><b>${up ? 'BULLISH' : 'BEARISH'}</b><span>No pick for session ${esc(d.session)}: ${G.scored ? `${G.scored} scored, none in the table` : 'the rule fired on no stock'}. An empty side is a result, not a gap.</span><a href="#picks">Why →</a></div>`; };
    const half = up => { return `<div class="fc-half ${up ? 'up' : 'dn'}">${leads(up).map(o => card(o.G, o.q)).join('') || none(up)}</div>`; };
    cardsEl.innerHTML = half(true) + half(false);

    $('#fl-cap').innerHTML = `${mode === 'day' ? `Each line is one stock's move through the session of ${esc(x.asof)} at 15-minute steps (${esc(flow.source || 'derived from 5-minute bars')}); the white line is the average.` : mode === 'path' ? `Each line is one stock's cumulative move over the 20 sessions to ${esc(x.asof)}, close to close.` : `Each line runs from the open to the stock's close move on ${esc(x.asof)}.`} Moves beyond the axis are drawn at its edge. A line bends into a gate only when that rule scored the stock; a rule is a fixed, pre-declared test, and its train result is shown on the gate. End-of-day data, a replay, not live. The line is the past, not the pick's result.`;

    // hover or focus a line, tile or card: light the stock's whole route and say what it is
    const lit = s => { wrap.querySelectorAll('.on').forEach(e => e.classList.remove('on')); wrap.classList.toggle('dim', !!s); if (s) wrap.querySelectorAll(`[data-s="${CSS.escape(s)}"]`).forEach(e => e.classList.add('on')); };
    const say = (s, evt) => { const o = by[s]; if (!o) return; const e = endOf(o), rs = (role[s] || []).filter(q => q.pos), side = rs.length ? (gates[rs[0].gi].up ? 'up' : 'dn') : 'no';
      tip.innerHTML = `<b>${esc(s)}</b>${e != null ? `<span class="${e > 0 ? 'up' : e < 0 ? 'dn' : ''}">${pct(e, 1)}</span>` : ''}<i class="${side}">${esc(label(o)).toUpperCase()}</i><small>${typeof o.m === 'number' ? `Last session ${pct(o.m)} · ` : ''}day ranks: bullish ${o.b != null ? 'p' + esc(o.b) : '–'}, bearish ${o.d != null ? 'p' + esc(o.d) : '–'}</small>`;
      tip.hidden = false; const b = wrap.getBoundingClientRect(), tx = evt && evt.clientX ? evt.clientX - b.left + 14 : 40, ty = evt && evt.clientY ? evt.clientY - b.top + 14 : 10;
      tip.style.left = Math.max(4, Math.min(tx, b.width - tip.offsetWidth - 4)) + 'px'; tip.style.top = Math.max(4, Math.min(ty, b.height - tip.offsetHeight - 4)) + 'px'; };
    const over = e => { const el = e.target.closest('[data-s]'); if (!el) { lit(null); tip.hidden = true; return; } lit(el.dataset.s); say(el.dataset.s, e); };
    const out = () => { lit(null); tip.hidden = true; };
    wrap.addEventListener('pointermove', over); wrap.addEventListener('pointerleave', out);
    wrap.addEventListener('focusin', over); wrap.addEventListener('focusout', out);
    wrap.addEventListener('click', e => { if (e.target.closest('.tile')) location.hash = '#picks'; });
    wrap.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest('.tile')) location.hash = '#picks'; });

    draw();
    let last = host.clientWidth; new ResizeObserver(() => { if (Math.abs(host.clientWidth - last) > 8) { last = host.clientWidth; draw(); } }).observe(host);
    // phone: the gates become a short list under the lines
    $('#fl-list').innerHTML = gates.map(G => `<div class="gl ${G.up ? 'up' : 'dn'}"><h3>${G.hz} · ${G.up ? 'bullish' : 'bearish'}</h3><b>${esc(G.rule[0] || 'No rule on file')}</b><span>${G.picks.length ? G.picks.map(q => esc(q.s)).join(', ') : 'the rule fired on no stock'}</span></div>`).join('');

    // live record: hits against the market's own base rate, straight from the lab's summary file
    try {
      const sm = await J(RAW + 'live/summary.json'), L = sm.live || {}, names = { day_bullish: 'Day · bullish', day_bearish: 'Day · bearish', week_bullish: 'Week · bullish', week_bearish: 'Week · bearish' };
      const rows = Object.keys(names).filter(k => L[k] && L[k].n_scored).map(k => { const t = L[k], h = t.n_hits / t.n_scored * 100, b = t.market_line * 100;
        return `<tr><th scope="row">${names[k]}</th><td>${Number(t.n_hits)} of ${Number(t.n_scored)}</td><td class="${h > b ? 'up' : 'dn'}">${h.toFixed(0)}%</td><td>${b.toFixed(0)}%</td></tr>`; }).join('');
      if (rows) $('#rec').innerHTML = `<h2 class="mb-h">Live record since 2 Nov 2026</h2><table><thead><tr><th scope="col">Table</th><th scope="col">Right way</th><th scope="col">Hit rate</th><th scope="col">Market's base rate</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Picks that closed in the picked direction, set against how often any stock did. A few weeks of picks prove nothing yet; misses stay on the record. <a href="#picks">Every pick →</a></p>`;
    } catch {}
  }
  run();
})();
