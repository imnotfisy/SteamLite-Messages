'use strict';
// ====================== composer: text, photos, GIFs, voice, polls, scheduled ======================
let OUTQ = jget('outq', []), flushing = false, REC = null;
const saveQ = () => jset('outq', OUTQ.slice(-30));
const DEF_QR = ['On my way', 'Give me 5 minutes', 'Sounds good', 'Thanks!', "Can't talk right now", 'Want to play something?'];
const QR = () => jget('qr', DEF_QR);

function buildComposer() {
  const c = $('#comp'); const i = CH.info;
  c.innerHTML = `<div id="rbar"></div><div class="cbar" id="cbar"><div class="cin"><button class="cbtn" id="cat" aria-label="Attach">${ic('plus', 22)}</button><textarea id="cin" rows="1" placeholder="Message" autocomplete="off"></textarea>${S.gifOk ? `<button class="cbtn" id="cgif" aria-label="GIF">${ic('gif', 22)}</button>` : ''}</div><button class="sendb" id="csend" aria-label="Send">${ic('mic', 22).replace('class="ic"', 'class="ic i-mic"')}${ic('send', 22).replace('class="ic"', 'class="ic i-send"')}</button></div>`;
  const inp = $('#cin'), sb = $('#csend');
  const fit = () => { inp.style.height = '38px'; inp.style.height = Math.min(130, inp.scrollHeight) + 'px'; };
  const mode = () => sb.classList.toggle('has', !!inp.value.trim());
  inp.value = ls.get('draft:' + CH.id) || ''; fit(); mode();
  inp.oninput = () => { fit(); mode(); if (!CH.edit) ls.set('draft:' + CH.id, inp.value); CH.lastAct = Date.now(); if (inp.value && Date.now() - (CH.typedAt || 0) > 3000) { CH.typedAt = Date.now(); api('POST', '/social/typing', { conv: CH.id }); } };
  inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && prefs().enterSend) { e.preventDefault(); sendText(); } };
  inp.onfocus = () => { setTimeout(() => { const b = $('#msgs'); if (b && b.scrollHeight - b.scrollTop - b.clientHeight < 300) b.scrollTop = b.scrollHeight; }, 320); };
  sb.onclick = () => { if (inp.value.trim()) sendText(); else startRec(); };
  $('#cat').onclick = attachSheet; const g = $('#cgif'); if (g) g.onclick = gifPicker;
  if (i && i.canSend === false && i.kind === 'dm') { c.innerHTML = `<div class="rbar" style="border-left-color:var(--warn);margin:0 4px 6px"><div class="t"><b style="color:var(--warn)">You cannot message this person</b><span>They are not your friend any more, or one of you blocked the other.</span></div></div>`; }
}
function composerBack() { if (REC) { endRec(true); return true; } if (CH && (CH.reply || CH.edit)) { clearReply(); return true; } return false; }
function composerClose() { if (REC) endRec(true, true); }
function clearReply() { if (!CH) return; const wasEdit = !!CH.edit; CH.reply = null; CH.edit = null; const r = $('#rbar'); if (r) { r.innerHTML = ''; } if (wasEdit) { const i = $('#cin'); if (i) { i.value = ls.get('draft:' + CH.id) || ''; i.oninput(); } } }
function startReply(m) { CH.edit = null; CH.reply = { id: m.id, name: m.name, text: plain(m.kind === 'text' ? m.text : m.kind === 'image' ? 'Photo' : m.kind === 'voice' ? 'Voice message' : m.kind === 'gif' ? 'GIF' : m.text) }; showRbar('reply', 'Replying to ' + (m.mine ? 'yourself' : (NICKS()[m.uid] || m.name)), CH.reply.text); const i = $('#cin'); i && i.focus(); }
function startEdit(m) { CH.reply = null; CH.edit = m; showRbar('edit', 'Editing message', m.text); const i = $('#cin'); if (i) { i.value = m.text; i.oninput(); i.focus(); } }
function showRbar(kind, title, text) { const r = $('#rbar'); r.innerHTML = `<div class="rbar"><div class="t"><b>${esc(title)}</b><span class="ell">${esc(text)}</span></div><button class="ibtn flat" id="rbx" aria-label="Cancel">${ic('x', 18)}</button></div>`; $('#rbx').onclick = clearReply; }

// ---------- sending ----------
async function sendText() {
  const inp = $('#cin'), text = inp.value.trim(); if (!text) return; hp('tap');
  if (CH.edit) { const m = CH.edit; const r = await api('POST', '/social/edit', { id: m.id, text }); if (r.error) return toast(r.error, 'info'); m.text = text; m.edited = true; clearReply(); inp.value = ''; inp.oninput(); renderChat(false); return; }
  const rep = CH.reply ? CH.reply.id : 0, rq = CH.reply; inp.value = ''; ls.del('draft:' + CH.id); inp.oninput(); inp.style.height = '38px'; CH.reply = null; $('#rbar').innerHTML = '';
  sendRaw({ text, reply: rep || undefined }, { replyTo: rq ? { id: rq.id, name: rq.name, text: rq.text } : null });
}
async function sendRaw(body, extra = {}) {
  const id = CH.id, me = S.me, tmpId = 1e15 + (++CH.tmpSeq), now = Date.now();
  const tmp = Object.assign({ id: tmpId, tmp: true, uid: me.uid, name: me.name, text: body.text || '', kind: body.kind || 'text', at: now, mine: true, reactions: [], replyTo: null, data: body.data || null }, extra);
  CH.msgs.push(tmp); CH.lastAct = now; renderChat(true);
  const r = await api('POST', '/social/send', Object.assign({ conv: id }, body));
  if (!CH || CH.id !== id) return r;
  if (r.http === 0 && (!body.kind || body.kind === 'text')) { OUTQ.push({ conv: id, body, at: now }); saveQ(); tmp.pending = true; toast('No connection. It will send when you are back online.', 'info'); return r; }
  CH.msgs = CH.msgs.filter((m) => m !== tmp);
  if (r.error) { toast(r.error, 'info'); renderChat(false); return r; }
  const real = Object.assign({}, tmp, { id: r.id, tmp: false, at: r.at || now }); delete real.pending; CH.keyMap[r.id] = 't' + tmpId; CH.msgs.push(real); CH.seen.add(r.id); CH.last = Math.max(CH.last, r.id);
  const old = CH.info && CH.info.streak; if (r.streak && CH.info) { CH.info.streak = r.streak; streakBar(old, r.streak); paintHead(); }
  CH.msgs.sort((a, b) => (a.tmp ? 1 : 0) - (b.tmp ? 1 : 0) || a.id - b.id); renderChat(true); hp('ok');
  if ((!body.kind || body.kind === 'text') && r.id) undoBar(r.id, id);
  setTimeout(() => CH && CH.id === id && loadConv(false), 900); CH.lastAct = Date.now();
  return r;
}
async function flushQueue() {
  if (flushing || !OUTQ.length || S.offline) return; flushing = true; const it = OUTQ[0];
  const r = await api('POST', '/social/send', Object.assign({ conv: it.conv }, it.body)); flushing = false; if (r.http === 0) return;
  OUTQ.shift(); saveQ(); if (CH && CH.id === it.conv) { CH.msgs = CH.msgs.filter((m) => !(m.pending && m.at === it.at)); loadConv(false); } if (!r.error) toast('A message that was waiting has been sent', 'check'); flushQueue();
}
setInterval(() => { if (OUTQ.length && !S.offline) flushQueue(); }, 8000);
function undoBar(msgId, convId) {
  const el = $('#undo'); el.innerHTML = '<span>Message sent</span><button>Undo</button>'; el.classList.add('on'); clearTimeout(undoBar.t); undoBar.t = setTimeout(() => el.classList.remove('on'), 5500);
  el.querySelector('button').onclick = async () => { el.classList.remove('on'); const r = await api('POST', '/social/delete', { id: msgId }); if (r.error) return toast(r.error, 'info'); hp('ok'); toast('Message unsent', 'check'); if (CH && CH.id === convId) { CH.msgs = CH.msgs.filter((m) => m.id !== msgId); renderChat(false); } };
}

// ---------- attach menu ----------
function attachSheet() {
  const A = (k, ico, t, sm) => `<button class="act" data-a="${k}"><span class="ai">${ic(ico, 19)}</span><span>${t}${sm ? `<small>${sm}</small>` : ''}</span></button>`; const g = CH.info && CH.info.kind === 'group';
  openSheet(`<h3>Send</h3>${A('photo', 'image', 'Photo', 'From your gallery')}${S.gifOk ? A('gif', 'gif', 'GIF') : ''}${g ? A('poll', 'chart', 'Poll', 'Ask the group something') : ''}${A('later', 'clock', 'Send later', 'Pick a date and time')}${A('qr', 'zap', 'Quick replies')}`, { onOpen: (sh) => { sh.onclick = (e) => { const a = e.target.closest('[data-a]'); if (!a) return; closeSheet(); ({ photo: pickPhoto, gif: gifPicker, poll: pollSheet, later: scheduleSheet, qr: quickReplies })[a.dataset.a](); }; } });
}
function pickPhoto() {
  const pid = 'p' + hex(4); toast('Choose a photo...', 'image'); const id = CH.id;
  CB[pid] = (json) => {
    let f = null; try { f = JSON.parse(json || 'null'); } catch (e) { } if (!f || !f.data) return toast('No photo chosen, or it is too big.', 'info'); if (!CH || CH.id !== id) return;
    const url = 'data:' + f.mime + ';base64,' + f.data;
    openSheet(`<h3>Send photo</h3><img class="pvw" src="${url}" alt="Preview" style="margin:10px 0"><input class="inp" id="pcap" placeholder="Add a caption..." maxlength="200" autocomplete="off" style="margin-bottom:12px"><button class="btn pri wide" id="psend">${ic('send', 18)} Send</button>`, { onOpen: () => { $('#psend').onclick = () => { const cap = $('#pcap').value.trim(); closeSheet(); sendPhoto(f, cap); }; } });
  };
  N('pickImage', pid);
}
async function sendPhoto(f, cap) {
  const id = CH.id, url = 'data:' + f.mime + ';base64,' + f.data, tmp = { id: 1e15 + (++CH.tmpSeq), tmp: true, uid: S.me.uid, name: S.me.name, text: cap || '', kind: 'image', at: Date.now(), mine: true, reactions: [], dataUrl: url, data: { w: f.w, h: f.h } };
  CH.msgs.push(tmp); renderChat(true); const u = await api('POST', '/media', { mime: f.mime, data: f.data });
  if (!u.ok) { CH.msgs = CH.msgs.filter((m) => m !== tmp); renderChat(false); return toast(u.error || 'Could not upload the photo', 'info'); }
  const r = await api('POST', '/social/send', { conv: id, kind: 'image', text: cap || '', data: { id: u.id, w: f.w, h: f.h } }); if (!CH || CH.id !== id) return;
  CH.msgs = CH.msgs.filter((m) => m !== tmp); if (r.error) { toast(r.error, 'info'); return renderChat(false); }
  const real = Object.assign({}, tmp, { id: r.id, tmp: false, at: r.at || tmp.at, data: { id: u.id, w: f.w, h: f.h } }); delete real.dataUrl; CH.keyMap[r.id] = 't' + tmp.id; CH.msgs.push(real); CH.msgs.sort((a, b) => (a.tmp ? 1 : 0) - (b.tmp ? 1 : 0) || a.id - b.id); renderChat(true); hp('ok');
}
function gifPicker() {
  openSheet(`<div class="search" style="margin:4px 0 0">${ic('search', 18)}<input id="gq" placeholder="Search GIFs" autocomplete="off"></div><div class="gifg" id="gr"></div>`, { onOpen: (sh) => {
    let list = []; const load = async () => { const r = await api('GET', '/social/gif?q=' + encodeURIComponent($('#gq').value.trim())); list = (r && r.gifs) || []; const el = $('#gr'); if (el) el.innerHTML = list.length ? list.map((g, i) => `<img data-gi="${i}" src="${esc(g.url)}" alt="GIF" loading="lazy">`).join('') : '<div class="empty" style="grid-column:1/-1">No GIFs found.</div>'; };
    $('#gq').oninput = debounce(load, 400); load(); sh.onclick = (e) => { const g = e.target.closest('[data-gi]'); if (g) { closeSheet(); sendRaw({ kind: 'gif', data: list[+g.dataset.gi] }); } };
  } });
}
function quickReplies() {
  const q = QR(); openSheet(`<h3>Quick replies</h3>${q.map((t, i) => `<button class="act" data-q="${i}"><span class="ai">${ic('zap', 18)}</span>${esc(t)}</button>`).join('')}<button class="act acc" data-a="add"><span class="ai">${ic('plus', 18)}</span>Add your own</button><button class="act" data-a="reset"><span class="ai">${ic('refresh', 18)}</span>Reset to the default list</button>`, { onOpen: (sh) => { sh.onclick = async (e) => {
    const b = e.target.closest('[data-q]'), a = e.target.closest('[data-a]'); if (b) { closeSheet(); return sendRaw({ text: q[+b.dataset.q] }); }
    if (a && a.dataset.a === 'add') { closeSheet(); const t = await askText('New quick reply', '', 'Something you say often', 60); if (t && t.trim()) { jset('qr', q.concat(t.trim()).slice(-14)); quickReplies(); } } else if (a) { ls.del('qr'); quickReplies(); }
  }; } });
}
function pollSheet() {
  let opts = ['', ''], q = ''; const draw = () => openSheet(`<h3>Start a poll</h3><input class="inp" id="pq" maxlength="100" placeholder="Question, like What do we play?" value="${esc(q)}" style="margin:8px 0">${opts.map((o, i) => `<input class="inp po-i" data-i="${i}" maxlength="40" placeholder="Option ${i + 1}" value="${esc(o)}" style="margin-top:8px">`).join('')}${opts.length < 6 ? `<button class="btn wide" id="padd" style="margin-top:10px">${ic('plus', 16)} Add option</button>` : ''}<button class="btn pri wide" id="pgo" style="margin-top:10px">Post poll</button>`, { onOpen: () => {
    $('#pq').oninput = () => { q = $('#pq').value; }; $$('.po-i').forEach((i) => { i.oninput = () => { opts[+i.dataset.i] = i.value; }; }); const pa = $('#padd'); if (pa) pa.onclick = () => { opts.push(''); draw(); };
    $('#pgo').onclick = async () => { const qq = $('#pq').value.trim(), o = opts.map((x) => x.trim()).filter(Boolean); if (qq.length < 2 || o.length < 2) return toast('Add a question and at least two options.', 'info'); const r = await api('POST', '/social/gpoll', { conv: CH.id, q: qq, options: o }); if (r.error) return toast(r.error, 'info'); closeSheet(); hp('ok'); loadConv(false); };
  } }); draw();
}
const pad2 = (n) => String(n).padStart(2, '0'); const localInput = (t) => { const d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
function scheduleSheet() {
  const id = CH.id, draft = ($('#cin') && $('#cin').value.trim()) || '';
  openSheet(`<h3>Send later</h3><textarea class="inp" id="sct" rows="3" maxlength="2000" placeholder="Message" style="margin:8px 0">${esc(draft)}</textarea><div class="mut" style="margin:6px 0 4px">When</div><input type="datetime-local" class="inp" id="scd" value="${localInput(Date.now() + 3600000)}"><div style="display:flex;gap:8px;margin:10px 0">${[['In 1 hour', 1], ['This evening', 'eve'], ['Tomorrow 9:00', 'tom']].map((x) => `<button class="btn sm" data-q="${x[1]}">${x[0]}</button>`).join('')}</div><button class="btn pri wide" id="scok">Schedule</button><div class="mut3" style="font-size:.82em;margin-top:8px">It is sent from the server, so your phone does not need to be on.</div>`, { onOpen: (sh) => {
    sh.onclick = (e) => { const q = e.target.closest('[data-q]'); if (!q) return; const v = q.dataset.q; let d = new Date(); if (v === '1') d = new Date(Date.now() + 3600000); else if (v === 'eve') { d.setHours(19, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); } else { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); } $('#scd').value = localInput(d.getTime()); };
    $('#scok').onclick = async () => { const t = $('#sct').value.trim(), at = new Date($('#scd').value).getTime(); if (!t) return toast('Write a message first.', 'info'); if (!(at > Date.now())) return toast('Pick a time in the future.', 'info'); const r = await api('POST', '/social/schedule', { conv: id, text: t, at }); if (r.error) return toast(r.error, 'info'); hp('ok'); closeSheet(); toast('Scheduled for ' + new Date(at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }), 'clock'); if (draft && draft === t) { $('#cin').value = ''; $('#cin').oninput(); } };
  } });
}
async function scheduledList() {
  const id = CH.id, r = await api('GET', '/social/scheduled?conv=' + id), l = (r && r.items) || [];
  openSheet(`<h3>Scheduled messages</h3>${l.length ? l.map((x) => `<div class="row" style="padding:10px 4px"><div class="rt"><small>${new Date(x.at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small><b class="ell">${esc(x.text.slice(0, 100))}</b></div><button class="btn sm" data-un="${x.id}">Cancel</button></div>`).join('') : '<div class="empty" style="padding:30px 10px">Nothing scheduled in this chat.</div>'}`, { onOpen: (sh) => { sh.onclick = async (e) => { const u = e.target.closest('[data-un]'); if (u) { await api('POST', '/social/unschedule', { id: +u.dataset.un }); toast('Cancelled', 'check'); scheduledList(); } }; } });
}

// ---------- voice messages ----------
function startRec() {
  CB.mic = (v) => { if (v === 'recording') showRec(); else if (v === 'granted') toast('Microphone allowed. Tap the mic again to record.', 'mic'); else if (v === 'denied') toast('Allow the microphone in Android settings to send voice messages.', 'info'); else toast('Could not start recording.', 'info'); };
  N('recStart');
}
window.onRecLimit = () => { if (REC) endRec(false); };
function showRec() {
  REC = { t0: Date.now(), id: CH.id }; hp('heavy'); const bar = $('#cbar'); const bars = Array.from({ length: 28 }, (_, i) => `<i style="animation-delay:${(i * 53) % 900}ms"></i>`).join('');
  bar.innerHTML = `<div class="rec"><button class="cbtn" id="rcx" aria-label="Cancel" style="color:var(--bad)">${ic('trash', 21)}</button><i class="rd"></i><span class="rt" id="rt">0:00</span><div class="live">${bars}</div></div><button class="sendb has" id="rsend" aria-label="Send voice message">${ic('send', 22).replace('class="ic"', 'class="ic i-send"')}</button>`;
  REC.iv = setInterval(() => { const e = $('#rt'); if (e) e.textContent = fmtDur(Date.now() - REC.t0); }, 250); $('#rcx').onclick = () => endRec(true); $('#rsend').onclick = () => endRec(false);
}
function endRec(cancel, silent) {
  const r = REC; if (!r) return; clearInterval(r.iv); REC = null; const id = r.id;
  CB.rec = async (json) => {
    if (CH && CH.id === id && !silent) buildComposer(); let f = null; try { f = JSON.parse(json || 'null'); } catch (e) { } if (cancel || !f) { if (!cancel && !silent) toast('That was too short.', 'info'); return; } if (!CH || CH.id !== id) return;
    const tmp = { id: 1e15 + (++CH.tmpSeq), tmp: true, uid: S.me.uid, name: S.me.name, text: '', kind: 'voice', at: Date.now(), mine: true, reactions: [], data: { id: '', ms: f.ms } }; CH.msgs.push(tmp); renderChat(true);
    const u = await api('POST', '/media', { mime: f.mime, data: f.data }); if (!u.ok) { CH.msgs = CH.msgs.filter((m) => m !== tmp); renderChat(false); return toast(u.error || 'Could not upload the voice message', 'info'); }
    const s = await api('POST', '/social/send', { conv: id, kind: 'voice', data: { id: u.id, ms: f.ms } }); if (!CH || CH.id !== id) return; CH.msgs = CH.msgs.filter((m) => m !== tmp);
    if (s.error) { toast(s.error, 'info'); return renderChat(false); } const real = Object.assign({}, tmp, { id: s.id, tmp: false, data: { id: u.id, ms: f.ms } }); CH.keyMap[s.id] = 't' + tmp.id; CH.msgs.push(real); CH.msgs.sort((a, b) => (a.tmp ? 1 : 0) - (b.tmp ? 1 : 0) || a.id - b.id); renderChat(true); hp('ok');
  };
  N('recStop', !!cancel); if (CH && CH.id === id && !silent) buildComposer();
}
