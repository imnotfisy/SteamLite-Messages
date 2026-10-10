'use strict';
// ====================== sign in, boot ======================
const SPLASH_AT = Date.now(); let appShown = false;
function hideSplash() { const el = $('#splash'); if (!el || el.__gone) return; el.__gone = 1; const w = Math.max(0, 1300 - (Date.now() - SPLASH_AT)); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 750); }, w); }
let authMode = 'in';
function showSignIn(msg) {
  const s = $('#signin'); appShown = false; $('#nav').classList.add('away'); closeAllPages(); if (CH) { try { closeChat(); } catch (e) { } }
  const draw = () => {
    const up = authMode === 'up';
    s.innerHTML = `<div class="sin"><div class="lg">${LOGO}</div><h1>SteamLite Messages</h1><p>Chat with your Steam friends. Fast, private and made for gamers.</p>
    <div class="seg" id="amode" style="margin:0 0 14px;width:100%"><button data-m="in" class="${up ? '' : 'on'}">Sign in</button><button data-m="up" class="${up ? 'on' : ''}">Create account</button></div>
    <form id="aform" autocomplete="on" novalidate>${up ? '<input class="inp" id="an" name="name" placeholder="Your name" autocomplete="nickname" maxlength="24" required>' : ''}<input class="inp" id="ae" name="email" type="email" inputmode="email" placeholder="Email" autocomplete="email" autocapitalize="off" maxlength="254" required><div class="pw"><input class="inp" id="ap" name="password" type="password" placeholder="Password${up ? ' (8 or more characters)' : ''}" autocomplete="${up ? 'new-password' : 'current-password'}" maxlength="128" required><button type="button" id="aeye" aria-label="Show password">${ic('eye', 20)}</button></div><div class="aerr" id="aerr">${esc(msg || '')}</div><button class="btn pri wide" id="asub" type="submit" style="height:52px;font-size:1.02em">${up ? 'Create account' : 'Sign in'}</button></form>
    <div class="or"><span>or</span></div><button class="btn wide" id="si" style="height:52px;gap:10px;font-size:1.02em"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2a10 10 0 0 0-9.96 9.04l5.35 2.21a2.83 2.83 0 0 1 1.6-.49h.15l2.38-3.45v-.05a3.78 3.78 0 1 1 3.78 3.78h-.09l-3.4 2.43v.12a2.84 2.84 0 0 1-5.62.6l-3.83-1.58A10 10 0 1 0 12 2zM7.54 17.3l-1.23-.51a2.13 2.13 0 0 0 4.07-.47 2.13 2.13 0 0 0-2.84-2.02l1.27.52a1.57 1.57 0 1 1-1.27 2.48zm8.4-5.9a2.52 2.52 0 1 1 2.52-2.52 2.52 2.52 0 0 1-2.52 2.52zm0-.94a1.58 1.58 0 1 0-1.58-1.58 1.58 1.58 0 0 0 1.58 1.58z"/></svg> Continue with Steam</button><div class="mut3" id="sim" style="margin-top:14px;font-size:.84em">We never see your Steam password.</div></div>`;
    $('#amode').onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.m !== authMode) { authMode = b.dataset.m; hp('tap'); draw(); } };
    $('#aeye').onclick = () => { const p = $('#ap'), v = p.type === 'password'; p.type = v ? 'text' : 'password'; $('#aeye').innerHTML = ic(v ? 'x' : 'eye', 20); };
    $('#aform').onsubmit = (e) => { e.preventDefault(); authSubmit(); }; $('#si').onclick = startLogin;
  };
  draw(); msg = ''; s.classList.add('on'); setTimeout(hideSplash, 200);
}
async function authSubmit() {
  const up = authMode === 'up', email = $('#ae').value.trim(), pw = $('#ap').value, name = up ? $('#an').value.trim() : '', err = (t) => { const e = $('#aerr'); e.textContent = t; $('#aform').classList.remove('shake'); void $('#aform').offsetWidth; $('#aform').classList.add('shake'); hp('heavy'); };
  if (up && name.length < 2) return err('Pick a name (at least 2 letters).'); if (!/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(email)) return err('That email address does not look right.'); if (up ? pw.length < 8 : !pw) return err(up ? 'Pick a password with 8 or more characters.' : 'Enter your password.');
  const b = $('#asub'); b.disabled = true; b.innerHTML = '<span class="spin"></span>'; $('#aerr').textContent = '';
  const r = await api('POST', up ? '/auth/register' : '/auth/login', up ? { email, password: pw, name } : { email, password: pw });
  if (!r.ok || !r.token) { b.disabled = false; b.textContent = up ? 'Create account' : 'Sign in'; return err(r.error || 'Something went wrong. Try again.'); }
  S.tok = r.token; ls.set('tok', r.token); N('setToken', r.token); hp('ok'); boot();
}
let loginT = 0;
function startLogin() {
  const n = hex(16); N('openUrl', BASE + '/auth/start?n=' + n); const b = $('#si'); b.disabled = true; b.textContent = 'Waiting for Steam...'; $('#sim').textContent = 'Finish signing in in your browser, then come back here.'; clearInterval(loginT); let tries = 0;
  loginT = setInterval(async () => { if (++tries > 150) { clearInterval(loginT); showSignIn('That took too long. Try again.'); return; } const r = await api('GET', '/auth/poll?n=' + n); if (r.done) { clearInterval(loginT); S.tok = r.token; ls.set('tok', r.token); N('setToken', r.token); boot(); } }, 2000);
}
function signedOut() {
  S.tok = ''; ls.del('tok'); S.me = null; S.statusLoaded = false; S.ov = null; N('setToken', ''); clearInterval(pollT); Object.keys(localStorage).filter((k) => k.startsWith('c:')).forEach((k) => ls.del(k)); firstOv = true;
  $$('#screens .screen').forEach((s) => { s.__init = false; s.innerHTML = ''; s.__h = null; }); showSignIn('You were signed out.');
}
function showApp() {
  if (appShown) return; appShown = true; $('#signin').classList.remove('on'); $('#nav').classList.remove('away'); buildNav(); go(ls.get('tab') && TABS.some((t) => t[0] === ls.get('tab')) ? ls.get('tab') : 'chats'); setTimeout(movePill, 60);
  setTimeout(hideSplash, 150);
}
async function boot() {
  applyLook(); buildNav(); if (!S.tok) return showSignIn();
  N('setToken', S.tok); const cm = cget('me'), co = cget('ov');
  if (cm) { S.me = cm; if (co) { S.ov = co; S.byUid = {}; co.friends.forEach((f) => { S.byUid[f.uid] = f; }); lastUnread = {}; co.convs.forEach((c) => { lastUnread[c.id] = c.unread; }); } showApp(); updateBadges(); }
  const m = await api('GET', '/me');
  if (!m.steamid) { if (!S.me && m.http !== 401) { $('#signin').innerHTML = `<div class="empty"><h3>Could not reach SteamLite</h3>${esc(m.error || '')}<br><br><button class="btn pri" onclick="boot()">Try again</button></div>`; $('#signin').classList.add('on'); hideSplash(); } return; }
  S.me = Object.assign(S.me || {}, m); cset('me', S.me); showApp(); startPolling(); pushNt(); pushDnd(); N('setMuteAll', ls.get('muteAll') === '1'); N('setLock', ls.get('lock') === '1');
  api('GET', '/social/gif?q=').then((g) => { S.gifOk = !!(g && g.ok); });
  setTimeout(notifCheck, 3500); checkUpdate(false); const crash = N('takeCrash'); if (crash) reportError('crash: ' + crash);
  // reopen the chat you were in if the app was closed a moment ago
  const lc = jget('lastChat', null); if (lc && Date.now() - lc.at < 30 * 60000 && !CH) setTimeout(() => { if (!CH && !PGS.length) openChat(lc.id); }, 500);
}
function onOverview(prev, o) { if (!S.statusLoaded) { S.statusLoaded = true; api('GET', '/social/profile?uid=' + o.me.uid).then((p) => { if (p && p.custom) { S.myStatus = p.custom.status || ''; if (S.tab === 'settings') renderSettings(); } }); } }
applyLook(); setTimeout(hideSplash, 4800); boot();

