/* Home dashboard: market breadth, today's top bullish and bearish picks, strategies now, lab journal. Reads the lab's public files. */
(() => {
  const REPO = 'Achintya1311/stockstalker-lab';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hue = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

  // greeting and market state (IST)
  const now = new Date(), ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })), h = ist.getHours(), m = ist.getMinutes(), wd = ist.getDay();
  $('#hello').textContent = `${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, Achintya`;
  $('#today').textContent = ist.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const mins = h * 60 + m, open = wd >= 1 && wd <= 5 && mins >= 555 && mins < 930;
  $('#mkt-state').textContent = open ? 'Market open · data refreshes after the close' : `Closed · opens ${(wd === 5 && mins >= 930) || wd === 6 || wd === 0 ? 'Mon' : mins >= 930 ? 'tomorrow' : 'today 9:15'}`;

  // smooth area chart of breadth
  function depth(b) {
    const W = 760, H = 120, n = b.counts.length, mx = Math.max(...b.counts, 1), mid = b.edges_pct.indexOf(0) + 1;
    const xs = b.counts.map((_, i) => (i + .5) * W / n), ys = b.counts.map(c => H - 22 - c / mx * (H - 40));
    const path = (a, z) => { let d = `M${xs[a]},${ys[a]}`; for (let i = a + 1; i <= z; i++) { const cx = (xs[i - 1] + xs[i]) / 2; d += ` C${cx},${ys[i - 1]} ${cx},${ys[i]} ${xs[i]},${ys[i]}`; } return d; };
    const mx0 = mid * W / n, ticks = [[-4, '-4%'], [-2, '-2%'], [0, '0'], [2, '+2%'], [4, '+4%']];
    const left = path(0, mid - 1), right = path(mid, n - 1);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Distribution of the last session's open-to-close moves across the universe">
      <defs><linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--down)" stop-opacity=".45"/><stop offset="1" stop-color="var(--down)" stop-opacity="0"/></linearGradient>
      <linearGradient id="gu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--up)" stop-opacity=".45"/><stop offset="1" stop-color="var(--up)" stop-opacity="0"/></linearGradient></defs>
      <path d="${left} L${xs[mid - 1]},${H - 22} L${xs[0]},${H - 22}Z" fill="url(#gd)"/><path d="${left}" fill="none" stroke="var(--down)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      <path d="${right} L${xs[n - 1]},${H - 22} L${xs[mid]},${H - 22}Z" fill="url(#gu)"/><path d="${right}" fill="none" stroke="var(--up)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      <line x1="${mx0}" x2="${mx0}" y1="4" y2="${H - 22}" stroke="currentColor" opacity=".55" vector-effect="non-scaling-stroke"/><circle cx="${mx0}" cy="${H - 22}" r="3" fill="var(--bg)" stroke="currentColor"/>
      </svg><div class="ax" aria-hidden="true">${ticks.filter(([e]) => b.edges_pct.indexOf(e) >= 0).map(([e, t]) => `<span style="left:${(b.edges_pct.indexOf(e) + 1) / n * 100}%">${t}</span>`).join('')}</div>`;
  }

  // candles with a dotted average, from the lab's scaled chart payload
  function mini(c) {
    if (!c || !c.bars) return '';
    const W = 130, H = 44, bars = c.bars.slice(-30), n = bars.length, bw = W / n, y = v => (100 - v) / 100 * (H - 6) + 3;
    const ma = bars.map((_, i) => { const a = bars.slice(Math.max(0, i - 7), i + 1); return a.reduce((s, b) => s + b[3], 0) / a.length; });
    const body = bars.map(([o, hi, lo, cl], i) => { const x = i * bw + bw / 2, up = cl >= o, col = up ? 'var(--up)' : 'var(--down)'; return `<line x1="${x}" x2="${x}" y1="${y(hi)}" y2="${y(lo)}" stroke="${col}" stroke-width=".8"/><rect x="${x - bw * .32}" y="${y(Math.max(o, cl))}" width="${bw * .64}" height="${Math.max(Math.abs(y(o) - y(cl)), .8)}" fill="${col}"/>`; }).join('');
    const dots = ma.map((v, i) => `${i ? 'L' : 'M'}${i * bw + bw / 2},${y(v)}`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${body}<path d="${dots}" fill="none" stroke="#4c8bf5" stroke-width="1" stroke-dasharray="1.5 2.5" vector-effect="non-scaling-stroke"/></svg>`;
  }

  const tile = (p, rk, side) => `<a class="t2" href="#picks" title="${esc(p.reasoning || '')}">
    <span class="logo" style="background:hsl(${hue(p.symbol)} 55% 62%)">${esc(p.symbol.slice(0, 2))}</span>
    <span class="nm"><span class="r1"><span class="bd">${side === 'up' ? 'BULL' : 'BEAR'}</span><b>${esc(p.symbol)}</b></span><small>${esc(String(p.strategy || '').replace('@v1', '').replace(/_/g, ' '))}</small></span>
    <span class="mini">${mini(p.chart)}</span><span class="rk">${rk != null ? 'p' + rk : '–'}</span></a>`;

  async function top() {
    const r = await window.deskLatest('day');
    if (!r) { $('#top-bull').innerHTML = $('#top-bear').innerHTML = '<p class="note">Could not load the lab’s picks.</p>'; return; }
    const d = r.data, x = d.xray, rk = {};
    ((x && x.stocks) || []).forEach(s => rk[s.s] = s);
    if (x) { $('#depth').innerHTML = depth(x.breadth); $('#asof').textContent = 'as of ' + x.asof + (r.dry ? ' · dry run' : ''); }
    if (x && x.breadth && x.breadth.n) $('#counts').innerHTML = `<span class="g">▲ ${Number(x.breadth.up)}</span> <span class="r">▼ ${Number(x.breadth.down)}</span><small>stocks up / down in the last session, by price move, not picks</small>`;
    $('#top-bull').innerHTML = (d.tables.bullish || []).slice(0, 3).map(p => tile(p, rk[p.symbol] && rk[p.symbol].b, 'up')).join('') || '<p class="note">No picks.</p>';
    $('#top-bear').innerHTML = (d.tables.bearish || []).slice(0, 3).map(p => tile(p, rk[p.symbol] && rk[p.symbol].d, 'dn')).join('') || '<p class="note">No picks.</p>';
  }

  // compact edge bars (points over the market base rate), green when the strategy survives the many-trials test
  function bars(rows, sup) {
    const mx = Math.max(...rows.map(r => Math.abs(r.mean * 100)), 1);
    return `<div class="eb">${rows.map(r => { const v = r.mean * 100, w = Math.abs(v) / mx * 50, s = sup.includes(r.id);
      return `<div class="er"><span class="en">${esc(window.deskPretty(r.id))}</span><span class="ebar"><i style="${v >= 0 ? 'left:50%' : `right:50%`};width:${w}%;background:${s ? 'var(--up)' : v < 0 ? 'var(--down)' : 'var(--muted)'}"></i></span><span class="ev2 num">${v >= 0 ? '+' : ''}${v.toFixed(2)}</span></div>`; }).join('')}</div>`;
  }

  async function strategies() {
    const ev = await window.deskEvLoad();
    if (!ev) { $('#strat').innerHTML = '<p class="note">Could not load the evidence file.</p>'; return; }
    const g = ev['day/bearish'], rows = Object.entries(g.experiments).map(([id, e]) => ({ id, ...e })).sort((a, b) => b.mean - a.mean);
    const sup = g.joint.stepm, nsup = sup.length, nfail = rows.length - nsup;
    $('#strat').innerHTML = `<div class="strip"><span class="a">SURVIVE ${nsup}</span><span class="ticks">${rows.map(r => `<i class="${sup.includes(r.id) ? 's' : r.hi < 0 ? 'f' : ''}" title="${esc(window.deskPretty(r.id))}"></i>`).join('')}</span><span class="b">NOT SURVIVING ${nfail}</span></div>${bars(rows.slice(0, 8), sup)}<p class="note">Train 2015 to 2020, day horizon, bearish side. Here ${nsup} of ${rows.length} variants survive; across all four horizon and side groups the lab counts ${Object.values(ev).reduce((n, v) => n + v.joint.stepm.length, 0)} of ${Object.values(ev).reduce((n, v) => n + Object.keys(v.experiments).length, 0)}. These are lab experiments. ${rows.some(r => r.id === 'champion-v1-day') ? `The current picks use the provisional blended score (Champion v1), whose own train replay is in this file and ${sup.includes('champion-v1-day') ? 'survives' : 'does not survive'} the correction.` : 'The current picks use a provisional blended score whose train replay is a separate lab report.'}</p>`;
    const tot = Object.values(ev).reduce((n, v) => n + v.joint.stepm.length, 0), all = Object.values(ev).reduce((n, v) => n + Object.keys(v.experiments).length, 0);
    $('#surv-line').textContent = `${tot} of ${all} results survive the many-trials test`;
    $('#surv-bar').style.width = (tot / all * 100).toFixed(0) + '%';
  }

  async function journal() {
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/commits?path=state/journal.md&per_page=5`);
      if (!r.ok) throw 0;
      const list = await r.json(), ago = t => { const mm = (Date.now() - new Date(t)) / 6e4; return mm < 90 ? Math.round(mm) + 'm ago' : mm < 2880 ? Math.round(mm / 60) + 'h ago' : Math.round(mm / 1440) + 'd ago'; };
      $('#journal').innerHTML = list.map(c => { const msg = c.commit.message.split('\n')[0].replace(/\s*\[supervised\]/, ''), mt = msg.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.*)$/), lane = mt && mt[2] ? mt[2] : mt ? mt[1] : 'lab';
        return `<a href="${esc(c.html_url)}"><span class="av2"></span><span><b>lab <span class="tag">${esc(lane)}</span><time>${ago(c.commit.author.date)}</time></b><small>${esc(mt ? mt[3] : msg)}</small></span></a>`; }).join('');
    } catch { $('#journal').innerHTML = `<p class="note">Could not load the journal. <a href="https://github.com/${REPO}/blob/main/state/journal.md">Open it on GitHub</a>.</p>`; }
  }

  // 4 newest findings = first four cards in the root page's order (no date field exists); title, stat, thumbnail only
  async function findings() {
    const box = $('#home-find');
    try {
      const { cards } = await window.deskRoot();
      box.innerHTML = cards.slice(0, 4).map(c => `<a class="hf" href="#findings"><span class="hf-t">${esc(c.title)}</span><span class="hf-s">${esc(c.big)}</span><span class="hf-u">${esc(c.sub)}</span>${c.src ? `<span class="fc-th"><img src="${esc(c.src)}" alt="" width="96" height="72" loading="lazy"></span>` : '<span class="fc-th ph" aria-hidden="true">Workbook</span>'}</a>`).join('');
    } catch { box.innerHTML = '<p class="note">Could not load findings here. <a href="../index.html#findings">Open the classic page</a>.</p>'; }
  }

  top(); strategies(); journal(); findings();
})();
