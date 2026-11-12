/* FINISH FT3: what stands behind a pick, and one page per live rule.
   window.deskTech(t) turns the lab's per-pick `tech` block (lab picks/tech.py, FT1) into short lines of words and
   ratios; window.deskRuleKey(strategy) names the rule page (#rule-<key>) a gate or pick links to. The four rule
   views read the lab's own train replay (experiments/done/<id>/results.json) and its evidence file each time.
   Words, ranks and ratios only: no prices, levels or return claims about a stock. */
(() => {
  const RAW = 'https://raw.githubusercontent.com/Achintya1311/stockstalker-lab/main/', GH = 'https://github.com/Achintya1311/stockstalker-lab/blob/main/';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const J = async u => { const r = await fetch(u); if (!r.ok) throw new Error(u); return r.json(); };

  // the four live rules (lab FINISH "Lab decision", 10 Nov 2026); text restated from each strategy card
  const RULES = {
    t04: { name: 'Connors RSI-2', strat: 't04_connors_rsi2@v1', exp: 't04-connors-rsi2-day', hz: 'day', side: 'bullish', card: 'cards/T04.yml', diag: 'research/diagnostics/t04.md', test: 'tests/test_t04_connors_rsi2.py',
      full: ['Read from split-adjusted daily closes of every stock with an active future.', 'Bullish case: the last close is above its own 200-day simple average, and the 2-day Wilder RSI is under 10 (oversold inside an uptrend).', 'Score: (10 − RSI2) / 10, so a deeper reading ranks higher; the five highest scores make the table.', 'Anything else abstains, including the crosswise cases the original rule never states a view on.'],
      src: 'Connors and Alvarez (2009), Short Term Trading Strategies That Work.' },
    e2a: { name: 'Crowded-move reversal', strat: 'e2a_a02_crowded@v1', exp: 'e2a-day', hz: 'day', side: 'bearish', card: 'cards/E2A.yml', diag: 'research/diagnostics/a02.md', test: 'tests/test_a02_extreme_day_reversal.py',
      full: ['Base rule (A02): yesterday’s close-to-close move divided by the stock’s own volatility over the 20 sessions before it. A reading of 2 or more counts as an extreme day; the score is minus that reading, so an extreme up day scores bearish.', 'Filter (E2A): keep it only when near-month futures open interest rose on that extreme day, a crowded move. The hypothesis, fixed before the replay: crowded moves fade harder.', 'The five strongest readings make the table.'],
      src: 'Lab design, 24 Oct 2026; the open-interest reading is Indian build-up lore, tested both ways (E2A against E2B).' },
    a05b: { name: 'Max-effect rank', strat: 'a05b_max_effect_ranked@v1', exp: 'a05b-max-effect-ranked-week', hz: 'week', side: 'bullish', card: 'cards/A05B.yml', diag: 'research/diagnostics/a05b.md', test: 'tests/test_a05b_max_effect_ranked.py',
      full: ['Per stock: the largest one-day gain of the last 21 sessions, divided by the volatility of daily moves over the 60 sessions before that.', 'On each pick date that reading is ranked across all stocks and turned into a mid-rank percentile; score = 1 − 2 × percentile.', 'The least lottery-like stocks score most bullish for the coming week; the five highest scores make the table.'],
      src: 'Bali, Cakici and Whitelaw (2011), the MAX effect; the published holding period is a month, tested here at one week.' },
    a01: { name: 'Weekly reversal', strat: 'a01_weekly_reversal@v1', exp: 'a01-weekly-reversal-week', hz: 'week', side: 'bearish', card: 'cards/A01.yml', diag: 'research/diagnostics/a01.md', test: 'tests/test_a01_weekly_reversal.py',
      full: ['Per stock: the return over the last 5 trading days, through the prior Friday’s close.', 'Score = minus that return, so last week’s biggest winners score most bearish for the coming week.', 'The five strongest bearish scores make the table.'],
      src: 'Jegadeesh (1990) and Lehmann (1990), short-term reversal on US data; untested on NSE before this lab.' },
  };
  const keyOf = s => { const k = String(s || '').replace(/@v\d+$/, '').split('_')[0].toLowerCase(); return RULES[k] ? k : null; };
  window.deskRuleKey = keyOf;

  // FT1's tech block in words; a key the lab left out (short history) is skipped, never guessed
  const BAND = { oversold: 'oversold', weak: 'weak', neutral: 'neutral', firm: 'firm', overbought: 'overbought' };
  window.deskTech = t => {
    if (!t || typeof t !== 'object') return [];
    const out = [];
    if (t.trend50 && t.trend200) out.push(t.trend50 === t.trend200 ? `Trend: ${t.trend50} both its 50- and 200-day averages` : `Trend: ${t.trend50} its 50-day average, ${t.trend200} its 200-day`);
    else if (t.trend50) out.push(`Trend: ${t.trend50} its 50-day average`);
    if (typeof t.rsi14 === 'number') out.push(`14-day RSI ${t.rsi14.toFixed(0)}${BAND[t.rsi_band] ? ` (${BAND[t.rsi_band]})` : ''}`);
    if (typeof t.vol_x20 === 'number') out.push(`Volume ${t.vol_x20.toFixed(1)}× its 20-day average`);
    if (typeof t.range20 === 'number') out.push(`Close at ${Math.round(t.range20)} of 100 in its 20-day range`);
    if (typeof t.ob_dist === 'number' && t.ob_side) out.push(t.ob_dist === 0 ? `Inside the nearest ${t.ob_side} order-block zone` : `Nearest ${t.ob_side} order-block zone ${Math.round(t.ob_dist * 100)}% of the 20-day range away`);
    return out;
  };
  const FUND = 'Fundamental ranks: not shown yet. No free source covering every F&O stock is wired in, so the page shows none rather than a partial set.';
  window.deskFundLine = FUND;

  // "Behind this pick" for the Picks view: technicals, fundamentals, the rule and its train result, a link to its page
  window.deskBehind = (pick, ev, hz) => {
    const t = window.deskTech(pick && pick.tech), k = keyOf(pick && pick.strategy), R = k && RULES[k];
    const e = R && ev ? window.deskEv(ev, pick.strategy, hz, R.side) : null, f = v => (v >= 0 ? '+' : '') + (v * 100).toFixed(2);
    const rule = R ? `Rule that fired: <b>${esc(R.name)}</b>${e ? `, train edge ${f(e.mean)} pts (95% interval ${f(e.lo)} to ${f(e.hi)})` : ''}. <a href="#rule-${k}">Rule page →</a>` : `Rule that fired: ${esc(String((pick && pick.strategy) || 'not named'))}.`;
    return `<div class="bh"><b class="bh-h">Behind this pick</b>${t.length ? `<ul>${t.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p>Technical lines join from the lab’s next picks file.</p>'}<p>${esc(FUND)}</p><p>${rule}</p><p class="bh-n">Where the stock stands, not a reason to act on it.</p></div>`;
  };

  // ---------- rule pages ----------
  const pts = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(2);
  // per-year interval: picks treated as independent (sqrt(p(1-p)/n)); narrower than the honest block-bootstrap interval for the whole period
  const yi = y => { const se = Math.sqrt(Math.max(y.accuracy * (1 - y.accuracy), 0) / Math.max(y.n_picks, 1)); return [y.edge - 1.96 * se, y.edge + 1.96 * se]; };
  function years(by) {
    const W = 520, L = 46, R = 12, RH = 26, top = 10, H = top + by.length * RH + 24;
    const lo = Math.min(-0.04, ...by.map(y => yi(y)[0])), hi = Math.max(0.08, ...by.map(y => yi(y)[1]));
    const x = v => L + (v - lo) / (hi - lo) * (W - L - R);
    let s = `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Edge per train year with a rough 95% interval">`;
    for (let t = Math.ceil(lo * 50) / 50; t <= hi + 1e-9; t += 0.02) s += `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 4}" y2="${H - 20}" stroke="currentColor" opacity="${Math.abs(t) < 1e-9 ? .55 : .12}"/><text x="${x(t)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".6">${t > 1e-9 ? '+' : ''}${Math.round(t * 100)}</text>`;
    by.forEach((y, i) => { const [a, b] = yi(y), cy = top + i * RH + 10, col = y.edge > 0 ? 'var(--up)' : 'var(--down)';
      s += `<text x="${L - 8}" y="${cy + 4}" text-anchor="end" font-size="11" fill="currentColor">${y.year}</text><line x1="${x(a)}" x2="${x(b)}" y1="${cy}" y2="${cy}" stroke="${col}" stroke-width="2.2"/><circle cx="${x(y.edge)}" cy="${cy}" r="4" fill="${col}"/>`; });
    return s + '</svg>';
  }
  async function page(k) {
    const R = RULES[k], el = $(`#rb-${k}`);
    if (!el || el.dataset.done) return;
    let r = null, ev = null;
    try { [r, ev] = await Promise.all([J(`${RAW}experiments/done/${R.exp}/results.json`), window.deskEvLoad()]); } catch {}
    const m = r && r.selections && r.selections.top && r.selections.top[R.side];
    if (!m) { el.innerHTML = `<div class="empty">Could not load this rule’s train replay right now. <a href="${GH}${R.diag}">Read its diagnosis on GitHub</a>.</div>`; return; }
    const e = ev ? window.deskEv(ev, R.strat, R.hz, R.side) : null, by = m.by_year || [], pos = by.filter(y => y.edge > 0).length;
    const cost = R.side === 'bullish' ? 'delivery: 0.1% securities transaction tax on each side plus 0.015% stamp duty, and 10 basis points of slippage each way' : 'stock futures (a short is realistic only there): 0.05% securities transaction tax on the futures sale, and 10 basis points of slippage each way';
    const row = y => { const [a, b] = yi(y); return `<tr><th scope="row">${y.year}</th><td class="num">${pts(y.edge)}</td><td class="num">${pts(a)} to ${pts(b)}</td><td class="num">${Number(y.n_picks).toLocaleString('en-IN')}</td></tr>`; };
    el.dataset.done = '1';
    el.innerHTML = `
      <div class="panel"><h2>The rule in full</h2><ul class="rl">${R.full.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="note">Source: ${esc(R.src)} <a href="${GH}${R.card}">Strategy card →</a></p></div>
      <div class="panel"><h2>Train years 2015 to 2020, ${R.hz} horizon, ${R.side} picks</h2>
        <p>Edge over the market’s own base rate: <b>${pts(m.edge)} pts</b>${e ? `, 95% interval ${pts(e.lo)} to ${pts(e.hi)} (days resampled in blocks); ${e.superior ? '<span class="g">passes the many-trials check (10% level)</span>' : e.lo > 0 ? 'positive, but not after the many-trials correction' : 'not distinguishable from zero'}` : ''}. Positive in ${pos} of ${by.length} years, ${Number(m.n_picks).toLocaleString('en-IN')} picks, picks on ${Math.round(m.coverage * 100)}% of dates.</p>
        ${years(by)}
        <details class="bt"><summary>Table of this chart</summary><div class="scroll" tabindex="0" role="region" aria-label="Year table, scrolls sideways"><table><caption>Edge per train year, points</caption><thead><tr><th scope="col">Year</th><th scope="col">Edge</th><th scope="col">Rough 95% interval</th><th scope="col">Picks</th></tr></thead><tbody>${by.map(row).join('')}</tbody></table></div></details>
        <p class="note">Each year’s interval treats picks as independent, so it is narrower than the real one; the full-period interval above is the one to read. Edge is a hit rate, not a return.</p></div>
      <div class="panel"><h2>Look-ahead audit</h2><p>${m.leak_alarm ? '<span class="r">The leak alarm fired on this replay (accuracy of 70% or edge of 15 points): it stays quarantined until the shifted and shuffled re-runs clear it.</span>' : 'Passed.'} The replay hands the rule only rows strictly before the pick date, and the rule’s own causality test (<a href="${GH}${R.test}">${esc(R.test.split('/').pop())}</a>) checks that changing later data never changes an earlier score. The leak alarm (accuracy of 70% or more, or edge of 15 points or more) ${m.leak_alarm ? 'fired' : 'did not fire'}.</p></div>
      <div class="panel"><h2>Costs assumed</h2><p>Scored on ${esc(cost)}. Hits and misses are counted on the open-to-close move; costs enter the lab’s internal directional-move check, which ${m.directional_move > 0 ? 'stays above zero for this rule in the train years' : '<span class="r">is at or below zero for this rule in the train years: the picks’ moves are too small to clear costs</span>'}.</p></div>
      <div class="panel"><h2>What would falsify it</h2><ul class="rl"><li>On the unseen years (validation 2021 to 2023, then test 2024 to 2026), an edge interval that reaches zero, or a positive edge in fewer than 70% of calendar years.</li><li>Under the lab’s promotion gates: an edge under 5 points on test, a trial-corrected t under 3, fewer than 500 test picks, or a directional move at or below zero after costs.</li><li>On the live record since 2 Nov 2026: a hit rate that stays at or under the market line as picks accumulate.</li></ul><p class="note">These bars were written before the replay (lab SPEC section 4); no threshold is tuned after a result. <a href="${GH}${R.diag}">Full diagnosis →</a></p></div>`;
  }
  const route = () => { const m = location.hash.match(/^#rule-([a-z0-9]+)$/); if (m && RULES[m[1]]) page(m[1]); };
  addEventListener('hashchange', route); route();
})();
