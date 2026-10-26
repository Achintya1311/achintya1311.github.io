/* Root page cards, parsed once and shared by Findings and Home (DD2: the root index.html is the only source). */
window.deskRoot = (() => {
  let p;
  return () => p || (p = fetch('../index.html').then(r => { if (!r.ok) throw 0; return r.text(); }).then(t => {
    const doc = new DOMParser().parseFromString(t, 'text/html');
    const cards = [...doc.querySelectorAll('#findings .card')].map((c, i) => {
      const h3 = c.querySelector('h3'), tagEl = h3.querySelector('.tag'), tag = tagEl ? tagEl.textContent : '';
      if (tagEl) tagEl.remove();
      const title = h3.textContent.trim(), st = c.querySelector('.stat'), sp = st.querySelector('span'), sub = sp.textContent.trim();
      sp.remove(); const big = st.textContent.trim();
      const note = (c.querySelector('.fig-note') || {}).textContent || '', im = c.querySelector('img'), repo = c.querySelector('.repo'), a = c.querySelector('.a');
      return { i, title, tag, big, sub, text: a ? a.textContent.trim() : '', src: im ? '../' + im.getAttribute('src') : '', alt: im ? im.alt : '', note: note.trim(), repo: repo ? repo.href : '', repoName: repo ? repo.textContent.replace('→', '').trim() : '' };
    });
    return { doc, cards };
  }));
})();
/* Desk core: theme, sidebar, hash views, filter chips, lightbox. No dependencies. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = { get: k => { try { return localStorage.getItem(k) } catch { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch {} } };
  const root = document.documentElement, shell = $('.shell');
  // theme
  const setTheme = t => { root.dataset.theme = t; $$('.theme button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === t)); store.set('desk-theme', t); };
  setTheme(store.get('desk-theme') || 'dark');
  $$('.theme button').forEach(b => b.onclick = () => setTheme(b.dataset.t));
  // sidebar
  if (store.get('desk-side') === '1') shell.classList.add('collapsed');
  $$('[data-tog]').forEach(b => { b.setAttribute('aria-expanded', String(!shell.classList.contains('collapsed'))); b.onclick = () => { shell.classList.toggle('collapsed'); store.set('desk-side', shell.classList.contains('collapsed') ? '1' : '0'); b.setAttribute('aria-expanded', String(!shell.classList.contains('collapsed'))); }; });
  // views by hash
  const show = () => {
    const v = location.hash.slice(1) || $('.view').id;
    const t = $('#' + CSS.escape(v)) && $('#' + CSS.escape(v)).classList.contains('view') ? v : $('.view').id;
    $$('.view').forEach(e => e.classList.toggle('on', e.id === t));
    $$('.nav[href^="#"]').forEach(a => { const on = a.getAttribute('href') === '#' + t; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    document.title = ($('.nav.on .lbl') ? $('.nav.on .lbl').textContent + ' · ' : '') + (shell.dataset.name || 'Desk');
    window.scrollTo(0, 0);
  };
  addEventListener('hashchange', show); show();
  // skip link: focus main without touching the hash, which drives the views
  $('.skip').onclick = e => { e.preventDefault(); $('main').focus(); };
  // chips + segmented sort, applied per feed
  const feeds = () => $$('[data-feed]');
  const apply = f => {
    const on = $('.chip[aria-pressed=true]', f.parentElement), sort = $('.seg [aria-pressed=true]', f.parentElement);
    const cat = on ? on.dataset.cat : 'all';
    $$('.card', f).forEach(c => c.hidden = cat !== 'all' && !(c.dataset.cat || '').split(' ').includes(cat));
    if (sort) { const cs = $$('.card', f); const k = sort.dataset.sort; cs.sort((a, b) => k === 'old' ? b.dataset.i - a.dataset.i : k === 'neg' ? (b.dataset.neg - a.dataset.neg) || (a.dataset.i - b.dataset.i) : a.dataset.i - b.dataset.i); cs.forEach(c => f.appendChild(c)); }
  };
  document.addEventListener('click', e => {
    const c = e.target.closest('.chip,.seg button'); if (!c) return;
    $$(c.matches('.chip') ? '.chip' : '.seg button', c.parentElement).forEach(x => x.setAttribute('aria-pressed', x === c));
    feeds().forEach(f => f.parentElement.contains(c) && apply(f));
  });
  // lightbox: any [data-lb] element; images from data-imgs ("a|b"), side panel from its .lb-side child
  const lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Finding viewer');
  lb.innerHTML = '<div class="stage"><span class="ct" role="status" aria-live="polite"></span><button class="x" aria-label="Close">✕</button><button class="nv pv" aria-label="Previous">‹</button><img alt=""><div class="noimg" hidden>Workbook: no chart for this finding</div><button class="nv nx" aria-label="Next">›</button><div class="th"></div></div><aside></aside>';
  document.body.appendChild(lb);
  let imgs = [], at = 0, opener = null, seq = [], si = 0;
  const img = $('img', lb), noimg = $('.noimg', lb);
  const load = el => {
    opener = el; imgs = (el.dataset.imgs || '').split('|').filter(Boolean); at = 0;
    const side = $('.lb-side', el), hint = (seq.length > 1 ? '← → findings · ' : imgs.length > 1 ? '← → images · ' : '') + (imgs.length ? 'click image or press Z to zoom · ' : '') + 'Esc to close';
    $('aside', lb).innerHTML = (side ? side.innerHTML : '') + '<div class="ft">' + hint + '</div>';
    $('.th', lb).innerHTML = !seq.length && imgs.length > 1 ? imgs.map((s, i) => `<button aria-label="Image ${i + 1}"><img src="${s}" alt=""></button>`).join('') : '';
    $$('.th button', lb).forEach((b, i) => b.onclick = () => { at = i; draw(); });
    draw();
  };
  const draw = () => {
    const has = imgs.length > 0; img.hidden = !has; noimg.hidden = has;
    if (has) { img.src = imgs[at]; img.classList.remove('z'); const o = opener && opener.querySelector('img'); img.alt = (o && o.alt) || 'Chart'; }
    const t = seq.length > 1 ? `${si + 1} / ${seq.length}` : imgs.length > 1 ? `${at + 1} / ${imgs.length}` : '';
    $('.ct', lb).textContent = t && seq.length > 1 ? t + ' · ' + (opener.querySelector('.open') || opener).textContent : t;
    $$('.nv', lb).forEach(b => b.hidden = (seq.length || imgs.length) < 2);
    $$('.th button', lb).forEach((b, i) => b.classList.toggle('on', i === at));
  };
  const go = d => { if (seq.length > 1) { si = (si + d + seq.length) % seq.length; load(seq[si]); } else if (imgs.length > 1) { at = (at + d + imgs.length) % imgs.length; draw(); } };
  const close = () => { lb.classList.remove('on'); shell.inert = false; document.body.style.overflow = ''; opener && opener.isConnected && opener.offsetParent && (opener.querySelector('.open') || opener).focus(); };
  addEventListener('hashchange', () => { if (lb.classList.contains('on')) close(); });
  $('.x', lb).onclick = close; $('.pv', lb).onclick = () => go(-1); $('.nx', lb).onclick = () => go(1);
  img.onclick = () => img.classList.toggle('z');
  lb.addEventListener('click', e => { if (e.target === $('.stage', lb)) close(); });
  document.addEventListener('keydown', e => { if (!lb.classList.contains('on')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.metaKey && !e.altKey && img.offsetParent) img.classList.toggle('z'); if (e.key === 'Tab') { const f = $$('button, a[href]', lb).filter(x => !x.hidden); if (!f.length) return; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } });
  // a card with data-seq steps through the visible cards of its feed; anything else steps through its own images
  window.deskOpen = el => {
    seq = el.hasAttribute('data-seq') ? $$('[data-seq]', el.parentElement).filter(x => !x.hidden) : []; si = Math.max(0, seq.indexOf(el));
    if (!seq.length && !(el.dataset.imgs || '')) return;
    load(el); lb.classList.add('on'); shell.inert = true; document.body.style.overflow = 'hidden'; $('.x', lb).focus();
  };
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-lb]:not(button)')) window.deskOpen(e.target); });
  document.addEventListener('click', e => { const c = e.target.closest('[data-lb]'); if (c && !e.target.closest('a')) window.deskOpen(c); });
  window.deskApply = () => feeds().forEach(apply);
})();
