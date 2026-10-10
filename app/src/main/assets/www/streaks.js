'use strict';
// ====================== streaks ======================
const MILES = [3, 7, 14, 30, 50, 100, 200, 365, 500, 1000];
const nextMile = (n) => MILES.find((m) => m > n) || n + 100, prevMile = (n) => [0].concat(MILES).filter((m) => m <= n).pop();
let STREAKPG = null;
function openStreaksPage() {
  if (STREAKPG) return;
  STREAKPG = pushPage('streaks', 'Streaks', (b, page) => {
    b.innerHTML = '<div id="shero"></div><div id="slist"></div><div id="sempty"></div>';
    b.addEventListener('click', async (e) => { const r = e.target.closest('[data-u]'); if (!r) return; hp('tap'); const x = await api('POST', '/social/dm', { uid: r.dataset.u }); if (x.error) return toast(x.error, 'info'); closeAllPages(); go('chats'); openChat(x.id); });
    page.onClose = () => { STREAKPG = null; };
  });
  setTimeout(renderStreaks, 0);
}
function streakRow(f, kind) {
  const n = f.streak || 0, nm = nextMile(n), pm = prevMile(n), pct = n ? Math.min(100, Math.round((n - pm) / (nm - pm) * 100)) : 0;
  const state = kind === 'risk' ? `<span class="chip bad">Your turn</span>` : kind === 'wait' ? `<span class="chip">Waiting for them</span>` : kind === 'done' ? `<span class="chip ok">Done today</span>` : `<span class="chip">Start one</span>`;
  return { k: kind + f.uid, html: `<div class="crow" data-u="${f.uid}">${avatar(f, 54, { dot: true, ring: kind === 'risk' })}<div class="mid"><div class="top"><span class="nm ell">${esc(dname(f))}</span><span class="tm">${state}</span></div>${n ? `<div class="pv" style="gap:10px"><span class="flc ${kind === 'risk' ? 'risk' : ''}" style="font-size:1em">${ic('flame', 16, true)}${n} day${n === 1 ? '' : 's'}</span><span style="flex:1;height:5px;border-radius:3px;background:var(--surface3);overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,var(--flame),var(--bad));border-radius:3px;transition:width .6s var(--ease)"></i></span><span class="mut3" style="font-size:.78em">${nm}</span></div>` : '<div class="pv"><span class="t">Message each other every day to build a streak.</span></div>'}</div></div>` };
}
function renderStreaks() {
  if (!STREAKPG || !$('#shero')) return; const o = S.ov; if (!o) return; const fr = o.friends;
  const act = fr.filter((f) => f.streak > 0), risk = act.filter((f) => f.atRisk && !f.mineToday).sort((a, b) => b.streak - a.streak), wait = act.filter((f) => f.atRisk && f.mineToday).sort((a, b) => b.streak - a.streak), done = act.filter((f) => !f.atRisk || f.doneToday).filter((f) => !risk.includes(f) && !wait.includes(f)).sort((a, b) => b.streak - a.streak);
  const idea = fr.filter((f) => !f.streak).sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)).slice(0, 6), best = Math.max(0, ...fr.map((f) => f.best || f.streak || 0));
  $('#shero').innerHTML = `<div class="hero"><div style="display:flex;align-items:center;gap:14px"><div style="width:62px;height:62px;border-radius:22px;background:rgba(255,255,255,.2);display:grid;place-items:center">${ic('flame', 34, true)}</div><div><h2>${act.length} streak${act.length === 1 ? '' : 's'}</h2><p>${risk.length ? risk.length + ' need' + (risk.length === 1 ? 's' : '') + ' you today' : act.length ? 'All caught up for today' : 'Start one by chatting daily'}${best ? ' · best ' + best + ' days' : ''}</p></div></div></div>`;
  const items = [];
  const sec = (k, t, l, kind) => { if (!l.length) return; items.push({ k: '_' + k, html: `<div class="sec">${t}</div>` }); l.forEach((f) => items.push(streakRow(f, kind))); };
  sec('risk', 'Needs you today', risk, 'risk'); sec('wait', 'Waiting on them', wait, 'wait'); sec('done', 'Done for today', done, 'done'); sec('idea', 'Start a new one', idea, 'new');
  morphList($('#slist'), items, { flip: true, stagger: true });
  $('#sempty').innerHTML = items.length ? '' : `<div class="empty"><div class="big">${ic('flame', 44)}</div><h3>No streaks yet</h3>Message a friend two days in a row (both of you) and your streak begins.</div>`;
}
