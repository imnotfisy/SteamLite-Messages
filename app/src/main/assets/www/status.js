'use strict';
// ====================== status: yours and your friends' ======================
const STATUS_PRESETS = [['Gaming', 24], ['At work', 8], ['Studying', 6], ['Sleeping', 8], ['On the move', 4], ['Busy', 4]];
function myStatusInfo() { const x = jget('mystatus', null); if (!S.myStatus) return null; return { t: S.myStatus, until: x && x.t === S.myStatus ? x.until : 0 }; }
function leftText(until) { if (!until) return ''; const m = Math.round((until - Date.now()) / 60000); if (m <= 0) return ''; return m < 60 ? 'clears in ' + m + ' min' : m < 36 * 60 ? 'clears in ' + Math.round(m / 60) + ' h' : 'clears in ' + Math.round(m / 1440) + ' days'; }
async function saveStatus(text, hours) {
  const r = await api('POST', '/social/status', { text, hours }); if (r.error) return toast(r.error, 'info');
  S.myStatus = text; ls.set('mystatus', JSON.stringify({ t: text, until: hours ? Date.now() + hours * 3600000 : 0 })); hp('ok'); toast(text ? 'Status set' : 'Status cleared', 'check'); renderStatus(); if (S.tab === 'settings') renderSettings();
}
function statusInit() {
  const s = $('#s-status'); if (s.__init) return; s.__init = true;
  s.innerHTML = `<div class="bar"><h1>Status</h1></div><div id="stmine"></div><div id="stlist"></div><div id="stplay"></div><div id="stempty"></div>`;
  s.addEventListener('click', async (e) => {
    const pre = e.target.closest('[data-p]'), me = e.target.closest('[data-act]'), f = e.target.closest('[data-f]');
    if (pre) { hp('tap'); const p = STATUS_PRESETS[+pre.dataset.p]; saveStatus(p[0], p[1]); }
    else if (me) { hp('tap'); if (me.dataset.act === 'edit') statusSheet(); else if (me.dataset.act === 'clear') saveStatus('', 0); }
    else if (f) { hp('tap'); const r = await api('POST', '/social/dm', { uid: f.dataset.f }); if (r.error) return toast(r.error, 'info'); go('chats'); openChat(r.id); }
  });
}
function renderStatus() {
  statusInit(); const o = S.ov, me = S.me || {}, mine = myStatusInfo();
  $('#stmine').innerHTML = `<div class="card" style="margin-top:2px"><div class="row" style="padding:18px 16px;gap:16px">${avatar({ avatar: me.avatar, name: me.name, uid: me.uid }, 62, { ring2: !!mine })}<div class="rt"><b style="font-size:1.12em">My status</b>${mine ? `<div style="margin-top:3px">${esc(mine.t)}</div><small>${esc(leftText(mine.until))}</small>` : '<small>Let your friends know what you are up to. It clears itself.</small>'}</div>${mine ? `<button class="ibtn flat" data-act="clear" aria-label="Clear status">${ic('x', 19)}</button>` : ''}<button class="ibtn" data-act="edit" aria-label="Edit status">${ic('edit', 19)}</button></div><div style="display:flex;gap:8px;overflow-x:auto;padding:0 16px 16px">${STATUS_PRESETS.map((p, i) => `<button class="btn sm" data-p="${i}" style="flex:none;white-space:nowrap">${p[0]}</button>`).join('')}</div></div>`;
  if (!o) return;
  const withS = o.friends.filter((f) => f.status).sort((a, b) => (b.playing ? 1 : 0) - (a.playing ? 1 : 0) || (b.online ? 1 : 0) - (a.online ? 1 : 0) || dname(a).localeCompare(dname(b)));
  const playing = o.friends.filter((f) => f.playing && !f.status);
  const items = []; if (withS.length) items.push({ k: '_s', html: `<div class="sec">Friends' status</div>` });
  withS.forEach((f) => items.push({ k: 's' + f.uid, html: `<div class="crow" data-f="${f.uid}">${avatar(f, 54, { dot: true, ring2: true })}<div class="mid"><div class="top"><span class="nm ell">${esc(dname(f))}</span></div><div class="pv" style="color:var(--text);font-size:1em;white-space:normal"><span class="t">${esc(f.status)}</span></div>${f.playing ? `<div class="pv" style="margin-top:3px"><span class="chip" style="font-size:.74em">${ic('gamepad', 12)} ${esc(f.playing.name)}</span></div>` : ''}</div></div>` }));
  morphList($('#stlist'), items, { flip: true, stagger: true });
  const pl = $('#stplay'); const ph = playing.length ? `<div class="sec">Playing now</div>` + playing.map((f) => `<div class="crow" data-f="${f.uid}">${avatar(f, 46, { dot: true })}<div class="mid"><span class="nm ell">${esc(dname(f))}</span><div class="pv"><span class="chip" style="font-size:.76em">${ic('gamepad', 12)} ${esc(f.playing.name)}</span></div></div></div>`).join('') : ''; if (pl.__h !== ph) { pl.__h = ph; pl.innerHTML = ph; }
  $('#stempty').innerHTML = !withS.length && !playing.length ? `<div class="empty"><div class="big">${ic('smile', 44)}</div><h3>No updates yet</h3>When your friends set a status or start a game, it shows up here.</div>` : '';
}
