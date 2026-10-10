'use strict';
// ====================== the conversation ======================
let CH = null; const UF = {}; let ufBusy = 0, VA = null, VID = '';
const STARS = () => jget('stars', []);
const isStar = (id) => STARS().some((s) => s.id === id);

function openChat(id, o = {}) {
  if (CH && CH.id === id && $('#chat').classList.contains('on')) { if (o.jump) jumpTo(o.jump); return; }
  stopChatTimers(); CH = { id, info: null, msgs: [], last: 0, timer: 0, firstUnread: 0, unreadN: 0, keyMap: {}, tmpSeq: 0, reply: null, edit: null, seen: new Set(), loadingOld: false, lastAct: Date.now(), initial: true, jump: o.jump || 0, lastStreak: null, sentAt: 0 };
  const el = $('#chat'); const cached = cget('conv:' + id);
  el.innerHTML = `<div class="wall"></div><div class="lhead"><button class="ibtn flat" id="cback" aria-label="Back">${ic('back', 22)}</button><button class="hbtn" id="chinfo" style="display:flex;align-items:center;gap:11px;flex:1;min-width:0;text-align:left"><span id="chav"></span><span class="ttl"><b id="chname" class="ell"></b><small id="chsub" class="ell"></small></span></button><button class="ibtn flat" id="chvid" aria-label="Video call" style="display:none">${ic('video', 22)}</button><button class="ibtn flat" id="chcall" aria-label="Voice call" style="display:none">${ic('phone', 20)}</button><button class="ibtn flat" id="chmore" aria-label="More">${ic('more', 22)}</button></div><div class="body"><div id="strkbar"></div><div id="pinbar"></div><div id="msgs"></div><button class="fab" id="fab" aria-label="Jump to latest">${ic('down', 20)}</button></div><div id="comp"></div>`;
  applyLook(); applyChatWall(); el.classList.add('on'); $('#nav').classList.add('away'); ls.set('lastChat', JSON.stringify({ id, at: Date.now() }));
  $('#cback').onclick = () => closeChat(); $('#chinfo').onclick = () => openInfo(); $('#chmore').onclick = chatMenu; $('#chcall').onclick = () => startCall(false); $('#chvid').onclick = () => startCall(true);
  bindMsgs(); buildComposer();
  if (cached && cached.msgs) { CH.info = cached.info; CH.msgs = cached.msgs; CH.last = CH.msgs.filter((m) => !m.tmp).slice(-1)[0] ? CH.msgs.filter((m) => !m.tmp).slice(-1)[0].id : 0; paintHead(); renderChat(true); }
  loadConv(true); chatPoll();
}
function closeChat() {
  if (!CH) return; stopChatTimers(); if (typeof composerClose === 'function') composerClose(); ls.del('lastChat');
  $('#chat').classList.remove('on'); $('#nav').classList.remove('away'); const id = CH.id; CH = null; if (VA) { VA.pause(); VA = null; VID = ''; }
  setTimeout(() => { if (!CH) $('#chat').innerHTML = ''; }, 480); tickOverview(true);
}
const closeChatNow = () => { if (CH) closeChat(); };
function stopChatTimers() { if (CH) clearTimeout(CH.timer); }
function chatPoll() {
  const id = CH && CH.id; if (!id) return; const idle = Date.now() - CH.lastAct, d = idle < 25000 ? 2200 : idle < 120000 ? 4500 : 9000;
  CH.timer = setTimeout(() => { if (!CH || CH.id !== id) return; if (!document.hidden) loadConv(false); chatPoll(); }, d);
}
const isDM = () => CH && CH.info && CH.info.kind === 'dm';
const peerOf = () => { const i = CH && CH.info; return i && i.kind === 'dm' ? (i.members || []).find((m) => m.uid === i.peerUid) : null; };
async function loadConv(first) {
  const id = CH && CH.id; if (!id) return;
  const r = await api('GET', '/social/conv?id=' + id + (CH.last && !first ? '&after=' + CH.last : '')); if (!CH || CH.id !== id) return;
  if (r.error) { if (first && !CH.info) { toast(r.error, 'info'); closeChat(); } return; }
  const fresh = r.messages || []; if (fresh.length || (r.typing && r.typing.length)) CH.lastAct = Date.now();
  const oldStreak = CH.info && CH.info.streak;
  if (first || !CH.info) {
    CH.info = r; CH.msgs = fresh.concat(CH.msgs.filter((m) => m.tmp));
    const mr = r.myRead || 0, fu = fresh.find((m) => m.id > mr && !m.mine && m.kind !== 'system'); CH.firstUnread = fu && fresh.indexOf(fu) > 0 ? fu.id : 0; CH.unreadN = fu ? fresh.filter((m) => m.id >= fu.id && !m.mine).length : 0;
    fresh.forEach((m) => CH.seen.add(m.id));
  } else {
    Object.assign(CH.info, { typing: r.typing, peerRead: r.peerRead, peerLast: r.peerLast, members: r.members, muted: r.muted, streak: r.streak, canSend: r.canSend, pins: r.pins, name: r.name, avatar: r.avatar });
    if (fresh.length) { const ids = new Set(CH.msgs.map((m) => m.id)); fresh.forEach((m) => { if (!ids.has(m.id)) CH.msgs.push(m); }); }
  }
  // a message of ours that was waiting is replaced by the real one without any visual jump
  CH.msgs = CH.msgs.filter((m) => !m.tmp || m.pending || !fresh.some((f) => f.mine && f.at >= m.at - 8000 && f.text === m.text && f.kind === m.kind));
  CH.msgs.sort((a, b) => (a.tmp ? 1 : 0) - (b.tmp ? 1 : 0) || a.id - b.id);
  CH.last = CH.msgs.filter((m) => !m.tmp).slice(-1)[0] ? CH.msgs.filter((m) => !m.tmp).slice(-1)[0].id : 0;
  paintHead(); streakBar(oldStreak, CH.info.streak); renderChat(first || undefined);
  if (first) { cset('conv:' + id, { info: slimInfo(CH.info), msgs: CH.msgs.filter((m) => !m.tmp).slice(-50) }); if (CH.jump) { const j = CH.jump; CH.jump = 0; setTimeout(() => jumpTo(j), 300); } if (r.hasMore === undefined) CH.info.hasMore = false; }
  // older messages may have changed (reactions, edits): refresh the loaded window now and then
  CH.polls = (CH.polls || 0) + 1; if (!first && CH.polls % 4 === 0) refreshWindow();
}
const slimInfo = (i) => ({ id: i.id, kind: i.kind, name: i.name, avatar: i.avatar, members: i.members, peerUid: i.peerUid, canSend: i.canSend, hasMore: i.hasMore, muted: i.muted, pins: i.pins, streak: i.streak, peerRead: i.peerRead, peerLast: i.peerLast, owner: i.owner, myRead: i.myRead });
async function refreshWindow() {
  const id = CH && CH.id; if (!id) return; const r = await api('GET', '/social/conv?id=' + id); if (!CH || CH.id !== id || !r.messages) return;
  const map = new Map(r.messages.map((m) => [m.id, m])); let ch = false;
  CH.msgs = CH.msgs.map((m) => { const n = map.get(m.id); if (n && JSON.stringify(n.reactions) + n.text + n.pinned + (n.poll ? JSON.stringify(n.poll) : '') !== JSON.stringify(m.reactions) + m.text + m.pinned + (m.poll ? JSON.stringify(m.poll) : '')) { ch = true; return n; } return m; });
  const gone = CH.msgs.filter((m) => !m.tmp && m.id >= (r.messages[0] ? r.messages[0].id : 0) && !map.has(m.id)); if (gone.length) { CH.msgs = CH.msgs.filter((m) => !gone.includes(m)); ch = true; }
  if (ch) renderChat();
}
async function loadOlder() {
  if (!CH || CH.loadingOld || !CH.info || !CH.info.hasMore) return; const first = CH.msgs.find((m) => !m.tmp); if (!first) return; CH.loadingOld = true; const id = CH.id, box = $('#msgs'), oh = box.scrollHeight, ot = box.scrollTop;
  const r = await api('GET', '/social/conv?id=' + id + '&before=' + first.id); CH.loadingOld = false; if (!CH || CH.id !== id || !r.messages) return;
  CH.info.hasMore = !!r.hasMore; const have = new Set(CH.msgs.map((m) => m.id)); CH.msgs = r.messages.filter((m) => !have.has(m.id)).concat(CH.msgs); r.messages.forEach((m) => CH.seen.add(m.id)); renderChat(false); box.scrollTop = ot + (box.scrollHeight - oh);
}

// ---------- header, streak and pinned bars ----------
function paintHead() {
  const i = CH && CH.info; if (!i || !$('#chname')) return; const peer = peerOf(); { const dm = i.kind === 'dm' && !!peer; $('#chcall').style.display = $('#chvid').style.display = dm ? '' : 'none'; } const f = peer ? S.byUid && S.byUid[peer.uid] : null;
  $('#chav').innerHTML = i.kind === 'dm' ? avatar({ avatar: peer && peer.avatar, name: peer ? peer.name : i.name, uid: i.peerUid, online: peer && peer.online, playing: peer && peer.playing }, 42, { dot: true }) : groupAvatar(i, 42);
  const nm = i.kind === 'dm' ? dname(peer || { name: i.name, uid: i.peerUid }) : i.name; const fl = f && f.streak ? ` <span class="flc ${f.atRisk && !f.mineToday ? 'risk' : ''}">${ic('flame', 13, true)}${f.streak}</span>` : '';
  const nmEl = $('#chname'); if (nmEl.__h !== nm + fl) { nmEl.__h = nm + fl; nmEl.innerHTML = esc(nm) + fl; }
  const typ = (i.typing || []).map((x) => x.name.split(' ')[0]); let sub, live = false;
  if (typ.length) { sub = i.kind === 'dm' ? 'typing...' : typ.slice(0, 2).join(' & ') + ' typing...'; live = true; }
  else if (i.kind === 'dm') sub = peer && peer.playing ? 'Playing ' + peer.playing.name : peer && peer.online ? 'Online' : 'Offline'; else sub = (i.members || []).length + ' members' + ((i.members || []).filter((m) => m.online).length ? ' · ' + (i.members || []).filter((m) => m.online).length + ' online' : '');
  const s = $('#chsub'); if (s.textContent !== sub) { s.textContent = sub; } s.classList.toggle('live', live);
  const pb = $('#pinbar'), pins = i.pins || []; if (pb) { const h = pins.length ? `${ic('pin', 16)}<span class="grow ell"><b>${pins.length > 1 ? pins.length + ' pinned messages' : 'Pinned'}</b> · ${esc(plain(pins[pins.length - 1].text))}</span>` : ''; if (pb.__h !== h) { pb.__h = h; pb.className = h ? 'pinbar' : ''; pb.innerHTML = h; pb.onclick = () => pins.length === 1 ? jumpTo(pins[0].id) : pinsSheet(); } }
}
function streakBar(old, nu) {
  const el = $('#strkbar'); if (!el) return; const s = isDM() ? nu : null; let h = '', cls = '';
  const nm = esc(dname(peerOf() || { name: 'them' }).split(' ')[0]);
  if (s && s.streak > 0 && s.atRisk && !s.doneToday) { cls = s.mineToday ? 'wait' : 'risk'; h = s.mineToday ? `${ic('flame', 16, true)}<span>You are done today. Waiting for ${nm} to keep the <b>${s.streak}</b>-day streak.</span>` : `${ic('flame', 16, true)}<span>Send anything to keep your <b>${s.streak}</b>-day streak alive.</span>`; }
  else if (s && s.doneToday) { cls = 'ok'; h = `${ic('flame', 16, true)}<span><b>${s.streak}</b>-day streak. Done for today!</span>`; }
  else if (s && !s.streak && (s.mineToday || s.theirsToday)) { cls = 'wait'; h = `${ic('flame', 16)}<span>${s.mineToday ? 'Waiting for ' + nm + ' to reply to start a streak.' : nm + ' messaged you. Reply to start a streak!'}</span>`; }
  if (el.__h !== cls + h) { el.__h = cls + h; el.innerHTML = h ? `<div class="sbar ${cls}">${h}</div>` : ''; }
  if (old && nu && nu.doneToday && !old.doneToday && isDM()) { const k = 'sc:' + CH.id; if (ls.get(k) !== localDay()) { ls.set(k, localDay()); setTimeout(() => celebrate(old.streak || 0, nu.streak, dname(peerOf() || {})), 500); } }
}
function pinsSheet() {
  const pins = (CH.info.pins || []).slice().reverse(); openSheet(`<h3>Pinned messages</h3>${pins.map((p) => `<button class="act" data-j="${p.id}"><span class="ai">${ic('pin', 18)}</span><span class="grow ell"><b>${esc(p.name)}</b><small class="ell">${esc(plain(p.text))}</small></span></button>`).join('')}`, { onOpen: (sh) => { sh.onclick = (e) => { const b = e.target.closest('[data-j]'); if (b) { closeSheet(); jumpTo(+b.dataset.j); } }; } });
}

// ---------- rendering ----------
function tickState(m) {
  if (m.tmp) return m.failed ? 'pend' : 'pend'; const i = CH.info; if (!i) return 'sd';
  if (i.kind === 'dm') { if (i.peerRead >= m.id && i.peerRead > 0) return 'sn'; if (i.peerLast && i.peerLast >= m.at) return 'dl'; return 'sd'; } return 'sd';
}
function waveBars(id, n = 30) { let h = hashStr(String(id)) || 7; let out = ''; for (let i = 0; i < n; i++) { h = (h * 1103515245 + 12345) >>> 0; const v = 25 + (h >>> 8) % 75; out += `<i style="height:${v}%"></i>`; } return out; }
function msgHtml(m, first, last) {
  const mine = !!m.mine, d = m.data || {}, group = CH.info && CH.info.kind === 'group';
  const meta = `<span class="meta">${m.edited ? 'edited · ' : ''}${clock(m.at)}${mine ? tick(tickState(m)) : ''}</span>`;
  let inner = '', cls = 'bub'; const q = m.replyTo ? `<div class="quote" data-j="${m.replyTo.id}"><b>${esc(m.replyTo.name)}</b><span>${esc(plain(m.replyTo.text))}</span></div>` : '';
  if (m.kind === 'image') { const src = m.dataUrl || MEDIA + (d.id || ''); cls += ' media'; const ar = d.w && d.h ? `aspect-ratio:${d.w}/${d.h};` : ''; inner = `${q}<img class="mimg" style="${ar}" data-img="${esc(src)}" src="${esc(src)}" alt="Photo" loading="lazy" decoding="async">${m.text && plain(m.text) !== 'Photo' ? `<div class="cap">${linkify(m.text)}</div>` : ''}${meta}`; }
  else if (m.kind === 'gif' && d.url) { cls += ' media'; inner = `${q}<img class="mimg gif" data-img="${esc(d.url)}" src="${esc(d.url)}" alt="GIF" loading="lazy">${meta}`; }
  else if (m.kind === 'voice') { const id = d.id || ''; inner = `${q}<div class="vm" data-vid="${esc(id)}"><button class="pl" aria-label="Play">${ic('play', 17, true)}</button><div class="wf">${waveBars(id)}</div><span class="du">${fmtDur(d.ms || 0)}</span></div>${meta}`; }
  else if (m.kind === 'game' && d.appid) inner = `${q}<a class="gcard" data-url="https://store.steampowered.com/app/${d.appid | 0}/"><img src="https://cdn.cloudflare.steamstatic.com/steam/apps/${d.appid | 0}/header.jpg" alt=""><span><b>${esc(d.name)}</b>${d.hours ? `<span style="opacity:.8;font-size:.85em">${d.hours} h played</span>` : ''}</span></a>${meta}`;
  else if (m.kind === 'poll' && d.options) { const pl = m.poll || { counts: {}, mine: null, total: 0 }; inner = `<div class="poll"><div class="q">${esc(d.q)}</div>${d.options.map((o, i) => { const n = pl.counts[i] || 0, pct = pl.total ? Math.round(n / pl.total * 100) : 0; return `<button class="po ${pl.mine === i ? 'mine' : ''}" data-gv="${m.id}|${i}" style="--w:${pct}%"><i></i><span><span>${esc(o)}</span><b>${n}</b></span></button>`; }).join('')}</div>${meta}`; }
  else if (m.kind === 'list') inner = `${q}<b>Shared game list</b><div style="opacity:.8;font-size:.9em">${esc(d.title || 'Open it on your PC or phone')}</div>${meta}`;
  else { const big = jumbo(m.text) && !m.replyTo; if (big) cls += ' big'; const u = firstUrl(m.text), p = u && UF[u]; inner = `${q}${linkify(m.text)}${p ? `<a class="lp" data-url="${esc(u)}">${p.image ? `<img src="${esc(p.image)}" alt="" onerror="this.remove()">` : ''}<div><b>${esc(p.title)}</b>${p.desc ? `<span>${esc(p.desc.slice(0, 90))}</span>` : ''}<span>${esc(p.host)}</span></div></a>` : ''}${meta}`; if (u && UF[u] === undefined) wantPreview(u); }
  if (m.pinned) cls += ' pinned';
  const rx = (m.reactions || []).length ? `<div class="reacts">${m.reactions.map((r) => `<button class="rc ${r.me ? 'me' : ''}" data-r="${esc(r.e)}">${esc(r.e)}${r.n > 1 ? ' ' + r.n : ''}</button>`).join('')}</div>` : '';
  const who = group && !mine && first ? `<div class="who">${esc(NICKS()[m.uid] || m.name)}</div>` : '';
  const mav = !mine && group ? `<div class="mav">${last ? avatar({ uid: m.uid, name: m.name, avatar: ((CH.info.members || []).find((x) => x.uid === m.uid) || {}).avatar }, 30) : ''}</div>` : '';
  return `<div class="mrow ${mine ? 'mine' : ''} ${first ? 'first' : ''} ${last ? 'last' : ''}" data-id="${m.tmp ? '' : m.id}" data-uid="${m.uid}"><svg class="swipe-r ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.reply}</svg>${mav}<div class="mcol">${who}<div class="${cls}">${inner}</div>${rx}</div></div>`;
}
function renderChat(stick) {
  const box = $('#msgs'); if (!box || !CH) return; const near = box.scrollHeight - box.scrollTop - box.clientHeight < 140, firstPaint = CH.initial; const items = []; const list = CH.msgs; let lastDay = '';
  list.forEach((m, i) => {
    const dk = new Date(m.at).toDateString(); if (dk !== lastDay) { lastDay = dk; items.push({ k: 'd' + dk, html: `<div class="dsep">${dayLabel(m.at)}</div>` }); }
    if (CH.firstUnread && m.id === CH.firstUnread) items.push({ k: 'nd', html: `<div class="newdiv">${CH.unreadN} new message${CH.unreadN === 1 ? '' : 's'}</div>` });
    const key = CH.keyMap[m.id] || (m.tmp ? 't' + m.id : 'm' + m.id);
    if (m.kind === 'system') { items.push({ k: key, html: `<div class="sys">${esc(m.text)}</div>` }); return; }
    const p = list[i - 1], n = list[i + 1]; const same = (a, b) => a && b && a.kind !== 'system' && b.kind !== 'system' && a.uid === b.uid && Math.abs(b.at - a.at) < 300000 && new Date(a.at).toDateString() === new Date(b.at).toDateString() && !(CH.firstUnread && b.id === CH.firstUnread);
    items.push({ k: key, html: msgHtml(m, !same(p, m), !same(m, n)) });
  });
  const typ = CH.info && CH.info.typing && CH.info.typing.length;
  if (typ) { const peer = isDM() ? peerOf() : null; items.push({ k: 'typing', html: `<div class="typrow">${isDM() ? '' : '<div class="mav"></div>'}<div class="typb"><i></i><i></i><i></i></div></div>` }); }
  box.classList.toggle('empty-chat', !items.length);
  const added = morphList(box, items, { enter: 'in-anim', enterFirst: false });
  CH.initial = false;
  if (firstPaint && !(box.__scrolled)) { box.__scrolled = true; if (CH.firstUnread) { const nd = $('.newdiv', box); if (nd) box.scrollTop = Math.max(0, nd.offsetTop - 90); else box.scrollTop = box.scrollHeight; } else box.scrollTop = box.scrollHeight; }
  else if (stick === true || (stick !== false && near)) { if (added && !firstPaint) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' }); else box.scrollTop = box.scrollHeight; }
  else if (added) { const mine = list.slice(-added).some((m) => !m.mine); if (mine) bumpFab(added); }
  syncVoice();
}
let fabN = 0; function bumpFab(n) { fabN += n; const f = $('#fab'); if (f) { f.classList.add('on'); let b = $('.nb', f); if (!b) { b = document.createElement('i'); b.className = 'nb'; f.appendChild(b); } b.textContent = fabN; } }

// ---------- gestures and clicks inside the message list ----------
function bindMsgs() {
  const box = $('#msgs'); let sw = null, lp = 0, lastTap = { t: 0, id: '' }; fabN = 0;
  box.onscroll = () => { const near = box.scrollHeight - box.scrollTop - box.clientHeight < 160; const f = $('#fab'); if (f) { f.classList.toggle('on', !near); if (near) { fabN = 0; const b = $('.nb', f); if (b) b.remove(); } } if (box.scrollTop < 120 && CH && CH.info && CH.info.hasMore) loadOlder(); };
  $('#fab').onclick = () => { box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' }); hp('tap'); };
  box.addEventListener('touchstart', (e) => {
    const row = e.target.closest('.mrow'); if (!row || !row.dataset.id || e.touches.length !== 1) return; sw = { row, x0: e.touches[0].clientX, y0: e.touches[0].clientY, dx: 0, on: false, mine: row.classList.contains('mine') };
    clearTimeout(lp); lp = setTimeout(() => { if (sw && !sw.on) { const id = +row.dataset.id; sw = null; hp('heavy'); msgSheet(id); } }, 460);
  }, { passive: true });
  box.addEventListener('touchmove', (e) => {
    if (!sw) return; const dx = e.touches[0].clientX - sw.x0, dy = e.touches[0].clientY - sw.y0;
    if (!sw.on) { if (Math.abs(dy) > 9 || (Math.abs(dx) > 9 && dx < 0)) { clearTimeout(lp); if (Math.abs(dy) > 9) { sw = null; return; } } if (dx > 12 && dx > Math.abs(dy) * 1.5) { sw.on = true; clearTimeout(lp); sw.row.style.transition = 'none'; } }
    if (sw && sw.on) { sw.dx = Math.max(0, Math.min(dx, 120)); const v = sw.dx < 60 ? sw.dx : 60 + (sw.dx - 60) * .25; sw.row.style.transform = `translateX(${v}px)`; const hit = sw.dx > 58; if (hit !== sw.hit) { sw.hit = hit; sw.row.classList.toggle('sw', hit); if (hit) hp('tap'); } }
  }, { passive: true });
  const end = () => { clearTimeout(lp); if (!sw) return; const s = sw; sw = null; if (s.on) { s.row.style.transition = 'transform .3s var(--ease)'; s.row.style.transform = ''; setTimeout(() => { s.row.style.transition = ''; s.row.classList.remove('sw'); }, 320); if (s.dx > 58) { const m = CH.msgs.find((x) => x.id === +s.row.dataset.id); if (m) startReply(m); } } };
  box.addEventListener('touchend', end, { passive: true }); box.addEventListener('touchcancel', end, { passive: true });
  box.addEventListener('click', (e) => {
    const t = e.target, row = t.closest('.mrow'); const id = row && row.dataset.id ? +row.dataset.id : 0;
    const url = t.closest('[data-url]'); if (url) { e.preventDefault(); N('openUrl', url.dataset.url); return; }
    const img = t.closest('[data-img]'); if (img) { const list = $$('#msgs [data-img]').map((x) => ({ src: x.dataset.img, by: (CH.msgs.find((m) => m.id === +x.closest('.mrow').dataset.id) || {}).name })); openViewer(list, $$('#msgs [data-img]').indexOf(img)); return; }
    const pl = t.closest('.vm .pl'); if (pl) { playVoice(pl.closest('.vm').dataset.vid); return; }
    const gv = t.closest('[data-gv]'); if (gv) { const [mid, opt] = gv.dataset.gv.split('|'); hp('tap'); api('POST', '/social/gvote', { msg: +mid, opt: +opt }).then(() => refreshWindow()); return; }
    const rc = t.closest('[data-r]'); if (rc && id) { toggleReaction(id, rc.dataset.r); return; }
    const q = t.closest('[data-j]'); if (q) { jumpTo(+q.dataset.j); return; }
    if (id && t.closest('.bub')) { const now = Date.now(); if (lastTap.id === id && now - lastTap.t < 320) { lastTap = { t: 0, id: '' }; toggleReaction(id, '❤️', true); hp('ok'); } else lastTap = { t: now, id }; }
  });
}
async function toggleReaction(id, emoji, onlyAdd) {
  const m = CH.msgs.find((x) => x.id === id); if (!m) return; m.reactions = m.reactions || []; let r = m.reactions.find((x) => x.e === emoji); const on = !(r && r.me); if (onlyAdd && !on) return;
  if (on) { if (r) { r.n++; r.me = true; } else m.reactions.push({ e: emoji, n: 1, me: true }); } else { r.n--; r.me = false; if (r.n <= 0) m.reactions = m.reactions.filter((x) => x !== r); }
  renderChat(false); hp('tap'); const res = await api('POST', '/social/react', { msg: id, emoji, on }); if (res.error) { toast(res.error, 'info'); refreshWindow(); }
}
async function jumpTo(id) {
  let el = $(`#msgs [data-id="${id}"]`), tries = 0;
  while (!el && tries < 6 && CH.info && CH.info.hasMore) { tries++; await loadOlder(); el = $(`#msgs [data-id="${id}"]`); }
  if (!el) return toast('That message is too far back.', 'info'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); const b = $('.bub', el); if (b) { b.classList.remove('hl'); void b.offsetWidth; b.classList.add('hl'); }
}

// ---------- voice playback ----------
function playVoice(id) {
  if (VA && VID === id) { VA.paused ? VA.play() : VA.pause(); return; } if (VA) { VA.pause(); VA = null; }
  VID = id; VA = new Audio(MEDIA + id); VA.playbackRate = +(ls.get('vspeed') || 1);
  VA.ontimeupdate = syncVoice; VA.onplay = syncVoice; VA.onpause = syncVoice; VA.onended = () => { VID = ''; syncVoice(); }; VA.onerror = () => toast('Could not play that message', 'info');
  VA.play().catch(() => toast('Could not play that message', 'info'));
}
function syncVoice() {
  $$('#msgs .vm').forEach((v) => { const on = VA && VID === v.dataset.vid, p = on && VA.duration ? VA.currentTime / VA.duration : 0, bars = v.querySelectorAll('.wf i'), n = Math.round(p * bars.length); bars.forEach((b, i) => b.classList.toggle('p', on && i < n)); const btn = $('.pl', v); const want = on && !VA.paused ? 'pause' : 'play'; if (btn.__s !== want) { btn.__s = want; btn.innerHTML = ic(want, 17, true); } });
}

// ---------- link previews ----------
function wantPreview(u) { if (UF[u] !== undefined || ufBusy > 2 || prefs().preview === false || prefs().dsave === '1') return; UF[u] = null; ufBusy++; api('GET', '/social/unfurl?u=' + encodeURIComponent(u)).then((r) => { ufBusy--; UF[u] = r && r.ok ? r : false; if (CH) renderChat(false); }); }

// ---------- message menu ----------
function msgSheet(id) {
  const m = CH.msgs.find((x) => x.id === id); if (!m || m.tmp) return; const mine = !!m.mine, QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏'], my = new Set((m.reactions || []).filter((r) => r.me).map((r) => r.e));
  const A = (k, ico, t, cls) => `<button class="act ${cls || ''}" data-a="${k}"><span class="ai">${ic(ico, 19)}</span>${t}</button>`;
  openSheet(`<div class="emoji-row">${QUICK.map((e) => `<button data-e="${e}" class="${my.has(e) ? 'me' : ''}">${e}</button>`).join('')}<button data-e="+" style="font-size:1.3em;background:var(--surface2)">${ic('plus', 22)}</button></div>${m.kind !== 'poll' ? '' : ''}
  ${A('reply', 'reply', 'Reply')}${m.kind === 'text' ? A('copy', 'copy', 'Copy text') : ''}${m.kind !== 'poll' && m.kind !== 'system' ? A('fwd', 'fwd', 'Forward') : ''}${A('star', 'star', isStar(id) ? 'Remove star' : 'Star')}${A('pin', 'pin', m.pinned ? 'Unpin' : 'Pin')}${mine && m.kind === 'text' ? A('edit', 'edit', 'Edit') : ''}${mine ? A('del', 'trash', 'Delete', 'bad') : A('rep', 'flag', 'Report', 'bad')}
  <div class="mut3" style="text-align:center;font-size:.8em;margin-top:6px">${new Date(m.at).toLocaleString()}${mine && isDM() ? ' · ' + ({ sn: 'Seen', dl: 'Delivered', sd: 'Sent' })[tickState(m)] : ''}</div>`, {
    onOpen: (sh) => { sh.onclick = async (e) => {
      const em = e.target.closest('[data-e]'), a = e.target.closest('[data-a]');
      if (em) { closeSheet(); if (em.dataset.e === '+') return emojiSheet(id); return toggleReaction(id, em.dataset.e); }
      if (!a) return; const k = a.dataset.a; closeSheet(); hp('tap');
      if (k === 'reply') startReply(m); else if (k === 'copy') { N('copy', m.text); toast('Copied', 'check'); }
      else if (k === 'fwd') forwardMsg(m); else if (k === 'star') toggleStar(m);
      else if (k === 'pin') { const r = await api('POST', '/social/pin', { id, on: !m.pinned }); if (r.error) toast(r.error, 'info'); else { m.pinned = !m.pinned; refreshWindow(); loadConv(false); } }
      else if (k === 'edit') startEdit(m);
      else if (k === 'del') { if (await askConfirm('Delete this message?', 'It is removed for everyone in the chat.', 'Delete', true)) { const r = await api('POST', '/social/delete', { id }); if (r.error) toast(r.error, 'info'); else { CH.msgs = CH.msgs.filter((x) => x.id !== id); renderChat(false); } } }
      else if (k === 'rep') { const why = await askText('Report this message', '', 'What is wrong with it?', 200, true); if (why && why.trim().length > 2) { const r = await api('POST', '/social/report', { uid: m.uid, conv: CH.id, msgId: id, reason: why.trim() }); toast(r.error || 'Thanks, we will take a look.', r.error ? 'info' : 'check'); } }
    }; }
  });
}
function emojiSheet(id) {
  const ALL = ['😀', '😂', '🥹', '😍', '🥰', '😎', '🤩', '😭', '😡', '🤯', '🥳', '😴', '🤔', '🙄', '😬', '🫡', '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '👀', '🔥', '💯', '❤️', '💔', '💜', '🎉', '✅', '❌', '🎮', '👑', '⭐', '⚡', '🍕', '☕', '🎧', '🏆'];
  openSheet(`<h3>React</h3><div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px;margin-top:8px">${ALL.map((e) => `<button data-e="${e}" style="font-size:1.7em;height:46px;border-radius:12px">${e}</button>`).join('')}</div>`, { onOpen: (sh) => { sh.onclick = (e) => { const b = e.target.closest('[data-e]'); if (b) { closeSheet(); toggleReaction(id, b.dataset.e); } }; } });
}
function toggleStar(m) { let s = STARS(); if (isStar(m.id)) { s = s.filter((x) => x.id !== m.id); toast('Star removed', 'star'); } else { const i = CH.info || {}, p = peerOf(); s.unshift({ id: m.id, conv: CH.id, cn: i.kind === 'group' ? i.name : dname(p || { name: i.name }), name: m.name, text: m.kind === 'text' ? m.text : '[' + m.kind + ']', at: m.at }); toast('Starred', 'star'); } jset('stars', s.slice(0, 300)); hp('ok'); }
async function forwardMsg(m) {
  const cid = await pickChat('Forward to...'); if (!cid) return; const d = m.data || {}; let body;
  if (m.kind === 'text') body = { conv: cid, text: m.text }; else if (m.kind === 'image') body = { conv: cid, kind: 'image', text: m.text, data: { id: d.id, w: d.w, h: d.h } }; else if (m.kind === 'voice') body = { conv: cid, kind: 'voice', data: { id: d.id, ms: d.ms } }; else if (m.kind === 'gif') body = { conv: cid, kind: 'gif', data: d }; else if (m.kind === 'game') body = { conv: cid, kind: 'game', data: d }; else body = { conv: cid, text: m.text || '' };
  const r = await api('POST', '/social/send', body); toast(r.error || 'Forwarded', r.error ? 'info' : 'fwd'); if (!r.error) hp('ok');
}
function chatMenu() {
  const i = CH.info || {}, A = (k, ico, t, sm) => `<button class="act" data-a="${k}"><span class="ai">${ic(ico, 19)}</span><span>${t}${sm ? `<small>${sm}</small>` : ''}</span></button>`;
  openSheet(`${A('info', i.kind === 'group' ? 'users' : 'user', i.kind === 'group' ? 'Group info' : 'Contact info')}${A('search', 'search', 'Search in chat')}${A('media', 'image', 'Photos and media')}${A('mute', i.muted ? 'bell' : 'bellOff', i.muted ? 'Unmute' : 'Mute notifications')}${A('colour', 'palette', 'Chat colour and wallpaper')}${A('sched', 'clock', 'Scheduled messages')}${A('stars', 'star', 'Starred messages')}${A('export', 'download', 'Export chat as text')}`, { onOpen: (sh) => { sh.onclick = (e) => { const a = e.target.closest('[data-a]'); if (!a) return; const k = a.dataset.a; closeSheet(); ({ info: openInfo, search: searchInChat, media: () => openGallery(CH.id), mute: () => muteSheet(CH.id, i.muted), colour: chatLook, sched: scheduledList, stars: openStarred, export: exportChat })[k](); }; } });
}
function searchInChat() {
  pushPage('csearch', 'Search in chat', (b) => {
    b.innerHTML = `<div class="search" style="margin-top:12px">${ic('search', 18)}<input id="sq" placeholder="Search messages" autocomplete="off"></div><div id="sr"></div>`; const inp = $('#sq', b); setTimeout(() => inp.focus(), 380);
    inp.oninput = debounce(async () => { const q = inp.value.trim(); if (q.length < 2) { $('#sr', b).innerHTML = ''; return; } const r = await api('GET', '/social/search?conv=' + CH.id + '&q=' + encodeURIComponent(q)); const l = r.results || []; $('#sr', b).innerHTML = l.length ? l.map((x) => `<div class="crow" data-j="${x.id}"><div class="av" style="--s:42px;--g:var(--surface2)">${ic('search', 17)}</div><div class="mid"><div class="top"><b class="nm ell">${esc(x.name)}</b><span class="tm">${new Date(x.at).toLocaleDateString()}</span></div><div class="pv"><span class="t ell">${esc(plain(x.text))}</span></div></div></div>`).join('') : '<div class="empty"><h3>Nothing found</h3></div>'; }, 350);
    b.onclick = (e) => { const r = e.target.closest('[data-j]'); if (r) { closeAllPages(); setTimeout(() => jumpTo(+r.dataset.j), 450); } };
  });
}
function openStarred() {
  pushPage('stars', 'Starred messages', (b) => {
    const draw = () => { const s = STARS(); b.innerHTML = s.length ? s.map((x) => `<div class="crow" data-c="${esc(x.conv)}" data-m="${x.id}"><div class="av" style="--s:42px;--g:var(--surface2)">${ic('star', 17)}</div><div class="mid"><div class="top"><b class="nm ell">${esc(x.cn)}</b><span class="tm">${new Date(x.at).toLocaleDateString()}</span></div><div class="pv"><span class="t ell">${esc(x.name.split(' ')[0])}: ${esc(plain(x.text))}</span></div></div><button class="ibtn flat" data-u="${x.id}" aria-label="Remove">${ic('x', 18)}</button></div>`).join('') : `<div class="empty"><div class="big">${ic('star', 40)}</div><h3>No starred messages</h3>Press and hold a message, then tap Star, to keep it here.</div>`; };
    draw(); b.onclick = (e) => { const u = e.target.closest('[data-u]'); if (u) { e.stopPropagation(); jset('stars', STARS().filter((x) => String(x.id) !== u.dataset.u)); draw(); return; } const r = e.target.closest('[data-c]'); if (r) { closeAllPages(); go('chats'); openChat(r.dataset.c, { jump: +r.dataset.m }); } };
  });
}
function chatLook() {
  const id = CH.id, cur = ls.get('cw:' + id) || '', p = prefs();
  openSheet(`<h3>Chat wallpaper</h3><div class="mut" style="margin-bottom:8px">Only for this chat, only on your phone.</div><div class="seg" id="cwseg" style="margin:0 0 4px">${[['', 'Default'], ...WALLS].map((w) => `<button data-w="${w[0]}" class="${cur === w[0] ? 'on' : ''}">${w[1]}</button>`).join('')}</div>`, { onOpen: (sh) => { sh.onclick = (e) => { const b = e.target.closest('[data-w]'); if (!b) return; if (b.dataset.w) ls.set('cw:' + id, b.dataset.w); else ls.del('cw:' + id); applyChatWall(); $$('#cwseg button').forEach((x) => x.classList.toggle('on', x === b)); hp('tap'); }; } });
}
function applyChatWall() { const el = $('#chat'); if (!el || !CH) return; const w = ls.get('cw:' + CH.id) || prefs().wall; el.className = el.className.replace(/\bw-\w+/g, '').trim() + ' w-' + w; }
async function exportChat() {
  const info = CH.info || {}, peer = peerOf(), title = info.kind === 'group' ? info.name : dname(peer || { name: info.name }); toast('Collecting messages...', 'download'); let all = CH.msgs.filter((m) => !m.tmp), pages = 0, more = info.hasMore;
  while (more && pages < 15) { pages++; const r = await api('GET', '/social/conv?id=' + CH.id + '&before=' + all[0].id); const l = r.messages || []; if (!l.length) break; all = l.concat(all); more = !!r.hasMore; }
  const lines = all.map((m) => { const d = new Date(m.at); const body = m.kind === 'text' ? m.text : m.kind === 'image' ? '[photo]' : m.kind === 'gif' ? '[GIF]' : m.kind === 'voice' ? '[voice message]' : m.kind === 'game' ? '[game: ' + ((m.data || {}).name) + ']' : m.kind === 'poll' ? '[poll]' : m.text; return `[${d.toLocaleDateString()} ${clock(m.at)}] ${m.mine ? 'Me' : m.name}: ${body}`; });
  N('shareText', 'SteamLite chat with ' + title, `SteamLite chat with ${title}\n${lines.length} messages\n\n${lines.join('\n')}`);
}
