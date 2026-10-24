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
  const lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Chart viewer');
  lb.innerHTML = '<div class="stage"><span class="ct"></span><button class="x" aria-label="Close">✕</button><button class="nv pv" aria-label="Previous">‹</button><img alt=""><button class="nv nx" aria-label="Next">›</button><div class="th"></div></div><aside></aside>';
  document.body.appendChild(lb);
  let imgs = [], at = 0, opener = null;
  const img = $('img', lb);
  const draw = () => {
    img.src = imgs[at]; img.classList.remove('z'); { const o = opener && opener.querySelector('img'); img.alt = (o && o.alt) || 'Chart'; }
    $('.ct', lb).textContent = imgs.length > 1 ? `${at + 1} / ${imgs.length}` : '';
    $$('.nv', lb).forEach(b => b.hidden = imgs.length < 2);
    $$('.th button', lb).forEach((b, i) => b.classList.toggle('on', i === at));
  };
  const go = d => { at = (at + d + imgs.length) % imgs.length; draw(); };
  const close = () => { lb.classList.remove('on'); document.body.style.overflow = ''; opener && opener.focus(); };
  $('.x', lb).onclick = close; $('.pv', lb).onclick = () => go(-1); $('.nx', lb).onclick = () => go(1);
  img.onclick = () => img.classList.toggle('z'); img.ondblclick = () => img.classList.toggle('z');
  lb.addEventListener('click', e => { if (e.target === $('.stage', lb)) close(); });
  document.addEventListener('keydown', e => { if (!lb.classList.contains('on')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); if (e.key === 'Tab') { const f = $$('button', lb).filter(x => !x.hidden); if (!f.length) return; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } });
  window.deskOpen = el => {
    opener = el; imgs = (el.dataset.imgs || '').split('|').filter(Boolean); if (!imgs.length) return; at = 0;
    const side = $('.lb-side', el); $('aside', lb).innerHTML = (side ? side.innerHTML : '') + '<div class="ft">' + (imgs.length > 1 ? '← → images · ' : '') + 'click image to zoom · Esc to close</div>';
    $('.th', lb).innerHTML = imgs.length > 1 ? imgs.map((s, i) => `<button aria-label="Image ${i + 1}"><img src="${s}" alt=""></button>`).join('') : '';
    $$('.th button', lb).forEach((b, i) => b.onclick = () => { at = i; draw(); });
    lb.classList.add('on'); document.body.style.overflow = 'hidden'; draw(); $('.x', lb).focus();
  };
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-lb]')) window.deskOpen(e.target); });
  document.addEventListener('click', e => { const c = e.target.closest('[data-lb]'); if (c && !e.target.closest('a')) window.deskOpen(c); });
  window.deskApply = () => feeds().forEach(apply);
})();
