'use strict';
// ====================== settings ======================
const NT = [['msg', 'Messages', 'New chat messages and polls'], ['friend', 'Friend requests', 'When someone adds you or accepts'], ['react', 'Reactions', 'When someone reacts to your message'], ['streak', 'Streak reminders', 'When a streak is about to end']];
const ntPrefs = () => { const o = {}; NT.forEach((t) => { o[t[0]] = ls.get('nt_' + t[0]) !== '0'; }); o.deal = false; o.free = false; return o; };
const pushNt = () => N('setNotifTypes', JSON.stringify(ntPrefs()));
const dndState = () => jget('dnd', { on: false, from: '22:00', to: '08:00' });
const pushDnd = () => { const d = dndState(), m = (s) => { const p = String(s).split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }; N('setDnd', !!d.on, m(d.from), m(d.to)); };
const sw = (id, on) => `<label class="sw"><input type="checkbox" id="${id}"${on ? ' checked' : ''}><i></i></label>`;
const srow = (ico, t, sub, right, attrs = '') => `<div class="row ${attrs.includes('data-go') ? 'tap' : ''}" ${attrs}><div class="ri">${ic(ico, 20)}</div><div class="rt"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</div>${right || ''}</div>`;
const nav = (ico, t, sub, go2, badge) => srow(ico, t, sub, (badge ? `<span class="chip">${badge}</span>` : '') + `<span class="chev">${ic('chev', 18)}</span>`, `data-go="${go2}"`);

function renderSettings() {
  const s = $('#s-settings'), me = S.me || {}, st = (S.myStatus || '');
  const h = `<div class="bar"><h1>Settings</h1></div>
  <div class="card" style="margin-top:4px"><div class="row" style="padding:18px 16px;gap:16px">${avatar({ avatar: me.avatar, name: me.name, uid: me.uid }, 64)}<div class="rt"><b style="font-size:1.2em">${esc(me.name || '')}</b><small>${esc(me.code || '')}</small>${st ? `<small style="color:var(--acc)">${esc(st)}</small>` : ''}</div><button class="ibtn" data-act="qr" aria-label="My QR code">${ic('qr', 21)}</button></div><div class="row tap" data-act="status">${`<div class="ri">${ic('smile', 20)}</div><div class="rt"><b>${st ? 'Change status' : 'Set a status'}</b><small>A short note your friends see. It clears itself.</small></div><span class="chev">${ic('chev', 18)}</span>`}</div></div>
  <div class="sec">Preferences</div><div class="card">${nav('flame', 'Streaks', stkSub(), 'streaks', stkBadge())}${nav('palette', 'Appearance', 'Theme, colour, wallpaper, text size', 'look')}${nav('bell', 'Notifications', 'Sounds, types and quiet hours', 'notif')}${nav('shield', 'Privacy and security', 'Read receipts, typing, app lock, blocked', 'priv')}${nav('chats', 'Chats', 'Quick replies, link previews, data saver', 'chats')}</div>
  <div class="sec">Your stuff</div><div class="card">${nav('star', 'Starred messages', '', 'stars')}${nav('archive', 'Archived chats', '', 'arch')}</div>
  <div class="sec">Account</div><div class="card">${me.email ? srow('hash', 'Email', esc(me.email), '') + nav('lock', 'Change password', '', 'pw') : (me.isSteam ? nav('hash', 'Add email sign-in', 'Sign in with an email and password as well', 'addmail') : '')}${nav('trash', 'Delete my account', 'Removes your chats, friends and streaks', 'del')}</div>
  <div class="sec">App</div><div class="card">${nav('download', 'Storage and data', '', 'store')}${nav('info', 'About and updates', 'Version ' + esc(CUR), 'about', UPD ? 'Update' : '')}</div>
  <div class="card" style="margin-top:20px"><button class="row tap" data-go="out" style="width:100%;text-align:left;color:var(--bad)"><div class="ri" style="background:color-mix(in srgb,var(--bad) 14%,transparent);color:var(--bad)">${ic('logout', 20)}</div><div class="rt"><b>Sign out</b></div></button></div>
  <div class="mut3" style="text-align:center;font-size:.8em;padding:6px 20px 20px">SteamLite Messages ${esc(CUR)}</div>`;
  if (s.__h !== h) { s.__h = h; s.innerHTML = h; }
  if (!s.__bound) { s.__bound = true; s.addEventListener('click', (e) => { const a = e.target.closest('[data-act]'), g = e.target.closest('[data-go]'); if (a) { hp('tap'); if (a.dataset.act === 'qr') qrSheet(); else statusSheet(); } else if (g) { hp('tap'); settingsGo(g.dataset.go); } }); }
}
function settingsGo(k) {
  ({ look: lookPage, notif: notifPage, priv: privPage, chats: chatsPage, stars: openStarred, arch: () => { go('chats'); showArch = true; renderChats(); }, streaks: openStreaksPage, store: storePage, about: aboutPage, out: signOutAsk, pw: pwSheet, addmail: addMailSheet, del: deleteAccount })[k]();
}
async function signOutAsk() { if (await askConfirm('Sign out?', 'You will need to sign in with Steam again.', 'Sign out', true)) { api('POST', '/logout', {}); signedOut(); } }
function statusSheet() {
  openSheet(`<h3>Your status</h3><input class="inp" id="st-t" maxlength="60" placeholder="Busy till 8pm, gaming, at work..." value="${esc(S.myStatus || '')}" style="margin:10px 0"><div class="mut" style="margin-bottom:6px">Clears itself after</div><div class="seg" id="st-h" style="margin:0 0 12px">${[[1, '1 hour'], [4, '4 hours'], [24, 'Today'], [168, '1 week']].map((x, i) => `<button data-h="${x[0]}" class="${i === 2 ? 'on' : ''}">${x[1]}</button>`).join('')}</div><button class="btn pri wide" id="st-ok">Set status</button>${S.myStatus ? '<button class="btn wide" id="st-x" style="margin-top:8px">Clear status</button>' : ''}`, { onOpen: () => {
    let hrs = 24; $('#st-h').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; hrs = +b.dataset.h; $$('#st-h button').forEach((y) => y.classList.toggle('on', y === b)); hp('tap'); };
    const save = async (t, h) => { closeSheet(); await saveStatus(t, h); };
    $('#st-ok').onclick = () => { const t = $('#st-t').value.trim(); if (!t) return toast('Write a status first.', 'info'); save(t, hrs); }; const x = $('#st-x'); if (x) x.onclick = () => save('', 0);
  } });
}

// ---------- pages ----------
function lookPage() {
  pushPage('look', 'Appearance', (b) => {
    const p = prefs();
    b.innerHTML = `<div class="sec">Theme</div><div class="seg" id="lm">${[['auto', 'Auto'], ['dark', 'Dark'], ['light', 'Light']].map((x) => `<button data-m="${x[0]}" class="${p.mode === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>
    <div class="sec">Accent colour</div><div class="sws" id="la">${ACCENTS.map((a) => `<button data-a="${a[0]}" aria-label="${a[1]}" class="${p.accent === a[0] ? 'on' : ''}" style="--c:linear-gradient(135deg,${a[2]},${a[3]});background:var(--c)"></button>`).join('')}</div>
    <div class="sec">Chat wallpaper</div><div class="seg" id="lw">${WALLS.map((w) => `<button data-w="${w[0]}" class="${p.wall === w[0] ? 'on' : ''}">${w[1]}</button>`).join('')}</div>
    <div class="sec">Text size</div><div class="seg" id="lf">${[[.9, 'Small'], [1, 'Normal'], [1.1, 'Large'], [1.22, 'Huge']].map((x) => `<button data-f="${x[0]}" class="${p.fs === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>
    <div class="card" style="margin-top:14px">${srow('sparkle', 'Reduce motion', 'Fewer animations', sw('rm', p.rm))}${srow('list', 'Compact chat list', 'Smaller rows, more chats on screen', sw('cp', p.compact))}${srow('zap', 'Haptic feedback', 'Small vibrations when you tap and send', sw('hpt', p.haptics !== false))}</div>
    <div class="card" style="padding:14px 16px;margin-top:6px"><div class="mut3" style="font-size:.78em;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px">Preview</div><div style="display:flex;flex-direction:column;gap:6px"><div class="bub" style="align-self:flex-start;border-bottom-left-radius:6px">Hey! Did you see the new game?</div><div class="mrow mine" style="justify-content:flex-end"><div class="bub">Yes, playing it right now ${tick('sn')}</div></div></div></div>`;
    const grp = (id, attr, fn) => { $(id, b).onclick = (e) => { const x = e.target.closest('button'); if (!x) return; hp('tap'); fn(x.dataset[attr]); $$(id + ' button', b).forEach((y) => y.classList.toggle('on', y === x)); }; };
    grp('#lm', 'm', (v) => setPref('mode', v)); grp('#la', 'a', (v) => setPref('accent', v)); grp('#lw', 'w', (v) => { setPref('wall', v); applyChatWall(); }); grp('#lf', 'f', (v) => setPref('fs', +v));
    $('#rm', b).onchange = (e) => setPref('rm', e.target.checked); $('#cp', b).onchange = (e) => { setPref('compact', e.target.checked); renderChats(); }; $('#hpt', b).onchange = (e) => { setPref('haptics', e.target.checked); };
  });
}
function notifPage() {
  pushPage('notif', 'Notifications', (b) => {
    const ns = notifState(), ok = ns.permission !== false && ns.enabled !== false && ns.channel !== false, d = dndState(), nt = ntPrefs();
    b.innerHTML = `<div class="card" style="margin-top:12px"><div class="row"><div class="ri" style="${ok ? '' : 'background:color-mix(in srgb,var(--bad) 14%,transparent);color:var(--bad)'}">${ic(ok ? 'bell' : 'bellOff', 20)}</div><div class="rt"><b>${ok ? 'Notifications are on' : 'Notifications are off'}</b><small>${ok ? 'Android allows SteamLite Messages to notify you.' : 'Turn them on in Android, or you will miss messages.'}</small></div>${ok ? '' : '<button class="btn sm pri" id="nton">Turn on</button>'}</div><div class="row tap" id="ntest">${`<div class="ri">${ic('zap', 20)}</div><div class="rt"><b>Send a test notification</b><small>Check that messages reach this phone</small></div>`}</div></div>
    <div class="sec">What to notify me about</div><div class="card">${srow('bellOff', 'Pause everything', 'No notifications at all', sw('mall', ls.get('muteAll') === '1'))}${NT.map((t) => srow('bell', t[1], t[2], sw('nt-' + t[0], nt[t[0]]))).join('')}</div>
    <div class="sec">Quiet hours</div><div class="card">${srow('moon', 'Do not disturb', 'Notifications still arrive, silently', sw('dnd', d.on))}<div id="dndt" style="padding:6px 16px 16px;display:${d.on ? 'flex' : 'none'};gap:12px"><label class="grow mut" style="font-size:.85em">From<input type="time" class="inp" id="dnf" value="${esc(d.from)}" style="margin-top:4px"></label><label class="grow mut" style="font-size:.85em">To<input type="time" class="inp" id="dnt" value="${esc(d.to)}" style="margin-top:4px"></label></div></div>`;
    const t = $('#nton', b); if (t) t.onclick = () => { CB.notif = () => setTimeout(() => { closePage(); notifPage(); }, 800); N('askNotif'); };
    $('#ntest', b).onclick = async () => { const r = await api('POST', '/push/test', {}); toast(r.error || 'Sent. It should arrive in a few seconds.', r.error ? 'info' : 'check'); };
    $('#mall', b).onchange = (e) => { ls.set('muteAll', e.target.checked ? '1' : '0'); N('setMuteAll', e.target.checked); };
    NT.forEach((x) => { $('#nt-' + x[0], b).onchange = (e) => { ls.set('nt_' + x[0], e.target.checked ? '1' : '0'); pushNt(); }; });
    $('#dnd', b).onchange = (e) => { const v = dndState(); v.on = e.target.checked; jset('dnd', v); pushDnd(); $('#dndt', b).style.display = v.on ? 'flex' : 'none'; };
    $('#dnf', b).onchange = (e) => { const v = dndState(); v.from = e.target.value; jset('dnd', v); pushDnd(); }; $('#dnt', b).onchange = (e) => { const v = dndState(); v.to = e.target.value; jset('dnd', v); pushDnd(); };
  });
}
function privPage() {
  pushPage('priv', 'Privacy and security', async (b) => {
    const p = prefs(), canLock = N('canLock') === true; const pr = await api('GET', '/social/prefs');
    b.innerHTML = `<div class="sec">Chats</div><div class="card">${srow('check', 'Read receipts', 'Show "Seen" to people you chat with. If you turn it off you do not see theirs either.', sw('p-read', pr.readReceipts !== false))}${srow('edit', 'Typing indicator', 'Let people see when you are typing', sw('p-typ', pr.typing !== false))}${srow('globe', 'Show when I am online', 'Friends see you as online while the app is open', sw('p-pres', p.presence !== false))}</div>
    <div class="sec">Security</div><div class="card">${canLock ? srow('lock', 'App lock', 'Ask for your fingerprint, face or PIN when you come back', sw('p-lock', ls.get('lock') === '1')) : srow('lock', 'App lock', 'Set a screen lock in Android to use this', '')}${nav('shield', 'Blocked people', '', 'blocked')}</div>`;
    $('#p-read', b).onchange = (e) => api('POST', '/social/prefs', { readReceipts: e.target.checked }); $('#p-typ', b).onchange = (e) => api('POST', '/social/prefs', { typing: e.target.checked }); $('#p-pres', b).onchange = (e) => setPref('presence', e.target.checked);
    const lk = $('#p-lock', b); if (lk) lk.onchange = (e) => { ls.set('lock', e.target.checked ? '1' : '0'); N('setLock', e.target.checked); };
    b.onclick = (e) => { if (e.target.closest('[data-go="blocked"]')) blockedPage(); };
  });
}
async function blockedPage() {
  pushPage('blocked', 'Blocked people', async (b) => {
    const draw = async () => { const r = await api('GET', '/social/blocks'), l = r.blocked || []; b.innerHTML = l.length ? `<div class="card" style="margin-top:12px">${l.map((u) => `<div class="row">${avatar(u, 42)}<div class="rt"><b>${esc(u.name)}</b></div><button class="btn sm" data-ub="${u.uid}">Unblock</button></div>`).join('')}</div>` : `<div class="empty"><div class="big">${ic('shield', 40)}</div><h3>Nobody is blocked</h3></div>`; };
    await draw(); b.onclick = async (e) => { const u = e.target.closest('[data-ub]'); if (u) { await api('POST', '/social/block', { uid: u.dataset.ub, on: false }); toast('Unblocked', 'check'); draw(); } };
  });
}
function chatsPage() {
  pushPage('chatset', 'Chats', (b) => {
    const p = prefs();
    b.innerHTML = `<div class="card" style="margin-top:12px">${srow('send', 'Enter key sends', 'Useful with a keyboard. Otherwise Enter starts a new line.', sw('c-ent', p.enterSend))}${srow('globe', 'Link previews', 'Show a title and picture under links', sw('c-prev', p.preview !== false))}<div class="row"><div class="ri">${ic('download', 20)}</div><div class="rt"><b>Data saver</b><small>Skip link previews</small></div><select class="inp" id="c-ds" style="width:auto"><option value="0">Off</option><option value="1">On</option></select></div></div>
    <div class="card" style="margin-top:12px">${nav('zap', 'Quick replies', 'Phrases you can send with one tap', 'qr')}${srow('check', 'Mark everything as read', '', '<button class="btn sm" id="c-all">Do it</button>')}</div>`;
    $('#c-ent', b).onchange = (e) => setPref('enterSend', e.target.checked); $('#c-prev', b).onchange = (e) => setPref('preview', e.target.checked); const ds = $('#c-ds', b); ds.value = p.dsave; ds.onchange = () => setPref('dsave', ds.value);
    $('#c-all', b).onclick = async () => { await api('POST', '/social/readall', {}); toast('All caught up', 'check'); tickOverview(true); };
    b.onclick = (e) => { if (e.target.closest('[data-go="qr"]')) qrEditPage(); };
  });
}
function qrEditPage() {
  pushPage('qredit', 'Quick replies', (b) => {
    const draw = () => { const q = QR(); b.innerHTML = `<div class="card" style="margin-top:12px">${q.map((t, i) => `<div class="row"><div class="ri">${ic('zap', 18)}</div><div class="rt"><b>${esc(t)}</b></div><button class="ibtn flat" data-d="${i}" aria-label="Delete">${ic('trash', 18)}</button></div>`).join('')}</div><div style="padding:6px 16px"><button class="btn pri wide" id="qadd">${ic('plus', 18)} Add a quick reply</button><button class="btn wide" id="qres" style="margin-top:8px">Reset to the default list</button></div>`; };
    draw(); b.onclick = async (e) => { const d = e.target.closest('[data-d]'); if (d) { const q = QR(); q.splice(+d.dataset.d, 1); jset('qr', q); draw(); } else if (e.target.closest('#qadd')) { const t = await askText('New quick reply', '', 'Something you say often', 60); if (t && t.trim()) { jset('qr', QR().concat(t.trim()).slice(-14)); draw(); } } else if (e.target.closest('#qres')) { ls.del('qr'); draw(); } };
  });
}
function lsSize() { let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('c:')) n += (localStorage.getItem(k) || '').length * 2; } } catch (e) { } return n; }
const fmtSize = (b) => b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
function storePage() {
  pushPage('storage', 'Storage and data', (b) => {
    b.innerHTML = `<div class="card" style="margin-top:12px">${srow('download', 'Saved chats and lists', 'Kept on this phone so the app opens fast and works offline: <b id="csz">' + fmtSize(lsSize()) + '</b>', '<button class="btn sm" id="clr">Clear</button>')}</div><div class="mut3" style="padding:6px 22px;font-size:.84em">Your messages themselves live on SteamLite Online. Clearing this only removes the local copy.</div>`;
    $('#clr', b).onclick = async () => { if (await askConfirm('Clear saved data?', 'Chats reload from the server next time you open them.', 'Clear')) { Object.keys(localStorage).filter((k) => k.startsWith('c:')).forEach((k) => ls.del(k)); $('#csz', b).textContent = fmtSize(lsSize()); toast('Cleared', 'check'); } };
  });
}
function aboutPage() {
  pushPage('about', 'About and updates', (b) => {
    const draw = () => { b.innerHTML = `<div class="prof" style="padding-top:26px"><div style="width:92px;height:92px;border-radius:30px;background:var(--grad);display:grid;place-items:center;box-shadow:0 18px 50px color-mix(in srgb,var(--acc) 40%,transparent)"><svg viewBox="0 0 24 24" width="52" height="52" fill="#fff"><path d="M12 2C6.5 2 2 5.8 2 10.5c0 2.4 1.2 4.6 3.2 6.1V21l4.1-2.6c.9.2 1.8.3 2.7.3 5.5 0 10-3.8 10-8.5S17.5 2 12 2z"/></svg></div><h2>SteamLite Messages</h2><div class="mut">Version ${esc(CUR)}</div></div>
      <div class="card" style="margin-top:16px">${UPD ? srow('download', 'Version ' + esc(UPD.version) + ' is ready', esc(String(UPD.notes || '').slice(0, 120)), '<button class="btn sm pri" id="updgo">Update</button>') : srow('check', 'You are up to date', '', '')}${srow('refresh', 'Check for updates', 'The app updates itself from inside', '<button class="btn sm" id="updck">Check</button>')}</div>
      <div class="card" style="margin-top:12px">${srow('info', 'Send a problem report', 'Version, notification state and your last error. No messages are included.', '<button class="btn sm" id="diag">Send</button>')}${srow('globe', 'SteamLite on GitHub', 'Source code and downloads', '<button class="btn sm" id="gh">Open</button>')}</div>
      <div class="mut3" style="padding:12px 22px;font-size:.82em">Messages go through SteamLite Online. Notification previews pass through Google Firebase to reach your phone. Your Steam password is never seen by SteamLite.</div>`;
      const g = $('#updgo', b); if (g) g.onclick = startUpdate; $('#updck', b).onclick = async () => { await checkUpdate(true); draw(); }; $('#gh', b).onclick = () => N('openUrl', 'https://github.com/imnotfisy/SteamLite-Messages');
      $('#diag', b).onclick = async () => { const ns = notifState(), d = ['v' + CUR, 'perm=' + ns.permission, 'enabled=' + ns.enabled, 'channel=' + ns.channel, 'push=' + ns.pushOn, 'err=' + (ns.lastPushErr || '')].join(' '); await api('POST', '/client-error', { app: 'messages', v: CUR, msg: 'report ' + d.slice(0, 160) }); toast('Sent. Thank you!', 'check'); }; };
    draw();
  });
}

function pwSheet() {
  openSheet(`<h3>Change password</h3><input class="inp" id="pw0" type="password" placeholder="Current password" autocomplete="current-password" style="margin:10px 0 8px"><input class="inp" id="pw1" type="password" placeholder="New password (8 or more characters)" autocomplete="new-password"><div class="aerr" id="pwe"></div><button class="btn pri wide" id="pwgo">Change password</button><div class="mut3" style="font-size:.82em;margin-top:8px">Your other devices are signed out.</div>`, { onOpen: () => { $('#pwgo').onclick = async () => { const a = $('#pw0').value, n = $('#pw1').value; if (n.length < 8) return ($('#pwe').textContent = 'Pick a password with 8 or more characters.'); const r = await api('POST', '/auth/email', { current: a, password: n }); if (r.error) return ($('#pwe').textContent = r.error); closeSheet(); hp('ok'); toast('Password changed', 'check'); }; } });
}
function addMailSheet() {
  openSheet(`<h3>Add email sign-in</h3><div class="mut" style="margin:4px 0 10px">Then you can sign in with your email and password as well as with Steam.</div><input class="inp" id="am0" type="email" placeholder="Email" autocomplete="email" autocapitalize="off" style="margin-bottom:8px"><input class="inp" id="am1" type="password" placeholder="Password (8 or more characters)" autocomplete="new-password"><div class="aerr" id="ame"></div><button class="btn pri wide" id="amgo">Add email</button>`, { onOpen: () => { $('#amgo').onclick = async () => { const e = $('#am0').value.trim(), p = $('#am1').value; if (p.length < 8) return ($('#ame').textContent = 'Pick a password with 8 or more characters.'); const r = await api('POST', '/auth/email', { email: e, password: p }); if (r.error) return ($('#ame').textContent = r.error); S.me.email = r.email; cset('me', S.me); closeSheet(); hp('ok'); toast('Email sign-in added', 'check'); renderSettings(); }; } });
}
async function deleteAccount() {
  if (!(await askConfirm('Delete your account?', 'Your chats, friends and streaks on SteamLite Online are removed. This cannot be undone.', 'Delete', true))) return;
  if (!(await askConfirm('Really delete it?', 'Everything is gone for good.', 'Yes, delete', true))) return;
  const r = await api('DELETE', '/account', {}); if (r.error) return toast(r.error, 'info'); signedOut();
}


function stkSub() { const f = (S.ov && S.ov.friends) || [], act = f.filter((x) => x.streak > 0).length, risk = f.filter((x) => x.streak > 0 && x.atRisk && !x.mineToday).length; return act ? act + ' active' + (risk ? ' · ' + risk + ' need you today' : '') : 'Chat daily with a friend to start one'; }
function stkBadge() { const f = (S.ov && S.ov.friends) || [], risk = f.filter((x) => x.streak > 0 && x.atRisk && !x.mineToday).length; return risk ? String(risk) : ''; }
