'use strict';
// ====================== SteamLite Messages: core ======================
const BASE = 'https://steamlite-online.bayxturtle.workers.dev', MEDIA = BASE + '/media/';
const VERSION_URL = 'https://raw.githubusercontent.com/imnotfisy/SteamLite-Messages/main/version.json';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }, del(k) { try { localStorage.removeItem(k); } catch (e) { } } };
const jget = (k, d) => { try { const v = JSON.parse(ls.get(k)); return v == null ? d : v; } catch (e) { return d; } }, jset = (k, v) => ls.set(k, JSON.stringify(v));
const cget = (k) => jget('c:' + k, null), cset = (k, v) => { try { const s = JSON.stringify(v); if (s.length < 700000) ls.set('c:' + k, s); } catch (e) { } };
const N = (f, ...a) => { try { return SLNative[f](...a); } catch (e) { return undefined; } };
const hp = (k) => { try { if (prefs().haptics === false) return; } catch (e) { } N('haptic', k || 'tap'); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CUR = N('version') || '0.0.0';
const S = { tok: ls.get('tok') || '', me: null, ov: null, tab: 'chats', offline: false };

// ---------- native callbacks ----------
const CB = {};
window.__cb = (id, v) => { const f = CB[id]; if (!f) return; if (id[0] === 'p') delete CB[id]; f(v); };
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => x.toString(16).padStart(2, '0')).join('');

// ---------- network ----------
const pend = {}; let seq = 0;
window.__http = (id, code, text) => { const p = pend[id]; if (!p) return; delete pend[id]; p(code, text); };
const raw = (method, url, headers, body) => new Promise((res) => { const id = 'r' + (++seq); pend[id] = (c, t) => res({ code: c, text: t }); SLNative.http(id, method, url, JSON.stringify(headers || {}), body || ''); });
function setOffline(v) { if (S.offline === v) return; S.offline = v; const o = $('#off'); if (o) { o.textContent = v ? 'You are offline. Messages will send when you are back.' : ''; o.classList.toggle('on', v); } if (!v && typeof flushQueue === 'function') flushQueue(); }
function localDay(off = 0) { const d = new Date(Date.now() + off * 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
// ---------- maintenance watermark: shown while the server's admin has switched SteamLite Online off (it then answers 503 with offline:true) ----------
var MAINT = false;
function maint(on) {
  on = !!on; if (on === MAINT) return; MAINT = on;
  var e = document.getElementById('maint');
  if (on) { if (!e) { e = document.createElement('div'); e.id = 'maint'; e.setAttribute('role', 'status'); e.innerHTML = '<i></i><span>Servers are undergoing maintenance</span>'; document.body.appendChild(e); } requestAnimationFrame(function () { e.classList.add('on'); }); }
  else if (e) { e.classList.remove('on'); setTimeout(function () { if (!MAINT && e.parentNode) e.parentNode.removeChild(e); }, 400); }
}
function checkMaint() { try { Promise.resolve(raw('GET', BASE + '/health?t=' + Date.now(), {}, '')).then(function (r) { if (r && r.code === 503) { var j = {}; try { j = JSON.parse(r.text); } catch (e) { } maint(j.offline === true); } else if (r && r.code > 0) maint(false); }).catch(function () { }); } catch (e) { } }
setTimeout(checkMaint, 2500); setInterval(checkMaint, 60000);
async function api(method, path, body) {
  if (path === '/social/send' && body && !body.day) body.day = localDay();
  const h = { 'Content-Type': 'application/json' }; if (S.tok) h.Authorization = 'Bearer ' + S.tok;
  const r = await raw(method, BASE + path, h, body ? JSON.stringify(body) : ''); let j = {}; try { j = JSON.parse(r.text); } catch (e) { }
  maint(r.code === 503 && j.offline === true);
  if (r.code === 401 && S.tok) signedOut();
  if (r.code === 0) { j = { error: 'No connection.' }; setOffline(true); } else setOffline(false);
  j.http = r.code; return j;
}

// ---------- icons ----------
const ICONS = {
  chats: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z"/>', people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.2-.2-4.3 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.4 1-3 0 1.1 1 2.5 2.5 2.5z"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 6l6 6-6 6"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>', mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>', image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  gif: '<rect x="2" y="6" width="20" height="12" rx="3"/><path d="M8.5 10.5a2 2 0 1 0 0 3H10v-1.5M13 10v4M16 14v-4h3M16 12h2"/>', clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', chart: '<path d="M3 3v18h18M7 14v4M12 8v10M17 11v7"/>',
  reply: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v3"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="3"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', fwd: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0-6 6v3"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>', pin: '<path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3v2H7v-2l3-3z"/>', edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>', bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/>',
  bellOff: '<path d="M8.7 3A6 6 0 0 1 18 8c0 2.7.5 4.5 1.2 5.8"/><path d="M17 17H3s3-2 3-9a5.9 5.9 0 0 1 .3-1.8"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/><path d="M2 2l20 20"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>', userplus: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>', down: '<path d="M12 5v14M5 12l7 7 7-7"/>', check: '<path d="M5 12l5 5L20 7"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15.5" cy="7.5" r="1"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>', share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>', qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 17v4"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>', zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>', smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>', text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', hash: '<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>',
  play: '<path d="M7 4l13 8-13 8z"/>', pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>', trophy: '<path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4M6 4h12v6a6 6 0 0 1-12 0zM12 16v3M8 21h8"/>', sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  gamepad: '<rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>', video: '<path d="M23 7l-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="3"/>',
  camoff: '<path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.7 0H14a2 2 0 0 1 2 2v3.3l1 1L23 7v10"/><path d="M1 1l22 22"/>', micoff: '<path d="M1 1l22 22M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.6"/><path d="M17 16.9A7 7 0 0 1 5 12v-1M19 11v1a7 7 0 0 1-.1 1.2M12 19v3"/>',
  volume: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'
};
const ic = (n, s = 20, fill) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;
const LOGO = '<svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 5.8 2 10.5c0 2.4 1.2 4.6 3.2 6.1V21l4.1-2.6c.9.2 1.8.3 2.7.3 5.5 0 10-3.8 10-8.5S17.5 2 12 2z"/></svg>';
function tick(state) { return `<svg class="tk ${state}" viewBox="0 0 17 11"><path d="M1 6l3.5 3.5L11 1.5"/><path class="b" d="M7 8.5l1 1L15 1.5"/></svg>`; }

// ---------- small helpers ----------
const AVG = ['#7c6cff,#35a8ff', '#ff7a45,#ff3d77', '#1fcf9a,#3dd6f5', '#f5b82e,#ff8a3d', '#ff4f8b,#a855f7', '#4f8cff,#22d3ee', '#7bd33a,#22c55e', '#e86bff,#6c5bff'];
const hashStr = (s) => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const NICKS = () => jget('nicks', {});
const dname = (u) => (u && (NICKS()[u.uid] || u.name)) || 'Deleted player';
function avatar(u, size = 48, o = {}) {
  u = u || {}; const nm = dname(u), url = u.avatar, g = AVG[hashStr(u.uid || nm) % AVG.length].split(',');
  const st = `--s:${size}px;--g:linear-gradient(135deg,${g[0]},${g[1]})` + (url ? `;background-image:url('${esc(url)}')` : '');
  return `<div class="av${o.ring ? ' ring' : o.ring2 ? ' ring2' : ''}" style="${st}">${url ? '' : esc(nm.trim().charAt(0).toUpperCase() || '?')}${o.dot ? `<i class="dot ${u.playing ? 'play' : u.online ? 'on' : ''}"></i>` : ''}</div>`;
}
function groupAvatar(c, size = 48) { return c.avatar ? avatar({ avatar: c.avatar, name: c.name }, size) : `<div class="av" style="--s:${size}px;--g:linear-gradient(135deg,#6d5bff,#35a8ff)">${ic('users', Math.round(size * .46))}</div>`; }
const two = (n) => String(n).padStart(2, '0');
const clock = (t) => { const d = new Date(t); return two(d.getHours()) + ':' + two(d.getMinutes()); };
function dayLabel(t) { const d = new Date(t), n = new Date(), y = new Date(Date.now() - 86400000); if (d.toDateString() === n.toDateString()) return 'Today'; if (d.toDateString() === y.toDateString()) return 'Yesterday'; return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric' }); }
function listTime(t) { if (!t) return ''; const d = new Date(t), n = new Date(); if (d.toDateString() === n.toDateString()) return clock(t); const diff = (n - d) / 86400000; if (diff < 2 && new Date(Date.now() - 86400000).toDateString() === d.toDateString()) return 'Yesterday'; if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' }); return d.toLocaleDateString([], { day: 'numeric', month: 'short' }); }
const plain = (t) => String(t == null ? '' : t).replace(/^[\p{Extended_Pictographic}️\s]+/u, '');
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
const fmtDur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + two(s % 60); };
const linkify = (t) => esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" data-url="$1" style="color:inherit;text-decoration:underline">$1</a>');
const firstUrl = (t) => { const m = /https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/.exec(t || ''); return m ? m[0] : ''; };
const jumbo = (t) => /^(\p{Extended_Pictographic}|‍|️|\s){1,3}$/u.test(t || '') && String(t || '').trim().length > 0;

// a row that was removed (deleted message, handled request...) slides out and the rows below close the gap
function exitEl(el) {
  const h = el.offsetHeight, dx = el.classList.contains('mine') ? 30 : -30; el.style.pointerEvents = 'none'; el.style.overflow = 'hidden';
  try { const an = el.animate([{ height: h + 'px', opacity: 1, transform: 'none' }, { height: '0px', opacity: 0, transform: 'translateX(' + dx + 'px)', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' }], { duration: 290, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }); an.onfinish = () => el.remove(); } catch (e) { el.remove(); }
  setTimeout(() => el.remove(), 450);
}
// ---------- keyed list update (no flicker, optional slide for reordered rows) ----------
function createEl(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function morphList(box, items, o = {}) {
  const map = box.__map || (box.__map = new Map()), first = !box.__init; box.__init = true;
  const before = o.flip ? new Map([...map].map(([k, el]) => [k, el.getBoundingClientRect().top])) : null; const used = new Set(); let prev = null, added = 0;
  items.forEach((it, i) => {
    let el = map.get(it.k);
    if (!el) { el = createEl(it.html); el.dataset.k = it.k; el.__h = it.html; map.set(it.k, el); added++; if (o.enter && (!first || o.enterFirst)) el.classList.add(o.enter); if (first && o.stagger && i < 12) { el.style.animation = `bin .4s var(--ease) ${i * 35}ms both`; } }
    else if (el.__h !== it.html) { const n = createEl(it.html), keep = el.classList.contains('in-anim'); el.innerHTML = n.innerHTML; el.className = n.className + (keep ? ' in-anim' : ''); const st = n.getAttribute('style'); if (st) el.setAttribute('style', st); else el.removeAttribute('style'); [...n.attributes].forEach((a) => { if (a.name !== 'class' && a.name !== 'style') el.setAttribute(a.name, a.value); }); el.__h = it.html; }
    used.add(it.k); const want = prev ? prev.nextSibling : box.firstChild; if (el !== want) box.insertBefore(el, want); prev = el;
  });
  const gone = []; for (const [k, el] of map) if (!used.has(k)) { map.delete(k); gone.push(el); }
  gone.forEach((el) => { if (first || gone.length > 3 || o.noExit || !el.isConnected || !el.offsetHeight) el.remove(); else exitEl(el); });   // a removed row fades out and closes up instead of vanishing
  if (before) for (const [k, top] of before) { const el = map.get(k); if (!el) continue; const d = top - el.getBoundingClientRect().top; if (Math.abs(d) > 2) el.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.22,1,.36,1)' }); }
  return added;
}

// ---------- toast, banner, sheet, dialog ----------
function toast(t, icon) { const e = $('#toast'); e.innerHTML = (icon ? ic(icon, 18) : '') + '<span>' + esc(t) + '</span>'; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2600); }
function showBanner(b) { const e = $('#banner'); e.innerHTML = avatar(b.u, 42) + `<div class="grow"><b class="ell">${esc(b.title)}</b><span class="ell">${esc(b.text)}</span></div>`; e.onclick = () => { e.classList.remove('on'); b.tap && b.tap(); }; e.classList.add('on'); hp('tap'); if (ls.get('inapp') !== '0') N('inAppSound'); clearTimeout(showBanner.t); showBanner.t = setTimeout(() => e.classList.remove('on'), 4200); }
let sheetOn = false;
function openSheet(html, o = {}) {
  const sh = $('#sheet'); sh.scrollTop = 0; sh.innerHTML = '<div class="grab"></div>' + html; sh.style.transform = ''; sh.classList.add('on'); $('#sheetbg').classList.add('on'); sheetOn = true; sh.__close = o.onClose || null;
  if (o.onOpen) o.onOpen(sh); return sh;
}
function closeSheet() { if (!sheetOn) return false; sheetOn = false; const sh = $('#sheet'); sh.classList.remove('on'); sh.style.transform = ''; $('#sheetbg').classList.remove('on'); const f = sh.__close; sh.__close = null; if (f) f(); return true; }
(function sheetDrag() {
  const sh = $('#sheet'); let y0 = 0, dy = 0, on = false, t0 = 0;
  sh.addEventListener('touchstart', (e) => { if (sh.scrollTop > 0 || e.touches.length !== 1) return; y0 = e.touches[0].clientY; dy = 0; on = true; t0 = Date.now(); }, { passive: true });
  sh.addEventListener('touchmove', (e) => { if (!on) return; dy = e.touches[0].clientY - y0; if (dy > 6) { sh.style.transition = 'none'; sh.style.transform = `translateY(${dy}px)`; } else if (dy < 0) { on = false; } }, { passive: true });
  const end = () => { if (!on) return; on = false; sh.style.transition = ''; if (dy > 110 || (dy > 40 && Date.now() - t0 < 200)) closeSheet(); else sh.style.transform = ''; };
  sh.addEventListener('touchend', end, { passive: true }); sh.addEventListener('touchcancel', end, { passive: true });
  $('#sheetbg').addEventListener('click', closeSheet);
})();
let dlgRes = null;
function dialog(o) {
  return new Promise((res) => {
    const d = $('#dlg'); d.innerHTML = `<h3>${esc(o.title || '')}</h3>${o.text ? `<p>${esc(o.text)}</p>` : ''}${o.input ? (o.multiline ? `<textarea class="inp" id="dlgin" rows="3" placeholder="${esc(o.placeholder || '')}">${esc(o.value || '')}</textarea>` : `<input class="inp" id="dlgin" placeholder="${esc(o.placeholder || '')}" value="${esc(o.value || '')}" maxlength="${o.max || 80}" autocomplete="off">`) : ''}<div class="btns">${o.cancel === false ? '' : `<button class="btn" id="dlgc">${esc(o.cancel || 'Cancel')}</button>`}<button class="btn ${o.danger ? 'danger' : 'pri'}" id="dlgo">${esc(o.ok || 'OK')}</button></div>`;
    const done = (v) => { if (!dlgRes) return; dlgRes = null; d.classList.remove('on'); $('#dlgbg').classList.remove('on'); res(v); };
    dlgRes = done; $('#dlgo').onclick = () => done(o.input ? ($('#dlgin').value) : true); const c = $('#dlgc'); if (c) c.onclick = () => done(o.input ? null : false); $('#dlgbg').onclick = () => done(o.input ? null : false);
    d.classList.add('on'); $('#dlgbg').classList.add('on'); if (o.input) setTimeout(() => { const i = $('#dlgin'); i && i.focus(); }, 280);
  });
}
const askConfirm = (title, text, ok, danger) => dialog({ title, text, ok: ok || 'OK', danger });
const askText = (title, value, placeholder, max, multiline) => dialog({ title, input: true, value, placeholder, max, ok: 'Save', multiline });

// ---------- pages (full screen, slide in) ----------
const PGS = [];
function pushPage(key, title, build, o = {}) {
  const el = document.createElement('div'); el.className = 'layer'; el.dataset.key = key;
  el.innerHTML = `<div class="lhead"><button class="ibtn flat pgback" aria-label="Back">${ic('back', 22)}</button><div class="ttl"><b class="pgt ell">${esc(title)}</b></div>${o.right || ''}</div><div class="pgbody"></div>`;
  $('#pages').appendChild(el); const page = { key, el, body: $('.pgbody', el), title: (t) => { $('.pgt', el).textContent = t; }, close: () => closePage(page), onClose: null };
  PGS.push(page); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on'))); setTimeout(() => el.classList.add('on'), 70); hp('tap');
  $('.pgback', el).onclick = () => closePage(page);
  try { build(page.body, page); } catch (e) { page.body.innerHTML = '<div class="empty"><h3>Something went wrong</h3>Please go back and try again.</div>'; reportError('page ' + key + ': ' + e.message); }
  return page;
}
function closePage(page) { page = page || PGS[PGS.length - 1]; if (!page) return false; const i = PGS.indexOf(page); if (i < 0) return false; PGS.splice(i, 1); page.el.classList.remove('on'); if (page.onClose) page.onClose(); setTimeout(() => page.el.remove(), 480); return true; }
const closeAllPages = () => { while (PGS.length) closePage(); };

// ---------- look: mode, accent, wallpaper, text size ----------
const ACCENTS = [['violet', 'Violet', '#7c6cff', '#35a8ff'], ['ocean', 'Ocean', '#2b8cff', '#22d3ee'], ['mint', 'Mint', '#1fcf9a', '#3dd6f5'], ['sunset', 'Sunset', '#ff7a45', '#ff3d77'], ['rose', 'Rose', '#ff4f8b', '#a855f7'], ['lime', 'Lime', '#7bd33a', '#22c55e'], ['gold', 'Gold', '#f5b82e', '#ff8a3d'], ['slate', 'Slate', '#6b7a99', '#94a3b8']];
const WALLS = [['aurora', 'Aurora'], ['dots', 'Dots'], ['night', 'Night'], ['plain', 'Plain']];
const prefs = () => Object.assign({ mode: 'auto', accent: 'violet', wall: 'aurora', fs: 1, rm: false, compact: false, dsave: '0', haptics: true, enterSend: false, preview: true }, jget('prefs', {}));
const setPref = (k, v) => { const p = prefs(); p[k] = v; jset('prefs', p); applyLook(); };
function applyLook() {
  const p = prefs(), r = document.documentElement, light = p.mode === 'light' || (p.mode === 'auto' && matchMedia('(prefers-color-scheme: light)').matches), a = ACCENTS.find((x) => x[0] === p.accent) || ACCENTS[0];
  r.classList.toggle('light', light); r.classList.toggle('rm', !!p.rm); r.classList.toggle('compact', !!p.compact); r.style.setProperty('--acc', a[2]); r.style.setProperty('--acc2', a[3]); r.style.setProperty('--fs', p.fs);
  const ch = $('#chat'); if (ch) ch.className = ch.className.replace(/\bw-\w+/g, '').trim() + ' w-' + p.wall;
  setTimeout(() => N('setBars', light ? '#f2f4fa' : '#080a10', light), 30);
}
try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (prefs().mode === 'auto') applyLook(); }); } catch (e) { }

// ---------- errors ----------
let errSent = 0;
function reportError(msg) { if (errSent >= 3 || !msg) return; errSent++; try { api('POST', '/client-error', { app: 'messages', v: CUR, msg: String(msg).slice(0, 180) }); } catch (e) { } }
window.addEventListener('error', (e) => reportError((e.message || 'error') + ' @' + (e.filename || '').split('/').pop() + ':' + (e.lineno || 0)));
window.addEventListener('unhandledrejection', (e) => reportError('promise: ' + (e.reason && e.reason.message || e.reason)));

// ---------- updates ----------
const vcmp = (a, b) => { a = String(a).split('.').map(Number); b = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x > y ? 1 : -1; } return 0; };
let UPD = null;
async function checkUpdate(manual) {
  const r = await raw('GET', VERSION_URL + '?t=' + Date.now(), {}); let j = null; try { j = JSON.parse(r.text); } catch (e) { }
  if (!j || !j.version || !/^https:\/\//.test(j.downloadUrl || '')) { if (manual) toast('Could not check for updates right now.', 'info'); return null; }
  ls.set('updAt', String(Date.now())); UPD = vcmp(j.version, CUR) > 0 ? j : null;
  if (UPD && ls.get('updSeen') !== j.version) { ls.set('updSeen', j.version); toast('Version ' + j.version + ' is available. See Settings.', 'download'); }
  if (manual) toast(UPD ? 'Version ' + j.version + ' is available' : 'You have the latest version (' + CUR + ')', UPD ? 'download' : 'check');
  return j;
}
function startUpdate() {
  if (!UPD) return; N('updReset'); N('updStart', UPD.downloadUrl, UPD.sha256 || '', +(UPD.size || 0)); hp('tap');
  openSheet(`<h3>Updating to ${esc(UPD.version)}</h3><div class="mut" id="updt" style="margin:6px 0 14px">Starting...</div><div style="height:8px;border-radius:4px;background:var(--surface3);overflow:hidden"><i id="updb" style="display:block;height:100%;width:0;background:var(--grad);transition:width .4s var(--ease)"></i></div><div id="upda" style="margin-top:16px"></div>`);
  const t = setInterval(() => {
    let s = {}; try { s = JSON.parse(N('updState') || '{}'); } catch (e) { } const tx = $('#updt'), b = $('#updb'); if (!tx) return clearInterval(t);
    if (s.state === 'downloading') { tx.textContent = 'Downloading... ' + (s.pct || 0) + '%'; b.style.width = (s.pct || 0) + '%'; }
    else if (s.state === 'installing') { tx.textContent = 'Almost there. Confirm the install on the Android screen.'; b.style.width = '100%'; }
    else if (s.state === 'needperm') { tx.textContent = 'Android needs your OK before the app can update itself.'; $('#upda').innerHTML = '<button class="btn pri wide" id="updp">Allow</button>'; $('#updp').onclick = () => N('openInstallSettings'); }
    else if (s.state === 'error') { clearInterval(t); tx.textContent = s.error || 'The update did not work.'; $('#upda').innerHTML = '<button class="btn pri wide" id="updr">Try again</button>'; $('#updr').onclick = () => { closeSheet(); startUpdate(); }; }
    else if (s.state === 'done') { clearInterval(t); tx.textContent = 'Updated! Restarting...'; }
  }, 600);
}
