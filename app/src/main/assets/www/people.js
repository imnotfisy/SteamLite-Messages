'use strict';
// ====================== people: friends, requests, adding ======================
let PQ = '';
function peopleInit() {
  const s = $('#s-people'); if (s.__init) return; s.__init = true;
  s.innerHTML = `<div class="bar"><h1>People</h1><button class="ibtn" id="padd" aria-label="Add a friend">${ic('userplus', 21)}</button></div><div class="search">${ic('search', 18)}<input id="psearch" placeholder="Search friends" autocomplete="off"></div><div id="preq"></div><div id="pfr"></div><div id="pout"></div><div id="pempty"></div>`;
  $('#padd').onclick = addFriendSheet; $('#psearch').oninput = (e) => { PQ = e.target.value.trim().toLowerCase(); renderPeople(); };
  s.addEventListener('click', async (e) => {
    const acc = e.target.closest('[data-acc]'), dec = e.target.closest('[data-dec]'), msg = e.target.closest('[data-msg]'), row = e.target.closest('[data-f]');
    if (acc) { hp('ok'); const r = await api('POST', '/social/respond', { uid: acc.dataset.acc, accept: true }); toast(r.error || 'You are now friends!', r.error ? 'info' : 'check'); tickOverview(true); }
    else if (dec) { hp('tap'); await api('POST', '/social/respond', { uid: dec.dataset.dec, accept: false }); tickOverview(true); }
    else if (msg) { e.stopPropagation(); hp('tap'); const r = await api('POST', '/social/dm', { uid: msg.dataset.msg }); if (r.error) return toast(r.error, 'info'); go('chats'); openChat(r.id); }
    else if (row) { hp('tap'); openContact(row.dataset.f); }
  });
  let tm = 0, lp = false; s.addEventListener('touchstart', (e) => { const r = e.target.closest('[data-f]'); if (!r) return; lp = false; tm = setTimeout(() => { lp = true; hp('heavy'); friendSheet(r.dataset.f); }, 480); }, { passive: true });
  ['touchmove', 'touchend', 'touchcancel'].forEach((ev) => s.addEventListener(ev, () => clearTimeout(tm), { passive: true }));
  s.addEventListener('click', (e) => { if (lp) { lp = false; e.stopPropagation(); } }, true);
}
function statusLine(f) { return f.playing ? `<span style="color:var(--acc2)">Playing ${esc(f.playing.name)}</span>` : f.status ? esc(f.status) : f.online ? '<span style="color:var(--ok)">Online</span>' : 'Offline'; }
function friendRow(f) {
  const fl = f.streak ? `<span class="flc ${f.atRisk && !f.mineToday ? 'risk' : ''}">${ic('flame', 13, true)}${f.streak}</span>` : '';
  return { k: f.uid, html: `<div class="crow" data-f="${f.uid}">${avatar(f, 50, { dot: true })}<div class="mid"><div class="top"><span class="nm ell">${esc(dname(f))}</span>${fl}</div><div class="pv"><span class="t ell">${statusLine(f)}</span></div></div><button class="ibtn" data-msg="${f.uid}" aria-label="Message">${ic('chats', 19)}</button></div>` };
}
function renderPeople() {
  peopleInit(); const o = S.ov; if (!o) return;
  const q = PQ, fr = o.friends.filter((f) => !q || dname(f).toLowerCase().includes(q) || f.name.toLowerCase().includes(q)); const on = fr.filter((f) => f.online).sort((a, b) => dname(a).localeCompare(dname(b))), off = fr.filter((f) => !f.online).sort((a, b) => dname(a).localeCompare(dname(b)));
  const req = $('#preq'); const reqHtml = o.incoming.length ? `<div class="sec">Friend requests · ${o.incoming.length}</div>` + o.incoming.map((f) => `<div class="crow" style="cursor:default">${avatar(f, 50)}<div class="mid"><span class="nm ell">${esc(f.name)}</span><div class="pv"><span class="t">wants to be your friend</span></div></div><button class="btn sm pri" data-acc="${f.uid}">Accept</button><button class="ibtn flat" data-dec="${f.uid}" aria-label="Decline">${ic('x', 19)}</button></div>`).join('') : '';
  if (req.__h !== reqHtml) { req.__h = reqHtml; req.innerHTML = reqHtml; }
  const box = $('#pfr'); const items = []; if (on.length) items.push({ k: '_on', html: `<div class="sec">Online · ${on.length}</div>` }); on.forEach((f) => items.push(friendRow(f))); if (off.length) items.push({ k: '_off', html: `<div class="sec">Offline · ${off.length}</div>` }); off.forEach((f) => items.push(friendRow(f)));
  morphList(box, items, { flip: true, stagger: true });
  const out = $('#pout'); const oh = o.outgoing.length && !q ? `<div class="sec">Sent requests</div>` + o.outgoing.map((f) => `<div class="crow" style="cursor:default">${avatar(f, 44)}<div class="mid"><span class="nm ell">${esc(f.name)}</span></div><span class="chip">Pending</span></div>`).join('') : ''; if (out.__h !== oh) { out.__h = oh; out.innerHTML = oh; }
  $('#pempty').innerHTML = !o.friends.length && !o.incoming.length ? `<div class="empty"><div class="big">${ic('people', 44)}</div><h3>No friends yet</h3>Add someone with their SteamLite code or by scanning their QR.<br><br><button class="btn pri" onclick="addFriendSheet()">${ic('userplus', 18)} Add a friend</button></div>` : (q && !fr.length ? '<div class="empty"><h3>No friends found</h3></div>' : '');
}
function friendSheet(uid) {
  const f = S.byUid && S.byUid[uid]; if (!f) return; const A = (k, ico, t, cls) => `<button class="act ${cls || ''}" data-a="${k}"><span class="ai">${ic(ico, 19)}</span>${t}</button>`;
  openSheet(`<div style="display:flex;align-items:center;gap:12px;padding:2px 4px 10px">${avatar(f, 46, { dot: true })}<div><b style="font-size:1.1em">${esc(dname(f))}</b><div class="mut" style="font-size:.88em">${statusLine(f)}</div></div></div>${A('msg', 'chats', 'Message')}${A('prof', 'user', 'View profile')}${A('nick', 'edit', NICKS()[uid] ? 'Change nickname' : 'Set a nickname')}${A('rm', 'x', 'Remove friend', 'bad')}${A('blk', 'shield', 'Block', 'bad')}${A('rep', 'flag', 'Report', 'bad')}`, { onOpen: (sh) => { sh.onclick = async (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return; const k = a.dataset.a; closeSheet();
    if (k === 'msg') { const r = await api('POST', '/social/dm', { uid }); if (r.error) return toast(r.error, 'info'); go('chats'); openChat(r.id); }
    else if (k === 'prof') openContact(uid);
    else if (k === 'nick') { const n = await askText('Nickname for ' + f.name, NICKS()[uid] || '', 'Leave empty to remove', 24); if (n === null) return; const m = NICKS(); if (n.trim()) m[uid] = n.trim().slice(0, 24); else delete m[uid]; jset('nicks', m); toast('Saved', 'check'); renderPeople(); renderChats(); }
    else if (k === 'rm') { if (await askConfirm('Remove ' + f.name + '?', 'You can add them again later.', 'Remove', true)) { await api('POST', '/social/unfriend', { uid }); toast('Removed', 'check'); tickOverview(true); } }
    else if (k === 'blk') { if (await askConfirm('Block ' + f.name + '?', 'They are removed from your friends and cannot message you.', 'Block', true)) { await api('POST', '/social/block', { uid, on: true }); toast('Blocked', 'shield'); tickOverview(true); } }
    else if (k === 'rep') { const why = await askText('Report ' + f.name, '', 'What is wrong?', 200, true); if (why && why.trim().length > 2) { const r = await api('POST', '/social/report', { uid, reason: why.trim() }); toast(r.error || 'Thanks, we will take a look.', r.error ? 'info' : 'check'); } }
  }; } });
}

// ---------- add a friend ----------
function addFriendSheet() {
  const code = (S.me && S.me.code) || '';
  openSheet(`<h3>Add a friend</h3><div class="mut" style="margin:4px 0 12px">Ask for their SteamLite code. Yours is <b style="color:var(--text)">${esc(code)}</b>.</div><input class="inp" id="fc" placeholder="SL-XXXXXXXXXX" autocapitalize="characters" autocomplete="off" maxlength="20"><button class="btn pri wide" id="fok" style="margin-top:10px">Find player</button><div id="fres" style="margin-top:12px"></div><div style="display:flex;gap:10px;margin-top:8px"><button class="btn grow" id="fqr">${ic('qr', 18)} My QR code</button><button class="btn grow" id="fscan">${ic('search', 18)} Scan a code</button></div>`, { onOpen: () => {
    const find = async () => { const c = $('#fc').value.trim(); if (!c) return; $('#fres').innerHTML = '<div class="sk" style="height:60px"></div>'; const r = await api('POST', '/social/find', { code: c }); const f = (r.found || [])[0]; if (!f) { $('#fres').innerHTML = `<div class="mut" style="text-align:center;padding:10px">${esc(r.error || 'Nobody found with that code.')}</div>`; return; }
      $('#fres').innerHTML = `<div class="row" style="padding:8px 0">${avatar(f, 46)}<div class="rt"><b>${esc(f.name)}</b></div><button class="btn sm pri" id="fadd">Add</button></div>`; $('#fadd').onclick = async () => { const x = await api('POST', '/social/friend', { uid: f.uid }); toast(x.error || (x.status === 'accepted' ? 'You are now friends!' : 'Request sent'), x.error ? 'info' : 'check'); if (!x.error) { hp('ok'); closeSheet(); tickOverview(true); } }; };
    $('#fok').onclick = find; $('#fc').onkeydown = (e) => { if (e.key === 'Enter') find(); }; $('#fqr').onclick = () => { closeSheet(); setTimeout(qrSheet, 350); }; $('#fscan').onclick = () => { closeSheet(); scanFriendCode(); };
  } });
}
function qrSheet() {
  const code = (S.me && S.me.code) || '', url = N('qrPng', 'steamlite:add:' + code);
  openSheet(`<h3 style="text-align:center">My QR code</h3><div class="qr">${url ? `<img src="${url}" alt="QR code for ${esc(code)}">` : '<div class="empty">The QR code could not be made.</div>'}</div><div class="mut" style="text-align:center;margin:8px 0 12px">${esc(code)}</div><button class="btn wide" id="qcopy">${ic('copy', 18)} Copy code</button>`, { onOpen: () => { $('#qcopy').onclick = () => { N('copy', code); toast('Code copied', 'check'); }; } });
}
function scanFriendCode() {
  const cb = 'p' + hex(4); CB[cb] = (t) => { if (!t) return toast('Nothing scanned.', 'info'); const m = /(SL-[A-Z0-9]{6,12})/i.exec(String(t)); if (!m) return toast('That is not a SteamLite code.', 'info'); addFriendSheet(); setTimeout(() => { const i = $('#fc'); if (i) { i.value = m[1].toUpperCase(); const b = $('#fok'); if (b) b.click(); } }, 450); }; N('scanQr', cb);
}
