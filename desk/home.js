/* Home dashboard: market breadth, today's top bullish and bearish picks, strategies now, lab journal. Reads the lab's public files. */
(() => {
  const REPO = 'Achintya1311/stockstalker-lab';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hue = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

  // greeting and market state (IST)
  const now = new Date(), ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })), h = ist.getHours(), m = ist.getMinutes(), wd = ist.getDay();
  $('#today').textContent = ist.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const mins = h * 60 + m, open = wd >= 1 && wd <= 5 && mins >= 555 && mins < 930;
  const dot = $('#mkt-state').previousElementSibling; if (dot) dot.classList.toggle('live', open);
  $('#mkt-state').textContent = open ? 'Market open · data refreshes after the close' : `Closed · opens ${(wd === 5 && mins >= 930) || wd === 6 || wd === 0 ? 'Mon' : mins >= 930 ? 'tomorrow' : 'today 9:15'}`;

  // smooth area chart of breadth
  function depth(b) {
    const W = 760, H = 120, n = b.counts.length, mx = Math.max(...b.counts, 1), mid = b.edges_pct.indexOf(0) + 1;
    const xs = b.counts.map((_, i) => (i + .5) * W / n), ys = b.counts.map(c => H - 22 - c / mx * (H - 40));
    const path = (a, z) => { let d = `M${xs[a]},${ys[a]}`; for (let i = a + 1; i <= z; i++) { const cx = (xs[i - 1] + xs[i]) / 2; d += ` C${cx},${ys[i - 1]} ${cx},${ys[i]} ${xs[i]},${ys[i]}`; } return d; };
    const mx0 = mid * W / n, ticks = [[-4, '-4%'], [-2, '-2%'], [0, '0'], [2, '+2%'], [4, '+4%']];
    const left = path(0, mid - 1), right = path(mid, n - 1);
    const num = v => Number.isFinite(Number(v)) ? Number(v) : null, up = num(b.up), dn = num(b.down), tot = num(b.n);
    const label = "Distribution of the last session's open-to-close moves across the universe" + (up != null && dn != null && tot ? `: ${up} stocks up, ${dn} down, of ${tot}` : '');
    const fmt = e => (e > 0 ? '+' : '') + Number(e) + '%', E = b.edges_pct;
    // text twin of the chart: one row per bin, counts straight from the file (W98)
    const table = n === E.length + 1 ? `<details class="bt"><summary>Table of the bins</summary><table><caption>Stocks by open-to-close move, last session</caption><thead><tr><th scope="col">Move</th><th scope="col">Stocks</th></tr></thead><tbody>${b.counts.map((c, i) => `<tr><th scope="row">${i === 0 ? 'Below ' + fmt(E[0]) : i === n - 1 ? 'Above ' + fmt(E[i - 1]) : fmt(E[i - 1]) + ' to ' + fmt(E[i])}</th><td>${Number(c)}</td></tr>`).join('')}</tbody></table></details>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">
      <defs><linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--down)" stop-opacity=".45"/><stop offset="1" stop-color="var(--down)" stop-opacity="0"/></linearGradient>
      <linearGradient id="gu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--up)" stop-opacity=".45"/><stop offset="1" stop-color="var(--up)" stop-opacity="0"/></linearGradient></defs>
      <path d="${left} L${xs[mid - 1]},${H - 22} L${xs[0]},${H - 22}Z" fill="url(#gd)"/><path d="${left}" fill="none" stroke="var(--down)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      <path d="${right} L${xs[n - 1]},${H - 22} L${xs[mid]},${H - 22}Z" fill="url(#gu)"/><path d="${right}" fill="none" stroke="var(--up)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      <line x1="${mx0}" x2="${mx0}" y1="4" y2="${H - 22}" stroke="currentColor" opacity=".55" vector-effect="non-scaling-stroke"/><circle cx="${mx0}" cy="${H - 22}" r="3" fill="var(--bg)" stroke="currentColor"/>
      </svg><div class="ax" aria-hidden="true">${ticks.filter(([e]) => b.edges_pct.indexOf(e) >= 0).map(([e, t]) => `<span style="left:${(b.edges_pct.indexOf(e) + 1) / n * 100}%">${t}</span>`).join('')}</div>${table}`;
  }

  // candles with a dotted average, from the lab's scaled chart payload
  function mini(c) {
    if (!c || !c.bars) return '';
    const W = 130, H = 44, bars = c.bars.slice(-30), n = bars.length, bw = W / n, y = v => (100 - v) / 100 * (H - 6) + 3;
    const ma = bars.map((_, i) => { const a = bars.slice(Math.max(0, i - 7), i + 1); return a.reduce((s, b) => s + b[3], 0) / a.length; });
    const body = bars.map(([o, hi, lo, cl], i) => { const x = i * bw + bw / 2, up = cl >= o, col = up ? 'var(--up)' : 'var(--down)'; return `<line x1="${x}" x2="${x}" y1="${y(hi)}" y2="${y(lo)}" stroke="${col}" stroke-width=".8"/><rect x="${x - bw * .32}" y="${y(Math.max(o, cl))}" width="${bw * .64}" height="${Math.max(Math.abs(y(o) - y(cl)), .8)}" ${up ? `fill="${col}"` : `fill="none" stroke="${col}" stroke-width=".8"`}/>`; }).join('');
    const dots = ma.map((v, i) => `${i ? 'L' : 'M'}${i * bw + bw / 2},${y(v)}`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${body}<path d="${dots}" fill="none" stroke="#4c8bf5" stroke-width="1" stroke-dasharray="1.5 2.5" vector-effect="non-scaling-stroke"/></svg>`;
  }

  const tile = (p, rk, side) => `<a class="t2" href="#picks" title="${esc(window.deskNoLevels(p.reasoning || ''))}">
    <span class="logo" style="background:hsl(${hue(p.symbol)} 55% 62%)">${esc(p.symbol.slice(0, 2))}</span>
    <span class="nm"><span class="r1"><span class="bd">${side === 'up' ? 'BULL' : 'BEAR'}</span><b>${esc(p.symbol)}</b></span><small>${esc(String(p.strategy || '').replace('@v1', '').replace(/_/g, ' '))}</small></span>
    <span class="mini">${mini(p.chart)}</span><span class="rk">${rk != null ? 'p' + rk : '–'}</span></a>`;

  async function top() {
    const r = await window.deskLatest('day');
    if (!r) { $('#top-bull').innerHTML = $('#top-bear').innerHTML = '<p class="note">Could not load the lab’s picks.</p>'; $('#depth').innerHTML = '<p class="note">Breadth needs the lab’s picks file, which could not be loaded.</p>'; return; }
    const d = r.data, x = d.xray, rk = {};
    // W125: the clock alone called a weekday holiday 'Market open'. The lab skips non-trading days, so a picks file for a later session than today means no session today.
    const todayIst = ist.toLocaleDateString('en-CA');
    if (open && d.session && d.session > todayIst) {
      const dt = new Date(d.session + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      if (dot) dot.classList.remove('live');
      $('#mkt-state').textContent = `Closed today, no session · next session ${dt}`;
    }
    ((x && x.stocks) || []).forEach(s => rk[s.s] = s);
    if (x) { $('#depth').innerHTML = depth(x.breadth); $('#asof').textContent = 'as of ' + x.asof + (r.dry ? ' · rehearsal file' : ''); }
    if (x && x.breadth && x.breadth.n) $('#counts').innerHTML = `<span class="g">▲ ${Number(x.breadth.up)}</span> <span class="r">▼ ${Number(x.breadth.down)}</span><small>stocks up / down in the last session, by price move, not picks</small>`;
    $('#top-bull').innerHTML = (d.tables.bullish || []).slice(0, 3).map(p => tile(p, rk[p.symbol] && rk[p.symbol].b, 'up')).join('') || '<p class="note">No picks.</p>';
    $('#top-bear').innerHTML = (d.tables.bearish || []).slice(0, 3).map(p => tile(p, rk[p.symbol] && rk[p.symbol].d, 'dn')).join('') || '<p class="note">No picks.</p>';
  }

  // compact edge bars, top 5 only (DD9; the full list is on Evidence) (points over the market base rate), green when the strategy survives the many-trials test
  function bars(rows, sup) {
    const mx = Math.max(...rows.map(r => Math.abs(r.mean * 100)), 1);
    return `<div class="eb">${rows.map(r => { const v = r.mean * 100, w = Math.abs(v) / mx * 50, s = sup.includes(r.id);
      return `<div class="er"><span class="en">${esc(window.deskPretty(r.id))}</span><span class="ebar"><i style="${v >= 0 ? 'left:50%' : `right:50%`};width:${w}%;background:${s ? 'var(--up)' : v < 0 ? 'var(--down)' : 'var(--muted)'}"></i></span><span class="ev2 num">${v >= 0 ? '+' : ''}${v.toFixed(2)}</span></div>`; }).join('')}</div>`;
  }

  async function strategies() {
    const ev = await window.deskEvLoad();
    if (!ev) { $('#strat').innerHTML = '<p class="note">Could not load the evidence file.</p>'; $('#proof-lab').innerHTML = 'Lab: the evidence file could not be loaded here; <a href="#evidence">open Evidence</a>.'; return; }
    const g = ev['day/bearish'], rows = Object.entries(g.experiments).map(([id, e]) => ({ id, ...e })).sort((a, b) => b.mean - a.mean);
    const sup = g.joint.stepm, nsup = sup.length, nfail = rows.length - nsup;
    $('#strat').innerHTML = `<div class="strip"><span class="a">SURVIVE ${nsup}</span><span class="ticks">${rows.map(r => `<i class="${sup.includes(r.id) ? 's' : r.hi < 0 ? 'f' : ''}" title="${esc(window.deskPretty(r.id))}"></i>`).join('')}</span><span class="b">NOT SURVIVING ${nfail}</span></div>${bars(rows.slice(0, 5), sup)}<p class="note">The 5 largest edges of ${rows.length} variants (points over the base rate), train years 2015 to 2020, day horizon, bearish side; ${nsup} pass the many-trials check at the 10% level.</p><details class="orow"><summary><span class="ot">More on this list</span></summary><div class="ob"><p>Across all four horizon and side groups the lab counts ${Object.values(ev).reduce((n, v) => n + v.joint.stepm.length, 0)} of ${Object.values(ev).reduce((n, v) => n + Object.keys(v.experiments).length, 0)}. These are lab experiments. ${(() => { const c = k => ev[k] && ev[k].experiments['champion-v1-day'], b = c('day/bullish'), s = c('day/bearish');
      return s ? `The lab's first provisional rule, its blended score (Champion v1), has its own train replay in this file: on the bearish side its interval is ${s.lo > 0 ? 'above zero' : s.hi < 0 ? 'entirely below zero' : 'not distinguishable from zero'} (${(s.lo * 100).toFixed(2)} to ${(s.hi * 100).toFixed(2)} points), and it ${sup.includes('champion-v1-day') ? 'is' : 'is not'} among the ${nsup} variants that stay superior once the number of tries is counted${b ? `, and on the bullish side its interval is ${b.hi < 0 ? 'entirely below zero (it loses to the market line)' : 'not above zero'}` : ''}. Each pick on the Picks view names the strategy that chose it.` : 'The lab\'s first provisional rule, a blended score, has its train replay in a separate lab report. Each pick on the Picks view names the strategy that chose it.'; })()}</p></div></details>`;
    const tot = Object.values(ev).reduce((n, v) => n + v.joint.stepm.length, 0), all = Object.values(ev).reduce((n, v) => n + Object.keys(v.experiments).length, 0);
    $('#surv-line').textContent = `${tot} of ${all} results pass the many-trials check (10% level)`;
    $('#proof-lab').textContent = `Lab: ${tot} of ${all} strategy results still beat the market's base rate after correcting for how many were tried (10% level), in the 2015 to 2020 train years; this count leaves out later, unseen years.`;
    $('#surv-bar').style.width = (tot / all * 100).toFixed(0) + '%';
  }

  async function journal() {
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/commits?path=state/journal.md&per_page=5`);
      if (!r.ok) throw 0;
      const list = await r.json(), ago = t => { const mm = (Date.now() - new Date(t)) / 6e4; return mm < 90 ? Math.round(mm) + 'm ago' : mm < 2880 ? Math.round(mm / 60) + 'h ago' : Math.round(mm / 1440) + 'd ago'; };
      $('#journal').innerHTML = list.map(c => { const msg = c.commit.message.split('\n')[0].replace(/\s*\[supervised\]/, ''), mt = msg.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.*)$/), lane = mt && mt[2] ? mt[2] : mt ? mt[1] : 'lab';
        // DD9: one line per entry (lane, start of the message, age); the full line and the commit link open in place
        return `<details class="orow jrow"><summary><span class="tag">${esc(lane)}</span><span class="jt">${esc(mt ? mt[3] : msg)}</span><time>${ago(c.commit.author.date)}</time></summary><div class="ob"><p>${esc(mt ? mt[3] : msg)}</p><a href="${esc(c.html_url)}">Open the lab commit →</a></div></details>`; }).join('');
    } catch { $('#journal').innerHTML = `<p class="note">Could not load the journal. <a href="https://github.com/${REPO}/blob/main/state/journal.md">Open it on GitHub</a>.</p>`; }
  }

  // 4 newest findings = first four cards in the root page's order (no date field exists). DD9: one line each (title and stat), opening to the card's one-line summary
  async function findings() {
    const box = $('#home-find');
    try {
      const { cards } = await window.deskRoot();
      box.innerHTML = cards.slice(0, 4).map(c => `<details class="orow"><summary><span class="ot">${esc(c.title)}</span><span class="os">${esc(c.big)}</span></summary><div class="ob"><p><b>${esc(c.big)}</b> ${esc(c.sub)}</p><a href="#findings">Open it on Findings →</a></div></details>`).join('');
    } catch { box.innerHTML = '<p class="note">Could not load findings here. <a href="../index.html#findings">Open the classic page</a>.</p>'; }
  }

  async function who() {
    try {
      const { doc } = await window.deskRoot(), hero = doc.querySelector('header.hero'); if (!hero) return;
      const k = hero.querySelector('.kicker'), n = hero.querySelector('h1'), f = [...hero.querySelectorAll('.facts > div')];
      const fact = name => f.find(d => d.querySelector('dt').textContent.trim() === name);
      if (k) $('#ov-kick').textContent = k.textContent.trim(); if (n) $('#hello').textContent = n.textContent.trim();
      const c = fact('Certified'), b = fact('Built');
      if (c) $('#ov-cert').textContent = 'Certified: ' + [...c.querySelectorAll('dd')].map(d => d.textContent.trim()).join('; ');
      if (b) { const m = b.querySelector('dd').textContent.match(/^(\d+) research repos/); if (m) $('#ov-built').textContent = `${m[1]} research projects alongside it`; }
    } catch {}
  }

  who(); top(); strategies(); journal(); findings();
})();
