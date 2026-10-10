'use strict';
// ====================== voice and video calls (one to one) ======================
// The two phones talk to each other directly (WebRTC). The server only passes the set-up notes (offer, answer, network routes) and rings the other phone.
let CALL = null, ringCtx = null, ringT = 0, tickT = 0, wantAccept = '';
const dismissedCalls = new Set();
const callSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.RTCPeerConnection);

function callPerms(video) {
  return new Promise((res) => { CB.callperm = (v) => res(v === 'granted'); const r = N('callPerms', !!video); if (r === undefined) res(true); });
}

// ---------- the ring: a soft two-tone, and a buzz for the incoming one ----------
function stopRing() { clearInterval(ringT); ringT = 0; }
function startRing(kind) {
  stopRing();
  try {
    const ac = ringCtx || (ringCtx = new (window.AudioContext || window.webkitAudioContext)()); if (ac.resume) ac.resume();
    const tone = (at, dur) => [440, 480].forEach((f) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(kind === 'in' ? .09 : .05, at + .05); g.gain.setValueAtTime(kind === 'in' ? .09 : .05, at + dur - .06); g.gain.linearRampToValueAtTime(0, at + dur); o.connect(g); g.connect(ac.destination); o.start(at); o.stop(at + dur + .02); });
    const cycle = () => { const t = ac.currentTime + .02; if (kind === 'in') { tone(t, .42); tone(t + .6, .42); hp('heavy'); setTimeout(() => hp('heavy'), 600); } else tone(t, 1.6); };
    cycle(); ringT = setInterval(cycle, kind === 'in' ? 3200 : 4500);
  } catch (e) { }
}

// ---------- the call screen ----------
const callEl = () => $('#call');
function callUser() { return (CALL && CALL.user) || {}; }
function buildCall() {
  const el = callEl(); if (el.__built) return; el.__built = true;
  el.innerHTML = `<div class="cbg"></div><video id="rv" playsinline autoplay></video><div class="cshade"></div>
  <button class="cmin" id="cmin" aria-label="Minimise">${ic('down', 24)}</button><div class="cenc">${ic('lock', 12)} Direct and private</div>
  <div class="cmid" id="cmid"></div><video id="lv" playsinline autoplay muted></video><div class="cctl" id="cctl"></div>`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]'); if (!b || !CALL) return; hp('tap'); const a = b.dataset.c;
    if (a === 'acc') acceptCall(); else if (a === 'dec') declineCall(); else if (a === 'end') hangup(); else if (a === 'mute') toggleMute(); else if (a === 'spk') toggleSpeaker(); else if (a === 'cam') toggleCam(); else if (a === 'flip') flipCam();
  });
  $('#cmin').onclick = minimizeCall; $('#callbar').onclick = () => showCall();
  $('#lv').onclick = () => $('#call').classList.toggle('swap');
}
function showCall() { buildCall(); const el = callEl(); CALL.min = false; el.classList.add('on'); $('#callbar').classList.remove('on'); paintCall(); }
function minimizeCall() { if (!CALL) return; CALL.min = true; callEl().classList.remove('on'); paintBar(); }
window.callBack = () => { if (!CALL || !callEl().classList.contains('on')) return false; if (CALL.state === 'incoming') return true; minimizeCall(); return true; };
function paintBar() { const b = $('#callbar'); if (!b) return; const on = !!(CALL && CALL.min); b.classList.toggle('on', on); if (on) b.innerHTML = `<i class="rd"></i>${ic('phone', 14)}<span>${esc(statusText())}</span><b>${esc(dname(callUser()))}</b>`; }
function statusText() {
  if (!CALL) return '';
  if (CALL.note) return CALL.note;
  if (CALL.weak) return 'Reconnecting...';
  return { start: 'Starting...', ringing: 'Calling...', incoming: CALL.video ? 'Incoming video call' : 'Incoming voice call', connecting: 'Connecting...', live: fmtDur(Date.now() - CALL.t0) }[CALL.state] || '';
}
function paintCall() {
  if (!CALL) return; buildCall(); const el = callEl(), c = CALL, u = callUser(), live = c.state === 'live', showVid = c.video && (live || c.state === 'connecting');
  el.classList.toggle('vid', !!c.video); el.classList.toggle('livev', !!(showVid && c.peerCam)); el.classList.toggle('lvon', !!(c.video && c.cam && c.local)); el.classList.toggle('ring', c.state === 'incoming' || c.state === 'ringing' || c.state === 'start'); el.classList.toggle('front', c.front);
  $('#cmin').style.display = c.state === 'incoming' ? 'none' : '';
  const bg = el.querySelector('.cbg'); const url = u.avatar || ''; if (bg.__u !== url) { bg.__u = url; bg.style.backgroundImage = url ? `url('${esc(url)}')` : ''; }
  const mid = $('#cmid'), peerOff = c.video && live && !c.peerCam;
  const h = `<div class="cav">${c.state === 'incoming' || c.state === 'ringing' ? '<i></i><i></i><i></i>' : ''}${avatar(u, 132, { ring: live })}</div><h2>${esc(dname(u))}</h2><p id="cst">${esc(statusText())}</p>${live && !c.peerMic ? `<small class="cnote">${ic('micoff', 13)} ${esc((u.name || '').split(' ')[0] || 'They')} is muted</small>` : ''}${peerOff ? `<small class="cnote">${ic('camoff', 13)} Camera is off</small>` : ''}`;
  if (mid.__h !== h) { mid.__h = h; mid.innerHTML = h; }
  const B = (a, icon, label, cls = '', on = false) => `<div class="cb"><button class="cbtn ${cls}${on ? ' on' : ''}" data-c="${a}" aria-label="${label}">${icon}</button><span>${label}</span></div>`;
  let ctl;
  if (c.state === 'incoming') ctl = `<div class="crow2">${B('dec', ic('phone', 28), 'Decline', 'red')}${B('acc', ic(c.video ? 'video' : 'phone', 28), 'Accept', 'green pulse')}</div>`;
  else ctl = `<div class="crow2">${B('mute', ic(c.muted ? 'micoff' : 'mic', 24), c.muted ? 'Unmute' : 'Mute', '', c.muted)}${c.video ? B('cam', ic(c.cam ? 'video' : 'camoff', 24), c.cam ? 'Camera' : 'Camera off', '', !c.cam) + B('flip', ic('refresh', 24), 'Flip') : B('spk', ic('volume', 24), 'Speaker', '', c.speaker)}${B('end', ic('phone', 28), 'End', 'red')}</div>`;
  const cc = $('#cctl'); if (cc.__h !== ctl) { cc.__h = ctl; cc.innerHTML = ctl; }
  paintBar();
}
function tickCall() { const t = $('#cst'); if (t && CALL) t.textContent = statusText(); paintBar(); }

// ---------- the connection ----------
async function openMedia() {
  const c = CALL;
  c.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: c.video ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } : false });
  N('callState', true, dname(c.user), !!c.video); N('setSpeaker', !!c.speaker);
  const lv = $('#lv'); if (lv && c.video) { lv.srcObject = c.local; lv.play().catch(() => { }); }
}
async function makePc() {
  const c = CALL, r = await api('GET', '/social/call/ice');
  const pc = new RTCPeerConnection({ iceServers: (r.servers && r.servers.length) ? r.servers : [{ urls: 'stun:stun.l.google.com:19302' }], bundlePolicy: 'max-bundle' }); c.pc = pc;
  c.local.getTracks().forEach((t) => pc.addTrack(t, c.local));
  c.ctl = pc.createDataChannel('ctl', { negotiated: true, id: 1 });
  c.ctl.onopen = () => sendCtl({ cam: c.cam, mic: !c.muted });
  c.ctl.onmessage = (e) => { try { const m = JSON.parse(e.data); if ('cam' in m) c.peerCam = !!m.cam; if ('mic' in m) c.peerMic = !!m.mic; if (m.bye && CALL === c) { remoteEnded('ended'); return; } paintCall(); } catch (x) { } };
  pc.onicecandidate = (e) => { if (e.candidate) { c.buf.push(JSON.stringify(e.candidate)); flushCandSoon(); } };
  pc.ontrack = (e) => { c.remote = e.streams[0] || c.remote || new MediaStream(); if (!e.streams[0]) c.remote.addTrack(e.track); const rv = $('#rv'); rv.srcObject = c.remote; rv.play().catch(() => { }); };
  pc.onconnectionstatechange = () => {
    if (CALL !== c) return; const s = pc.connectionState;
    if (s === 'connected') { clearTimeout(c.dcT); c.weak = false; if (c.state !== 'live') goLive(); else { paintCall(); } }
    else if (s === 'disconnected') { c.weak = true; paintCall(); clearTimeout(c.dcT); c.dcT = setTimeout(() => { if (CALL === c && pc.connectionState !== 'connected') hangup('lost'); }, 14000); }
    else if (s === 'failed') { remoteEnded('lost'); hangup('lost', true); }
  };
  return pc;
}
const sendCtl = (m) => { try { if (CALL && CALL.ctl && CALL.ctl.readyState === 'open') CALL.ctl.send(JSON.stringify(m)); } catch (e) { } };
let candT = 0;
function flushCandSoon() { clearTimeout(candT); candT = setTimeout(flushCand, 350); }
async function flushCand() {
  const c = CALL; if (!c || !c.id || !c.buf.length) return;
  while (c.buf.length && CALL === c) { const part = c.buf.splice(0, 24); await api('POST', '/social/call/cand', { id: c.id, c: part }); }
}
async function drainIce() {
  const c = CALL; if (!c || !c.pc || !c.pc.remoteDescription) return;
  while (c.ice.length) { const x = c.ice.shift(); try { await c.pc.addIceCandidate(JSON.parse(x)); } catch (e) { } }
}
function loop() {
  const c = CALL; if (!c) return; clearTimeout(c.pt);
  const run = async () => {
    if (CALL !== c) return;
    const r = await api('GET', '/social/call/poll?id=' + c.id + '&after=' + c.after); if (CALL !== c) return;
    if (r.http === 404) return remoteEnded('ended');
    if (!r.error) {
      if (c.dir === 'out' && r.answer && !c.gotAnswer) { c.gotAnswer = true; try { await c.pc.setRemoteDescription(JSON.parse(r.answer)); } catch (e) { return hangup('lost'); } stopRing(); c.state = 'connecting'; paintCall(); }
      (r.ice || []).forEach((x) => { c.after = Math.max(c.after, x.n); c.ice.push(x.c); }); drainIce();
      if (r.state === 'ended') return remoteEnded(r.reason);
    }
    c.pt = setTimeout(run, c.state === 'live' ? 2200 : 900);
  };
  run();
}
function goLive() {
  const c = CALL; if (!c) return; stopRing(); c.state = 'live'; c.t0 = Date.now(); c.weak = false; hp('ok'); clearTimeout(c.ringTO);
  clearInterval(tickT); tickT = setInterval(tickCall, 1000); paintCall();
}

// ---------- start, answer, hang up ----------
function startCall(video) {
  if (CALL) { showCall(); return; }
  const i = CH && CH.info, peer = peerOf(); if (!i || i.kind !== 'dm' || !peer) return;
  if (!callSupported()) return toast('Calls are not available on this phone', 'info');
  if (S.offline) return toast('You are offline', 'info');
  CALL = { dir: 'out', user: { uid: i.peerUid, name: peer.name, avatar: peer.avatar }, video: !!video, state: 'start', id: '', after: 0, buf: [], ice: [], muted: false, cam: !!video, front: true, speaker: !!video, peerCam: !!video, peerMic: true, t0: 0 };
  hp('tap'); showCall(); outgoing();
}
async function outgoing() {
  const c = CALL, u = c.user;
  if (!(await callPerms(c.video))) { if (CALL === c) endCall('Allow the microphone' + (c.video ? ' and camera' : '') + ' in your phone settings to make calls.'); return; }
  if (CALL !== c) return;
  try {
    await openMedia(); if (CALL !== c) return releaseMedia(c);
    const pc = await makePc(); if (CALL !== c) return;
    const off = await pc.createOffer(); await pc.setLocalDescription(off);
    const r = await api('POST', '/social/call/start', { uid: u.uid, video: c.video, offer: JSON.stringify({ type: off.type, sdp: off.sdp }) });
    if (r.id && CALL !== c) { api('POST', '/social/call/end', { id: r.id }); return; }
    if (CALL !== c) return;
    if (r.busy) return endCall(dname(u).split(' ')[0] + ' is on another call.');
    if (r.error || !r.id) return endCall(r.error || 'Could not start the call.');
    c.id = r.id; c.state = 'ringing'; paintCall(); startRing('out'); flushCand(); loop();
    c.ringTO = setTimeout(() => { if (CALL === c && c.state === 'ringing') hangup(); }, 42000);
  } catch (e) { if (CALL === c) endCall(e && e.name === 'NotAllowedError' ? 'Allow the microphone' + (c.video ? ' and camera' : '') + ' in your phone settings.' : 'Could not start the call.'); }
}
function showIncoming(call) {
  if (CALL) return;
  CALL = { dir: 'in', id: call.id, user: call.from, video: !!call.video, offer: call.offer, state: 'incoming', after: 0, buf: [], ice: [], muted: false, cam: !!call.video, front: true, speaker: !!call.video, peerCam: !!call.video, peerMic: true, t0: 0 };
  startRing('in'); showCall(); loop();
  CALL.ringTO = setTimeout(() => { if (CALL && CALL.state === 'incoming') { dismissedCalls.add(CALL.id); endCall(''); } }, 44000);
  if (wantAccept === call.id) { wantAccept = ''; acceptCall(); }
}
async function acceptCall() {
  const c = CALL; if (!c || c.dir !== 'in' || c.state !== 'incoming') return;
  c.state = 'connecting'; stopRing(); clearTimeout(c.ringTO); paintCall();
  if (!(await callPerms(c.video))) { api('POST', '/social/call/end', { id: c.id }); if (CALL === c) endCall('Allow the microphone' + (c.video ? ' and camera' : '') + ' in your phone settings to answer calls.'); return; }
  if (CALL !== c) return;
  try {
    await openMedia(); const pc = await makePc();
    await pc.setRemoteDescription(JSON.parse(c.offer)); await drainIce();
    const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
    const r = await api('POST', '/social/call/answer', { id: c.id, answer: JSON.stringify({ type: ans.type, sdp: ans.sdp }) });
    if (CALL !== c) return;
    if (r.error) return endCall('This call is over.');
    c.gotAnswer = true; flushCand(); loop();
  } catch (e) { if (CALL === c) { api('POST', '/social/call/end', { id: c.id }); endCall('Could not answer the call.'); } }
}
function declineCall() { const c = CALL; if (!c) return; dismissedCalls.add(c.id); api('POST', '/social/call/end', { id: c.id }); endCall(''); }
function hangup(why, quiet) {
  const c = CALL; if (!c) return; sendCtl({ bye: 1 }); if (c.id) api('POST', '/social/call/end', { id: c.id });
  if (!quiet) endCall(c.state === 'live' ? 'Call ended' : c.state === 'ringing' || c.state === 'start' ? 'Cancelled' : why === 'lost' ? 'Connection lost' : 'Call ended');
}
function remoteEnded(reason) {
  const c = CALL; if (!c) return; if (c.id) dismissedCalls.add(c.id);
  const m = reason === 'declined' ? 'Call declined' : (reason === 'missed' || reason === 'cancelled') && c.dir === 'out' ? 'No answer' : reason === 'lost' ? 'Connection lost' : c.state === 'incoming' ? '' : 'Call ended';
  endCall(m);
}
function releaseMedia(c) { try { c.local && c.local.getTracks().forEach((t) => t.stop()); } catch (e) { } N('callState', false, '', false); }
function endCall(note) {
  const c = CALL; if (!c || c.end) return; c.end = true; stopRing(); clearInterval(tickT); clearTimeout(c.pt); clearTimeout(c.ringTO); clearTimeout(c.dcT);
  try { c.ctl && c.ctl.close(); } catch (e) { } try { c.pc && c.pc.close(); } catch (e) { } releaseMedia(c);
  const rv = $('#rv'), lv = $('#lv'); if (rv) rv.srcObject = null; if (lv) lv.srcObject = null;
  if (!note) { CALL = null; callEl().classList.remove('on'); paintBar(); return; }
  c.note = note; c.state = 'ended'; hp('tap'); paintCall(); if (!c.min) callEl().classList.add('on');
  setTimeout(() => { if (CALL === c) { CALL = null; callEl().classList.remove('on'); $('#callbar').classList.remove('on'); } }, 1500);
}

// ---------- in-call controls ----------
function toggleMute() { const c = CALL; if (!c || !c.local) return; c.muted = !c.muted; c.local.getAudioTracks().forEach((t) => { t.enabled = !c.muted; }); sendCtl({ mic: !c.muted }); paintCall(); }
function toggleSpeaker() { const c = CALL; if (!c) return; c.speaker = !c.speaker; N('setSpeaker', c.speaker); paintCall(); }
function toggleCam() { const c = CALL; if (!c || !c.local) return; c.cam = !c.cam; c.local.getVideoTracks().forEach((t) => { t.enabled = c.cam; }); sendCtl({ cam: c.cam }); paintCall(); }
async function flipCam() {
  const c = CALL; if (!c || !c.local || !c.pc) return;
  try {
    const old = c.local.getVideoTracks()[0]; if (old) old.stop(); c.front = !c.front;
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: c.front ? 'user' : 'environment', width: { ideal: 640 }, height: { ideal: 480 } } }), t = s.getVideoTracks()[0]; t.enabled = c.cam;
    const sender = c.pc.getSenders().find((x) => x.track && x.track.kind === 'video') || c.pc.getSenders().find((x) => !x.track);
    if (sender) await sender.replaceTrack(t);
    if (old) c.local.removeTrack(old); c.local.addTrack(t); $('#lv').srcObject = c.local; paintCall();
  } catch (e) { toast('Could not switch the camera', 'info'); }
}

// ---------- incoming calls: the push brings you here, and this checks every few seconds while the app is open ----------
async function pollCall() {
  if (!S.tok || CALL || !callSupported()) return;
  const r = await api('GET', '/social/call/incoming'); if (CALL || !r || !r.call || dismissedCalls.has(r.call.id)) return;
  showIncoming(r.call);
}
setInterval(() => { if (document.visibilityState !== 'hidden') pollCall(); }, 4000);
(function () { const prev = window.onResumeApp; window.onResumeApp = () => { if (prev) prev(); pollCall(); }; })();
window.callFromNotif = (cid, accept) => { if (accept) wantAccept = cid; pollCall(); setTimeout(pollCall, 1200); };
window.callEnded = (cid) => { if (CALL && CALL.id === cid && CALL.state === 'incoming') remoteEnded('cancelled'); };
