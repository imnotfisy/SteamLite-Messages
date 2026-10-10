'use strict';
// ====================== chat list ======================
const PINS = () => jget('pins', []), ARCH = () => jget('arch', {});
let CQ = '', showArch = false;
function chatsInit() {
  const s = $('#s-chats'); if (s.__init) return; s.__init = true;
  s.innerHTML = `<div class="bar"><h1 id="ctitle">Chats</h1><button class="ibtn" id="cnew" aria-label="New chat">${ic('edit', 21)}</button></div>
  <div class="search" id="csbox">${ic('search', 18)}<input id="csearch" placeholder="Search chats and messages" autocomplete="off"><button id="csx" class="hide" aria-label="Clear">${ic('x', 18)}</button></div>
  <div class="strip" id="cstrip"></div><div id="clist"></div><div id="cmsgs"></div><div id="cempty"></div>`;
  $('#cnew').onclick = newChatSheet;
  const inp = $('#csearch'), up = debounce(globalSearch, 350);
  inp.oninput = () => { CQ = inp.value.trim().toLowerCase(); $('#csx').classList.toggle('hide', !inp.value); s.__searching = !!CQ; renderChats(); up(); };
  inp.onfocus = () => { s.__searching = true; }; $('#csx').onclick = () => { inp.value = ''; inp.oninput(); inp.blur(); };
  const list = $('#clist'); let tm = 0, long = false, sx = 0, sy = 0;
  const target = (e) => e.target.closest('.crow');
  list.addEventListener('touchstart', (e) => { const r = target(e); if (!r) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; long = false; clearTimeout(tm); tm = setTimeout(() => { long = true; hp('heavy'); convSheet(r.dataset.c); }, 480); }, { passive: true });
  list.addEventListener('touchmove', (e) => { if (Math.abs(e.touches[0].clientX - sx) > 10 || Math.abs(e.touches[0].clientY - sy) > 10) clearTimeout(tm); }, { passive: true });
  list.addEventListener('touchend', () => clearTimeout(tm), { passive: true });
  list.addEventListener('click', (e) => { if (long) { long = false; return; } const r = target(e); if (r) { hp('tap'); openChat(r.dataset.c); } });
  $('#cstrip').addEventListener('click', async (e) => { const it = e.target.closest('.it'); if (!it) return; hp('tap'); const r = await api('POST', '/social/dm', { uid: it.dataset.u }); if (r.error) return toast(r.error, 'info'); openChat(r.id); });
  $('#cmsgs').addEventListener('click', (e) => { const r = e.target.closest('[data-mc]'); if (r) { hp('tap'); openChat(r.dataset.mc, { jump: +r.dataset.mid }); } });
  $('#cempty').addEventListener('click', (e) => { if (e.target.closest('#cadd')) addFriendSheet(); });
}
function stopSearch() { const i = $('#csearch'); if (i) { i.value = ''; i.blur(); i.oninput(); } }
function chatRow(c, i) {
  const f = c.kind === 'dm' ? S.byUid && S.byUid[c.peer] : null, nm = c.kind === 'dm' ? dname({ uid: c.peer, name: c.name }) : c.name, draft = (ls.get('draft:' + c.id) || '').trim(), pinned = PINS().includes(c.id);
  const av = c.kind === 'dm' ? avatar({ avatar: c.avatar, name: nm, uid: c.peer, online: f && f.online, playing: f && f.playing }, 54, { dot: true, ring2: !!(f && f.streak && f.atRisk && !f.mineToday) }) : groupAvatar(c, 54);
  const fl = f && f.streak ? `<span class="flc ${f.atRisk && !f.mineToday ? 'risk' : ''}">${ic('flame', 13, true)}${f.streak}</span>` : '';
  const l = c.last; let pv;
  if (c.typing) pv = `<span class="typ">typing...</span>`;
  else if (draft) pv = `<span style="color:var(--bad);font-weight:600">Draft:</span><span class="t ell">${esc(draft.slice(0, 80))}</span>`;
  else if (!l) pv = '<span class="mut3">No messages yet</span>';
  else pv = (l.mine ? (c.kind === 'dm' ? tick(c.pread >= l.id ? 'sn' : 'sd') : tick('sd')) : '') + (c.kind === 'group' && !l.mine && l.from ? `<span class="mut3">${esc(l.from.split(' ')[0])}:</span>` : '') + `<span class="t ell">${esc(msgPreview(l))}</span>`;
  return { k: c.id, html: `<div class="crow ${c.unread ? 'unr' : ''}" data-c="${c.id}">${av}<div class="mid"><div class="top"><span class="nm ell">${esc(nm)}</span>${fl}${c.muted ? `<span class="mi">${ic('bellOff', 14)}</span>` : ''}${pinned ? `<span class="mi">${ic('pin', 13)}</span>` : ''}<span class="tm">${listTime(l ? l.at : c.at)}</span></div><div class="pv">${pv}${c.unread ? `<span class="bd" style="margin-left:auto">${c.unread > 99 ? '99+' : c.unread}</span>` : ''}</div></div></div>` };
}
function renderChats() {
  chatsInit(); const o = S.ov; const list = $('#clist'), strip = $('#cstrip');
  if (!o) { list.innerHTML = [0, 1, 2, 3, 4].map(() => '<div class="sk" style="height:72px;margin:8px 18px"></div>').join(''); list.__init = false; list.__map = null; list.__skel = true; return; }
  if (list.__skel) { list.innerHTML = ''; list.__skel = false; list.__init = false; list.__map = null; }   // the grey placeholders are removed before the real chats appear
  const pins = PINS(), arch = ARCH(); let convs = o.convs.slice();
  const hidden = convs.filter((c) => arch[c.id] && !(c.unread && c.at > arch[c.id]));
  convs = showArch ? hidden : convs.filter((c) => !hidden.includes(c));
  if (CQ) convs = o.convs.filter((c) => (c.kind === 'dm' ? dname({ uid: c.peer, name: c.name }) : c.name).toLowerCase().includes(CQ) || (c.last && String(c.last.text).toLowerCase().includes(CQ)));
  convs.sort((a, b) => (pins.includes(b.id) ? 1 : 0) - (pins.includes(a.id) ? 1 : 0) || ((b.last ? b.last.at : b.at) - (a.last ? a.last.at : a.at)));
  // active now
  const act = !CQ && !showArch ? o.friends.filter((f) => f.online || (f.streak && f.atRisk && !f.mineToday)).sort((a, b) => (b.atRisk ? 1 : 0) - (a.atRisk ? 1 : 0) || (b.online ? 1 : 0) - (a.online ? 1 : 0)).slice(0, 14) : [];
  strip.classList.toggle('hide', !act.length);
  strip.innerHTML = act.map((f) => `<button class="it" data-u="${f.uid}"><span class="avw">${avatar(f, 56, { dot: true, ring: !!(f.streak && f.atRisk && !f.mineToday) })}${f.streak ? `<span class="fl">${ic('flame', 10, true)}${f.streak}</span>` : ''}</span><span class="n ell">${esc(dname(f).split(' ')[0])}</span></button>`).join('');
  const items = convs.map(chatRow); if (!showArch && !CQ && hidden.length) items.push({ k: '_arch', html: `<div class="crow" data-arch="1" style="color:var(--text2)"><div class="av" style="--s:54px;--g:var(--surface2)">${ic('archive', 22)}</div><div class="mid"><b>Archived chats</b><div class="pv">${hidden.length} chat${hidden.length === 1 ? '' : 's'}</div></div></div>` });
  if (showArch) items.unshift({ k: '_back', html: `<div class="crow" data-arch="1"><div class="av" style="--s:54px;--g:var(--surface2)">${ic('back', 22)}</div><div class="mid"><b>Back to chats</b></div></div>` });
  morphList(list, items, { flip: true, stagger: true, enter: 'in-anim', enterFirst: false });
  list.querySelectorAll('[data-arch]').forEach((a) => { a.onclick = (e) => { e.stopPropagation(); showArch = !showArch; hp('tap'); renderChats(); }; });
  $('#ctitle').textContent = showArch ? 'Archived' : 'Chats';
  const em = $('#cempty'); em.innerHTML = !items.length && !CQ ? `<div class="empty"><div class="big">${ic('chats', 44)}</div><h3>No chats yet</h3>Add a friend with their SteamLite code, then say hi.<br><br><button class="btn pri" id="cadd">${ic('userplus', 18)} Add a friend</button></div>` : (!items.length ? `<div class="empty"><h3>No chats found</h3>Try another name or word.</div>` : '');
  if (!CQ) $('#cmsgs').innerHTML = '';
}
async function globalSearch() {
  if (CQ.length < 2) { $('#cmsgs').innerHTML = ''; return; }
  const q = CQ, r = await api('GET', '/social/searchall?q=' + encodeURIComponent(q)); if (q !== CQ) return; const l = r.results || [];
  $('#cmsgs').innerHTML = l.length ? `<div class="sec">Messages</div>` + l.map((x) => `<div class="crow" data-mc="${x.conv}" data-mid="${x.id}"><div class="av" style="--s:46px;--g:var(--surface2)">${ic('search', 18)}</div><div class="mid"><div class="top"><span class="nm ell">${esc(x.convName)}</span><span class="tm">${listTime(x.at)}</span></div><div class="pv"><span class="t ell">${esc(x.name.split(' ')[0])}: ${esc(plain(x.text))}</span></div></div></div>`).join('') : '';
}

// ---------- chat actions ----------
function convSheet(id) {
  const c = S.ov && S.ov.convs.find((x) => x.id === id); if (!c) return; const pinned = PINS().includes(id), arch = !!ARCH()[id], nm = c.kind === 'dm' ? dname({ uid: c.peer, name: c.name }) : c.name;
  openSheet(`<div style="display:flex;align-items:center;gap:12px;padding:2px 4px 10px">${c.kind === 'dm' ? avatar({ avatar: c.avatar, name: nm, uid: c.peer }, 46) : groupAvatar(c, 46)}<b style="font-size:1.1em">${esc(nm)}</b></div>
  <button class="act" data-a="read"><span class="ai">${ic('check', 19)}</span>Mark as read</button>
  <button class="act" data-a="pin"><span class="ai">${ic('pin', 19)}</span>${pinned ? 'Unpin' : 'Pin to the top'}</button>
  <button class="act" data-a="mute"><span class="ai">${ic(c.muted ? 'bell' : 'bellOff', 19)}</span>${c.muted ? 'Unmute' : 'Mute'}</button>
  <button class="act" data-a="arch"><span class="ai">${ic('archive', 19)}</span>${arch ? 'Move back to chats' : 'Archive'}</button>`, {
    onOpen: (sh) => { sh.onclick = async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return; const k = a.dataset.a; closeSheet(); hp('tap');
      if (k === 'pin') { const p = PINS(); jset('pins', pinned ? p.filter((x) => x !== id) : p.concat(id).slice(-6)); renderChats(); toast(pinned ? 'Unpinned' : 'Pinned', 'pin'); }
      else if (k === 'arch') { const m = ARCH(); if (arch) delete m[id]; else m[id] = Date.now(); jset('arch', m); renderChats(); toast(arch ? 'Moved back' : 'Archived. It returns when someone writes.', 'archive'); }
      else if (k === 'mute') muteSheet(id, c.muted);
      else if (k === 'read') { await api('GET', '/social/conv?id=' + id); tickOverview(true); }
    }; }
  });
}
function muteSheet(id, muted) {
  if (muted) return api('POST', '/social/mute', { conv: id, on: false }).then(() => { toast('Unmuted', 'bell'); tickOverview(true); if (CH && CH.id === id) { CH.info.muted = false; paintHead(); } });
  openSheet(`<h3>Mute notifications</h3><div class="mut" style="margin:4px 0 8px">You still get the messages, just no sound or buzz.</div>${[[1, 'For 1 hour'], [8, 'For 8 hours'], [24, 'For 24 hours'], [0, 'Until I turn it back on']].map((x) => `<button class="act" data-h="${x[0]}"><span class="ai">${ic('bellOff', 19)}</span>${x[1]}</button>`).join('')}`, { onOpen: (sh) => { sh.onclick = async (e) => { const b = e.target.closest('[data-h]'); if (!b) return; closeSheet(); const h = +b.dataset.h; await api('POST', '/social/mute', h ? { conv: id, on: true, hours: h } : { conv: id, on: true }); toast('Muted', 'bellOff'); tickOverview(true); if (CH && CH.id === id) { CH.info.muted = true; paintHead(); } }; } });
}
function newChatSheet() {
  const fr = S.ov ? S.ov.friends.slice().sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || dname(a).localeCompare(dname(b))) : [];
  openSheet(`<h3>New chat</h3><button class="act acc" data-a="group"><span class="ai">${ic('users', 19)}</span>New group</button><button class="act acc" data-a="add"><span class="ai">${ic('userplus', 19)}</span>Add a friend<small>With their SteamLite code or a QR</small></button>${fr.length ? '<div class="sec" style="padding:12px 4px 4px">Friends</div>' : ''}${fr.map((f) => `<button class="act" data-u="${f.uid}">${avatar(f, 40, { dot: true })}<span class="grow">${esc(dname(f))}<small>${f.playing ? 'Playing ' + esc(f.playing.name) : f.online ? 'Online' : 'Offline'}</small></span></button>`).join('')}`, {
    onOpen: (sh) => { sh.onclick = async (e) => { const a = e.target.closest('[data-a]'), u = e.target.closest('[data-u]'); if (a) { closeSheet(); if (a.dataset.a === 'group') groupCreate(); else addFriendSheet(); } else if (u) { closeSheet(); const r = await api('POST', '/social/dm', { uid: u.dataset.u }); if (r.error) return toast(r.error, 'info'); openChat(r.id); } }; }
  });
}
// pick a chat (used for sharing and forwarding)
function pickChat(title) {
  return new Promise((res) => {
    const convs = (S.ov ? S.ov.convs : []).slice().sort((a, b) => (b.last ? b.last.at : 0) - (a.last ? a.last.at : 0)); let done = false;
    openSheet(`<h3>${esc(title)}</h3><input class="inp" id="pcq" placeholder="Search" style="margin:8px 0" autocomplete="off"><div id="pcl"></div>`, { onClose: () => { if (!done) { done = true; res(null); } }, onOpen: (sh) => {
      const draw = () => { const q = $('#pcq').value.trim().toLowerCase(); $('#pcl').innerHTML = convs.filter((c) => !q || (c.kind === 'dm' ? dname({ uid: c.peer, name: c.name }) : c.name).toLowerCase().includes(q)).map((c) => `<button class="act" data-c="${c.id}">${c.kind === 'dm' ? avatar({ avatar: c.avatar, name: c.name, uid: c.peer }, 40) : groupAvatar(c, 40)}<span class="grow">${esc(c.kind === 'dm' ? dname({ uid: c.peer, name: c.name }) : c.name)}</span></button>`).join('') || '<div class="empty">No chats found.</div>'; };
      draw(); $('#pcq').oninput = draw; sh.onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) { done = true; closeSheet(); res(b.dataset.c); } };
    } });
  });
}
