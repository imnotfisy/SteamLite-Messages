'use strict';
// ====================== shell: tabs, polling, notifications, back, share ======================
const TABS = [['chats', 'Chats', 'chats'], ['people', 'People', 'people'], ['status', 'Status', 'smile'], ['settings', 'Settings', 'cog']];
function buildNav() {
  const nav = $('#nav'); nav.innerHTML = '<i class="pill"></i>' + TABS.map((t) => `<button data-t="${t[0]}" aria-label="${t[1]}">${ic(t[2], 23)}<span>${t[1]}</span><i class="badge" id="bd-${t[0]}"></i></button>`).join('');
  nav.onclick = (e) => { const b = e.target.closest('button'); if (b) { if (b.dataset.t === S.tab) { const sc = $('#s-' + S.tab); sc.scrollTo({ top: 0, behavior: 'smooth' }); } else { hp('tap'); go(b.dataset.t); } } };
}
function movePill() {
  const b = $(`#nav button[data-t="${S.tab}"]`), p = $('#nav .pill'); if (!b || !p) return; const nr = $('#nav').getBoundingClientRect(), r = b.getBoundingClientRect();
  p.style.width = (r.width) + 'px'; p.style.transform = `translateX(${r.left - nr.left - 6}px)`;
}
function go(tab) {
  if (!TABS.some((t) => t[0] === tab)) tab = 'chats'; const prev = S.tab; S.tab = tab; ls.set('tab', tab);
  $$('#screens .screen').forEach((s) => s.classList.toggle('on', s.id === 's-' + tab)); $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab)); movePill();
  ({ chats: renderChats, people: renderPeople, status: renderStatus, settings: renderSettings })[tab]();
}
function setBadge(id, n) { const b = $('#bd-' + id); if (!b) return; b.textContent = n > 99 ? '99+' : n; b.classList.toggle('on', n > 0); }
function updateBadges() {
  const o = S.ov; if (!o) return; setBadge('chats', o.unread || 0); setBadge('people', (o.incoming || []).length);
  const risk = (o.friends || []).filter((f) => f.atRisk && !f.mineToday).length; setBadge('settings', risk);
}

// ---------- data: overview polling ----------
let lastUnread = {}, firstOv = true;
async function tickOverview(force) {
  if (!S.me || (document.hidden && !force)) return;
  const o = await api('GET', '/social/overview'); if (!o.friends) return;
  const prev = S.ov; S.ov = o; S.me.uid = o.me.uid; cset('ov', o); S.byUid = {}; o.friends.forEach((f) => { S.byUid[f.uid] = f; });
  // new messages in other chats: show a banner inside the app
  if (!firstOv) o.convs.forEach((c) => { const was = lastUnread[c.id] || 0; if (c.unread > was && !c.muted && !(CH && CH.id === c.id) && !c.typing) { const pf = c.kind === 'dm' ? S.byUid[c.peer] : null; showBanner({ u: { avatar: c.avatar, name: c.name, uid: c.peer }, title: c.kind === 'group' ? c.name : dname(pf || { name: c.name, uid: c.peer }), text: (c.kind === 'group' && c.last && c.last.from ? c.last.from + ': ' : '') + msgPreview(c.last), tap: () => { go('chats'); openChat(c.id); } }); } });
  lastUnread = {}; o.convs.forEach((c) => { lastUnread[c.id] = c.unread; }); firstOv = false;
  updateBadges(); widgets(o);
  if (S.tab === 'chats') renderChats(); else if (S.tab === 'people') renderPeople(); else if (S.tab === 'status') renderStatus(); else if (S.tab === 'settings') renderSettings();
  if (typeof STREAKPG !== 'undefined' && STREAKPG) renderStreaks();
  if (typeof onOverview === 'function') onOverview(prev, o);
}
function widgets(o) {
  const u1 = o.convs.filter((c) => c.unread > 0)[0]; N('setWidget', o.unread || 0, u1 ? u1.name : '', u1 && u1.last ? msgPreview(u1.last) : '');
  const best = Math.max(0, ...o.friends.map((f) => f.streak || 0)); N('setStreakWidget', best, o.friends.some((f) => f.streak && f.doneToday));
}
function msgPreview(l) { if (!l) return ''; const k = l.kind; return k === 'image' ? 'Photo' : k === 'voice' ? 'Voice message' : k === 'gif' ? 'GIF' : k === 'game' ? 'Shared a game' : k === 'poll' ? 'Poll' : plain(l.text); }
let pollT = 0;
function startPolling() { clearInterval(pollT); pollT = setInterval(() => tickOverview(), 7000); tickOverview(true); presence(); setInterval(presence, 60000); }
function presence() { if (S.tok && S.me && !document.hidden && prefs().presence !== false) api('POST', '/social/presence', { game: null }); }
window.onResumeApp = () => { if (S.tok) { tickOverview(true); presence(); if (CH && CH.id) loadConv(false); notifCheck(); } if (Date.now() - +(ls.get('updAt') || 0) > 6 * 3600000) checkUpdate(false); };

// ---------- notification permission nudge ----------
function notifState() { try { return JSON.parse(N('notifState') || '{}'); } catch (e) { return {}; } }
function notifCheck() { const s = notifState(); if ((s.permission === false || s.enabled === false) && ls.get('nudge') !== localDay()) { ls.set('nudge', localDay()); openSheet(`<div class="empty" style="padding:22px 10px 8px"><div class="big">${ic('bell', 40)}</div><h3>Don't miss a message</h3>Notifications are off, so new messages will only show up when you open the app.</div><button class="btn pri wide" id="nn1">Turn on notifications</button><button class="btn wide" id="nn2" style="margin-top:8px">Not now</button>`, { onOpen: () => { $('#nn1').onclick = () => { closeSheet(); CB.notif = () => { }; N('askNotif'); }; $('#nn2').onclick = closeSheet; } }); } }

// ---------- back button / gesture ----------
window.onBack = () => {
  if (typeof callBack === 'function' && callBack()) return true;
  if ($('#viewer').classList.contains('on')) { closeViewer(); return true; }
  if (dlgRes) { dlgRes(null); return true; }
  if (closeSheet()) return true;
  if (typeof composerBack === 'function' && composerBack()) return true;
  if (PGS.length) { closePage(); return true; }
  if (CH && CH.id && $('#chat').classList.contains('on')) { closeChat(); return true; }
  if (S.tab === 'chats' && $('#s-chats').__searching) { stopSearch(); return true; }
  if (S.tab !== 'chats') { go('chats'); return true; }
  return false;
};

// ---------- opening things from notifications, shortcuts and the share sheet ----------
window.openFromNotif = (target) => {
  target = String(target || ''); if (!S.tok) return;
  if (target.startsWith('call:')) { const p = target.split(':'); callFromNotif(p[1], p[2] === 'accept'); return; }
  if (target === '#friends' || target === '#addfriend') { closeChatNow(); go('people'); if (target === '#addfriend') setTimeout(addFriendSheet, 400); return; }
  if (target === '#tab:streaks') { go('settings'); setTimeout(openStreaksPage, 250); return; }
  if (target.startsWith('#tab:')) { go(target.slice(5)); return; }
  if (/^[dg][a-f0-9]{8,}$/.test(target)) { go('chats'); openChat(target); return; }
};
window.onShare = async (json) => {
  let s = null; try { s = JSON.parse(json); } catch (e) { } if (!s || !S.tok) return;
  const cid = await pickChat(s.kind === 'image' ? 'Send this photo to...' : 'Send this to...'); if (!cid) return;
  if (s.kind === 'image' && s.data) { toast('Sending...'); const u = await api('POST', '/media', { mime: s.mime, data: s.data }); if (!u.ok) return toast(u.error || 'Could not upload the photo'); const r = await api('POST', '/social/send', { conv: cid, kind: 'image', text: 'Photo', data: { id: u.id, w: s.w, h: s.h } }); toast(r.error || 'Sent', r.error ? 'info' : 'check'); }
  else if (s.text) { const r = await api('POST', '/social/send', { conv: cid, text: s.text }); toast(r.error || 'Sent', r.error ? 'info' : 'check'); }
  go('chats'); openChat(cid);
};
window.lockUi = (on) => $('#lock').classList.toggle('on', !!on);
$('#unlockbtn').onclick = () => N('unlock');

// ---------- the viewer (photos): pinch to zoom, double tap, drag to dismiss ----------
let VW = { list: [], i: 0, scale: 1, x: 0, y: 0 };
function openViewer(list, i) {
  VW = { list, i: i || 0, scale: 1, x: 0, y: 0 }; const v = $('#viewer'); drawViewer(); v.classList.add('on'); hp('tap');
}
function drawViewer() {
  const v = $('#viewer'), it = VW.list[VW.i]; if (!it) return;
  v.innerHTML = `<img src="${esc(it.src)}" alt="Photo"><button class="vb vc" aria-label="Close">${ic('x', 22)}</button><button class="vb vs" aria-label="Save">${ic('download', 22)}</button><div class="vn">${VW.list.length > 1 ? (VW.i + 1) + ' / ' + VW.list.length : ''}${it.by ? (VW.list.length > 1 ? ' · ' : '') + esc(it.by) : ''}</div>`;
  $('.vc', v).onclick = (e) => { e.stopPropagation(); closeViewer(); }; $('.vs', v).onclick = (e) => { e.stopPropagation(); N('saveImage', it.src, 'steamlite-messages'); toast('Saved to your Pictures', 'check'); };
  const img = $('img', v); let t0 = null, pinch = null, tap = 0;
  const apply = (anim) => { img.classList.toggle('drag', !anim); img.style.transform = `translate(${VW.x}px,${VW.y}px) scale(${VW.scale})`; };
  const dist = (e) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  v.ontouchstart = (e) => { if (e.touches.length === 2) { pinch = { d: dist(e), s: VW.scale }; t0 = null; } else if (e.touches.length === 1) { t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, bx: VW.x, by: VW.y, t: Date.now() }; } };
  v.ontouchmove = (e) => {
    if (pinch && e.touches.length === 2) { VW.scale = Math.max(1, Math.min(5, pinch.s * dist(e) / pinch.d)); apply(false); return; }
    if (t0 && e.touches.length === 1) { const dx = e.touches[0].clientX - t0.x, dy = e.touches[0].clientY - t0.y; if (VW.scale > 1) { VW.x = t0.bx + dx; VW.y = t0.by + dy; } else { VW.x = dx * .6; VW.y = dy; v.style.background = `rgba(0,0,0,${Math.max(.2, .96 - Math.abs(dy) / 500)})`; } apply(false); }
  };
  v.ontouchend = (e) => {
    if (pinch) { pinch = null; if (VW.scale < 1.05) { VW.scale = 1; VW.x = VW.y = 0; } apply(true); return; }
    if (!t0) return; const dx = (e.changedTouches[0].clientX - t0.x), dy = (e.changedTouches[0].clientY - t0.y), dt = Date.now() - t0.t; v.style.background = '';
    if (VW.scale === 1) {
      if (Math.abs(dy) > 120 && Math.abs(dy) > Math.abs(dx)) return closeViewer();
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) && VW.list.length > 1) { const n = VW.i + (dx < 0 ? 1 : -1); if (n >= 0 && n < VW.list.length) { VW.i = n; VW.x = VW.y = 0; hp('tap'); return drawViewer(); } }
      VW.x = VW.y = 0;
    }
    if (dt < 250 && Math.abs(dx) < 8 && Math.abs(dy) < 8) { if (Date.now() - tap < 300) { VW.scale = VW.scale > 1 ? 1 : 2.5; VW.x = VW.y = 0; tap = 0; } else tap = Date.now(); }
    apply(true);
  };
  v.onclick = (e) => { if (e.target === v) closeViewer(); };
}
function closeViewer() { const v = $('#viewer'); v.classList.remove('on'); v.style.background = ''; setTimeout(() => { if (!v.classList.contains('on')) v.innerHTML = ''; }, 320); }

// ---------- celebration (streak went up) ----------
function celebrate(from, to, name) {
  const el = $('#cele'); const MILE = { 3: 'Three days in a row', 7: 'A whole week', 14: 'Two weeks strong', 30: 'A full month', 50: 'Fifty days', 100: 'One hundred days', 200: 'Two hundred days', 365: 'A whole year' };
  el.innerHTML = `<div class="cc"><div class="fire"><b></b>${ic('flame', 84, true)}</div><div class="num"><span class="o">${from}</span><span class="n">${to}</span></div><div class="lbl">day streak</div><div class="sub2">${esc(MILE[to] ? MILE[to] + (name ? ' with ' + name : '') + '!' : name ? 'You and ' + name + ' kept it going' : 'Kept going')}</div></div>`;
  el.classList.add('on'); hp('ok'); setTimeout(() => hp('tap'), 700); const close = () => { el.classList.remove('on'); }; el.onclick = close; setTimeout(close, 3400);
}
