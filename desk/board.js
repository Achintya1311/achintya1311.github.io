/* StockStalker market flow (first screen of the desk). One session read left to right, like a flowchart:
   every F&O stock as a line from the open to its close move -> the biggest moves as ranked tiles -> the stocks a lab rule
   scored -> the picks as cards. Lines bend into the tile or card they belong to. Data: the lab's picks file
   (xray.stocks[].m, b, d and tables) and, once the lab publishes it, reports/flow/<session>.json for the intraday path.
   Percentages, ranks and shapes only: no prices, no levels. */
(() => {
  const RAW = 'https://raw.githubusercontent.com/Achintya1311/stockstalker-lab/main/';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hue = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const pct = m => (m > 0 ? '+' : m < 0 ? '−' : '') + Math.abs(m).toFixed(2) + '%';
  const rule = s => String(s || '').replace(/@v\d+$/, '').replace(/_/g, ' ');
  const J = async u => { const r = await fetch(u); if (!r.ok) throw 0; return r.json(); };
  const CLIP = 4, ROWS = 7;

  // candles with the zone as a shaded band, from the lab's 0-100 scaled chart payload (shape only)
  function chart(c, side) {
    if (!c || !c.bars) return '';
    const W = 320, H = 90, bars = c.bars, n = bars.length, bw = W / n, y = v => (100 - v) / 100 * (H - 10) + 5, z = c.zone;
    const col = u => u ? 'var(--up)' : 'var(--down)', zx = z ? Math.max(0, Number(z.from) || 0) * bw : 0;
    const zone = z && Number.isFinite(z.low) && Number.isFinite(z.high) ? `<rect x="${zx}" y="${y(z.high)}" width="${W - zx}" height="${Math.max(y(z.low) - y(z.high), 1)}" fill="${side === 'up' ? 'var(--up)' : 'var(--down)'}" opacity=".18"/>` : '';
    const body = bars.map(([o, hi, lo, cl], i) => { const x = i * bw + bw / 2, up = cl >= o; return `<line x1="${x}" x2="${x}" y1="${y(hi)}" y2="${y(lo)}" stroke="${col(up)}" stroke-width="1"/><rect x="${x - bw * .32}" y="${y(Math.max(o, cl))}" width="${bw * .64}" height="${Math.max(Math.abs(y(o) - y(cl)), 1)}" fill="${col(up)}"/>`; }).join('');
    return `<svg class="fc-ch" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Candle shape of the last ${n} sessions, scaled 0 to 100, with the nearest order-block zone shaded">${zone}${body}</svg>`;
  }

  async function run() {
    const host = $('#fl-svg'), cardsEl = $('#fl-cards'), tip = $('#fl-tip'), wrap = $('#flow');
    if (!host) return;
    const r = await window.deskLatest('day');
    if (!r || !r.data || !r.data.xray) { host.innerHTML = '<p class="note">The flow needs the lab’s picks file, which could not be loaded. <a href="#picks">Open the Live lab</a>.</p>'; return; }
    const d = r.data, x = d.xray, st = x.stocks.map(s => ({ ...s }));
    // the move per stock joined the feed on 10 Nov 2026; for a session written before that, read it from the lab's rehearsal file of the same data day
    if (!st.some(s => typeof s.m === 'number')) {
      try { const j = await J(`${RAW}reports/live_dryrun/day/${encodeURIComponent(d.session)}.json`);
        if (j.xray && j.xray.asof === x.asof) { const mm = {}; j.xray.stocks.forEach(s => mm[s.s] = s.m); st.forEach(s => { if (typeof mm[s.s] === 'number') s.m = mm[s.s]; }); } } catch {}
    }
    // intraday path per stock, when the lab has published the flow file for this data day
    let flow = null; try { const f = await J(`${RAW}reports/flow/${encodeURIComponent(x.asof)}.json`); if (f && f.session === x.asof && Array.isArray(f.stocks)) flow = f; } catch {}
    const path = {}; if (flow) flow.stocks.forEach(s => path[s.s] = s.ret);
    const all = st.filter(s => typeof s.m === 'number');
    if (!all.length) { host.innerHTML = '<p class="note">Per-stock moves join the flow after the lab’s next end-of-day run. <a href="#picks">Open the picks</a>.</p>'; return; }
    const picks = {}; ['bullish', 'bearish'].forEach(k => (d.tables[k] || []).forEach((p, i) => picks[p.symbol] = { pick: p, side: k === 'bullish' ? 'up' : 'dn', pos: i + 1 }));
    const by = {}; all.forEach(s => by[s.s] = s);
    const ups = all.filter(s => s.m > 0).sort((a, b) => b.m - a.m), dns = all.filter(s => s.m < 0).sort((a, b) => a.m - b.m);
    const scoredUp = st.filter(s => s.b != null).sort((a, b) => b.b - a.b).slice(0, ROWS), scoredDn = st.filter(s => s.d != null).sort((a, b) => b.d - a.d).slice(0, ROWS);
    const pk = side => Object.entries(picks).filter(([, q]) => q.side === side).sort((a, b) => a[1].pos - b[1].pos).map(([s, q]) => ({ s, ...q, st: by[s] || st.find(t => t.s === s) || { s } }));
    const bull = pk('up'), bear = pk('dn');
    const why = (s) => { const q = picks[s.s]; return q ? `${q.side === 'up' ? 'Bullish' : 'Bearish'} pick #${q.pos}` : s.b != null || s.d != null ? 'Scored, not picked' : 'Not picked: no rule fired'; };

    function draw() {
      const W = Math.max(host.clientWidth, 300), narrow = W < 620, H = narrow ? 240 : 600, mid = H / 2;
      // the cards column gives an empty side a short slot and the side with picks the rest
      const split = bull.length && bear.length ? mid : bull.length ? H - 104 : bear.length ? 104 : mid;
      cardsEl.style.height = narrow ? '' : H + 'px'; cardsEl.style.gridTemplateRows = narrow ? '' : `${split}px ${H - split}px`;
      const y = v => mid - Math.max(-CLIP, Math.min(CLIP, v)) / CLIP * (mid - 16);
      const xL = 34, xR = narrow ? W - 6 : Math.round(W * .5), seam = narrow ? 0 : Math.round(W * .09);
      const tA = xR + seam, tw = narrow ? 0 : Math.floor((W - tA - 26) / 2), tB = tA + tw + 20, rh = (mid - 14) / ROWS, th = rh - 5;
      const N = flow ? flow.times.length : 0;
      const line = s => { const pts = path[s.s];
        if (pts && N > 1) { let dd = '', pen = false; pts.forEach((v, i) => { if (v == null) return; dd += `${pen ? 'L' : 'M'}${(xL + i / (N - 1) * (xR - xL)).toFixed(1)},${y(v).toFixed(1)}`; pen = true; }); return dd; }
        const c = xL + (xR - xL) * .55; return `M${xL},${mid} C${c},${mid} ${c},${y(s.m).toFixed(1)} ${xR},${y(s.m).toFixed(1)}`; };
      const endY = s => { const pts = path[s.s]; if (pts) { for (let i = pts.length - 1; i >= 0; i--) if (pts[i] != null) return y(pts[i]); } return y(s.m); };
      // slots: column A = biggest moves, column B = scored by a rule; green half on top (largest at the top), red half below (largest fall at the bottom)
      const slot = {}, tiles = [];
      const place = (list, col, top, kind) => list.forEach((s, i) => { const row = top ? i : ROWS - 1 - i, ty = (top ? 8 : mid + 6) + row * rh; const t = { s, col, x: col ? tB : tA, y: ty, top, kind }; tiles.push(t); (slot[s.s] = slot[s.s] || []).push(t); });
      if (!narrow) { place(ups.slice(0, ROWS), 0, true, 'm'); place(dns.slice(0, ROWS), 0, false, 'm'); place(scoredUp, 1, true, 'r'); place(scoredDn, 1, false, 'r'); }
      const curve = (x1, y1, x2, y2) => { const c = (x1 + x2) / 2; return `M${x1},${y1.toFixed(1)} C${c},${y1.toFixed(1)} ${c},${y2.toFixed(1)} ${x2},${y2.toFixed(1)}`; };
      let g = '';
      // axis
      [-4, -2, 0, 2, 4].forEach(v => g += `<line class="fl-grid${v ? '' : ' z'}" x1="${xL}" x2="${xR}" y1="${y(v)}" y2="${y(v)}"/><text class="fl-ax" x="${xL - 6}" y="${y(v) + 3}" text-anchor="end">${v > 0 ? '+' : ''}${v}%</text>`);
      g += `<text class="fl-ax" x="${xL}" y="${H - 2}">${flow ? esc(flow.times[0]) : 'open'}</text><text class="fl-ax" x="${xR}" y="${H - 2}" text-anchor="end">${flow ? esc(flow.times[N - 1]) : 'close'}</text>`;
      // one line per stock, then its bend into a tile (or into the bundle at the half's edge)
      all.forEach(s => { const cls = s.m > 0 ? 'up' : s.m < 0 ? 'dn' : 'fl0', q = picks[s.s], ey = endY(s);
        let bend = '';
        if (!narrow) { const ts = slot[s.s]; if (ts) ts.forEach(t => bend += `<path d="${curve(xR, ey, t.x, t.y + th / 2)}"/>`); else bend = `<path class="bundle" d="${curve(xR, ey, tA - 6, s.m > 0 ? mid - 5 : mid + 5)}"/>`; }
        g += `<g class="ln ${cls}${q ? ' pk' : ''}${slot[s.s] ? ' tl' : ''}" data-s="${esc(s.s)}"><path d="${line(s)}"/>${bend}</g>`; });
      if (flow && flow.market && flow.market.ret) { let dd = ''; flow.market.ret.forEach((v, i) => { if (v != null) dd += `${dd ? 'L' : 'M'}${(xL + i / (N - 1) * (xR - xL)).toFixed(1)},${y(v).toFixed(1)}`; }); g += `<path class="mk" d="${dd}"/>`; }
      if (!narrow) {
        g += `<line class="fl-div" x1="${xR}" x2="${W}" y1="${mid}" y2="${mid}"/><circle class="fl-dot" cx="${tA - 6}" cy="${mid}" r="3.5"/>`;
        g += `<text class="fl-cnt up" x="${xR + 6}" y="${mid - 8}">▲ ${ups.length}</text><text class="fl-cnt dn" x="${xR + 6}" y="${mid + 17}">▼ ${dns.length}</text>`;
        tiles.forEach(t => { const s = t.s, q = picks[s.s], up = t.top, v = t.kind === 'm' ? pct(s.m) : 'p' + (up ? s.b : s.d), k = Math.min(Math.abs(s.m || 0) / 3, 1) * .5 + .12;
          g += `<g class="tile ${up ? 'up' : 'dn'}${q ? ' pk' : ''}" data-s="${esc(s.s)}" tabindex="0" role="button" aria-label="${esc(s.s)}, ${pct(s.m || 0)}, ${esc(why(s))}"><rect x="${t.x}" y="${t.y}" width="${tw}" height="${th}" rx="5" style="--k:${k.toFixed(2)}"/><text class="tn" x="${t.x + 8}" y="${t.y + th / 2 + 4}">${esc(s.s.length > 10 && tw < 130 ? s.s.slice(0, 9) + '…' : s.s)}</text><text class="tv" x="${t.x + tw - 8}" y="${t.y + th / 2 + 4}" text-anchor="end">${esc(v)}</text></g>`; });
        const empty = (top, n) => { if (n) return; const ty = top ? 8 : mid + 6; g += `<rect class="tile-e" x="${tB}" y="${ty}" width="${tw}" height="${rh * 2 - 5}" rx="5"/><text class="fl-ax" x="${tB + 8}" y="${ty + 18}">${top ? 'Bullish' : 'Bearish'} rule fired</text><text class="fl-ax" x="${tB + 8}" y="${ty + 33}">on no stock today</text>`; };
        empty(true, scoredUp.length); empty(false, scoredDn.length);
        // stubs from the scored column toward the cards
        const stub = (list, top) => list.forEach((w, i) => { const t = (slot[w.s] || []).find(t => t.col === 1); if (!t) return; const cy = (top ? 0 : split) + (i + .5) * ((top ? split : H - split) / list.length); g += `<path class="go ${top ? 'up' : 'dn'}" d="${curve(t.x + tw, t.y + th / 2, W, cy)}"/>`; });
        stub(bull, true); stub(bear, false);
      }
      host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Market flow for the last session: ${ups.length} stocks rose and ${dns.length} fell from open to close. The biggest moves and the stocks a lab rule scored are listed as tiles, and the picks as cards.">${g}</svg>`;
    }

    // the picks as cards; an empty side says why (W130)
    const card = w => { const s = w.st, up = w.side === 'up';
      return `<a class="fc ${w.side}" href="#picks" data-s="${esc(w.s)}"><span class="fc-h"><span class="logo" style="background:hsl(${hue(w.s)} 55% 62%)">${esc(w.s.slice(0, 2))}</span><span class="fc-n"><b>${esc(w.s)}</b><i class="fc-st">${up ? 'BULLISH' : 'BEARISH'} #${w.pos}</i></span>${typeof s.m === 'number' ? `<span class="fc-m ${s.m > 0 ? 'up' : s.m < 0 ? 'dn' : ''}">${pct(s.m)}</span>` : ''}</span>${chart(w.pick.chart, w.side)}<span class="fc-r"><span>RULE</span> ${esc(rule(w.pick.strategy))} · rank p${esc(up ? s.b : s.d)}</span></a>`; };
    const none = (side, n) => `<div class="fc none ${side}"><b>${side === 'up' ? 'BULLISH' : 'BEARISH'}</b><span>No pick for session ${esc(d.session)}: ${n ? `${n} scored, none in the table` : 'the rule fired on no stock'}. An empty side is a result, not a gap.</span><a href="#picks">Why →</a></div>`;
    cardsEl.innerHTML = `<div class="fc-half up">${bull.map(card).join('') || none('up', scoredUp.length)}</div><div class="fc-half dn">${bear.map(card).join('') || none('dn', scoredDn.length)}</div>`;

    $('#fl-cap').innerHTML = `${flow ? `Each line is one stock's move through the session of ${esc(x.asof)} at 15-minute steps (${esc(flow.source || 'derived from 5-minute bars')}); the white line is the average.` : `Each line runs from the open to the stock's close move on ${esc(x.asof)}; the path through the day joins once the lab publishes it.`} Moves beyond ±${CLIP}% are drawn at the edge. A replay of the last session, not live. A picked stock's move is the day before the pick, not its result.`;

    // hover or focus a line, tile or card: light the stock's whole route and say what it is
    const lit = s => { wrap.querySelectorAll('.on').forEach(e => e.classList.remove('on')); wrap.classList.toggle('dim', !!s); if (s) wrap.querySelectorAll(`[data-s="${CSS.escape(s)}"]`).forEach(e => e.classList.add('on')); };
    const say = (s, ev) => { const o = by[s] || st.find(t => t.s === s); if (!o) return; const q = picks[s];
      tip.innerHTML = `<b>${esc(s)}</b>${typeof o.m === 'number' ? `<span class="${o.m > 0 ? 'up' : o.m < 0 ? 'dn' : ''}">${pct(o.m)}</span>` : ''}<i class="${q ? q.side : 'no'}">${esc(why(o)).toUpperCase()}</i><small>Bullish rank ${o.b != null ? 'p' + esc(o.b) : '–'} · bearish rank ${o.d != null ? 'p' + esc(o.d) : '–'}</small>`;
      tip.hidden = false; const b = wrap.getBoundingClientRect(), tx = ev && ev.clientX ? ev.clientX - b.left + 14 : 40, ty = ev && ev.clientY ? ev.clientY - b.top + 14 : 10;
      tip.style.left = Math.max(4, Math.min(tx, b.width - tip.offsetWidth - 4)) + 'px'; tip.style.top = Math.max(4, Math.min(ty, b.height - tip.offsetHeight - 4)) + 'px'; };
    const over = e => { const el = e.target.closest('[data-s]'); if (!el) return; lit(el.dataset.s); say(el.dataset.s, e); };
    const out = () => { lit(null); tip.hidden = true; };
    wrap.addEventListener('pointermove', over); wrap.addEventListener('pointerleave', out);
    wrap.addEventListener('focusin', over); wrap.addEventListener('focusout', out);
    wrap.addEventListener('click', e => { const el = e.target.closest('.tile'); if (el) location.hash = picks[el.dataset.s] ? '#picks' : '#xray'; });
    wrap.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest('.tile')) e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    draw();
    let last = host.clientWidth; new ResizeObserver(() => { if (Math.abs(host.clientWidth - last) > 8) { last = host.clientWidth; draw(); } }).observe(host);
    // phone: the tiles become two short lists under the lines
    const li = (s, v) => `<li data-s="${esc(s.s)}"><b>${esc(s.s)}</b><span class="${s.m > 0 ? 'up' : 'dn'}">${esc(v)}</span></li>`;
    $('#fl-list').innerHTML = `<div><h3>Biggest rises</h3><ol>${ups.slice(0, 5).map(s => li(s, pct(s.m))).join('')}</ol></div><div><h3>Biggest falls</h3><ol>${dns.slice(0, 5).map(s => li(s, pct(s.m))).join('')}</ol></div>`;

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
