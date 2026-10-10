'use strict';
// ====================== contact info, group info, media, groups ======================
function openInfo() { const i = CH && CH.info; if (!i) return; if (i.kind === 'dm') openContact(i.peerUid, true); else groupInfo(); }
async function openGallery(convId) {
  pushPage('gallery', 'Photos and media', async (b) => {
    b.innerHTML = '<div class="gal">' + Array(9).fill('<div class="sk" style="aspect-ratio:1;border-radius:0"></div>').join('') + '</div>';
    const r = await api('GET', '/social/gallery?conv=' + convId), l = r.items || [];
    const list = l.map((x) => ({ src: x.kind === 'gif' ? (x.data && x.data.url) : MEDIA + (x.data && x.data.id), by: x.name }));
    b.innerHTML = l.length ? `<div class="gal">${list.map((x, i) => `<img data-i="${i}" src="${esc(x.src)}" alt="Photo" loading="lazy" decoding="async">`).join('')}</div>` : `<div class="empty"><div class="big">${ic('image', 40)}</div><h3>No photos yet</h3>Photos and GIFs sent in this chat show up here.</div>`;
    b.onclick = (e) => { const im = e.target.closest('[data-i]'); if (im) openViewer(list, +im.dataset.i); };
  });
}
async function openContact(uid, fromChat) {
  pushPage('contact', 'Contact', async (b, page) => {
    b.innerHTML = '<div class="prof"><div class="sk" style="width:110px;height:110px;border-radius:50%"></div></div>';
    const [p, g] = await Promise.all([api('GET', '/social/profile?uid=' + uid), fromChat && CH ? api('GET', '/social/gallery?conv=' + CH.id) : Promise.resolve({ items: [] })]); if (p.error) { b.innerHTML = `<div class="empty"><h3>${esc(p.error)}</h3></div>`; return; }
    const f = S.byUid && S.byUid[uid], c = p.custom || {}, nick = NICKS()[uid], st = f && f.streak ? f : null, imgs = (g.items || []).slice(0, 6);
    const conv = fromChat && CH ? CH.id : (S.ov && S.ov.convs.find((x) => x.peer === uid) || {}).id;
    b.innerHTML = `<div class="prof">${avatar({ avatar: p.avatar, name: p.name, uid, online: p.online, playing: p.playing }, 110, { dot: true })}<h2>${esc(nick || p.name)}</h2>${nick ? `<div class="mut3">${esc(p.name)}</div>` : ''}<div class="st">${p.playing ? 'Playing ' + esc(p.playing.name) : c.status ? esc(c.status) : p.online ? 'Online' : 'Offline'}</div>${c.tagline ? `<div class="mut" style="margin-top:8px;font-style:italic">${esc(c.tagline)}</div>` : ''}${c.title ? `<span class="chip" style="margin-top:10px">${esc(c.title)}</span>` : ''}</div>
    <div class="acts">${conv ? `<button data-a="msg">${ic('chats', 22)}Message</button>` : ''}<button data-a="mute">${ic(f && S.ov && (S.ov.convs.find((x) => x.peer === uid) || {}).muted ? 'bell' : 'bellOff', 22)}Mute</button>${conv ? `<button data-a="media">${ic('image', 22)}Media</button>` : ''}<button data-a="nick">${ic('edit', 22)}Nickname</button></div>
    ${st ? `<div class="card" style="margin-top:14px"><div class="row"><div class="ri" style="background:color-mix(in srgb,var(--flame) 16%,transparent);color:var(--flame)">${ic('flame', 22, true)}</div><div class="rt"><b>${st.streak}-day streak</b><small>${st.doneToday ? 'Done for today' : st.mineToday ? 'Waiting for them today' : 'Message today to keep it'}${st.best ? ' · best ' + st.best : ''}</small></div></div></div>` : ''}
    ${p.bio ? `<div class="card" style="margin-top:12px;padding:14px 16px"><div class="mut3" style="font-size:.78em;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">About</div>${esc(p.bio)}</div>` : ''}
    ${imgs.length ? `<div class="sec">Shared media</div><div class="gal" style="margin:0 16px;border-radius:18px;overflow:hidden">${imgs.map((x, i) => `<img data-i="${i}" src="${esc(x.kind === 'gif' ? x.data.url : MEDIA + x.data.id)}" alt="Photo" loading="lazy">`).join('')}</div>` : ''}
    <div class="card" style="margin-top:16px">${p.relation === 'friends' ? `<button class="row tap" data-a="rm" style="width:100%;text-align:left;color:var(--bad)"><div class="ri" style="background:color-mix(in srgb,var(--bad) 14%,transparent);color:var(--bad)">${ic('x', 20)}</div><div class="rt"><b>Remove friend</b></div></button>` : p.relation === 'none' ? `<button class="row tap" data-a="add" style="width:100%;text-align:left"><div class="ri">${ic('userplus', 20)}</div><div class="rt"><b>Add friend</b></div></button>` : ''}<button class="row tap" data-a="blk" style="width:100%;text-align:left;color:var(--bad)"><div class="ri" style="background:color-mix(in srgb,var(--bad) 14%,transparent);color:var(--bad)">${ic('shield', 20)}</div><div class="rt"><b>Block</b></div></button><button class="row tap" data-a="rep" style="width:100%;text-align:left;color:var(--bad)"><div class="ri" style="background:color-mix(in srgb,var(--bad) 14%,transparent);color:var(--bad)">${ic('flag', 20)}</div><div class="rt"><b>Report</b></div></button></div>`;
    b.onclick = async (e) => {
      const im = e.target.closest('[data-i]'); if (im) return openViewer(imgs.map((x) => ({ src: x.kind === 'gif' ? x.data.url : MEDIA + x.data.id, by: x.name })), +im.dataset.i);
      const a = e.target.closest('[data-a]'); if (!a) return; const k = a.dataset.a; hp('tap');
      if (k === 'msg') { page.close(); if (fromChat) return; const r = await api('POST', '/social/dm', { uid }); if (!r.error) { go('chats'); openChat(r.id); } }
      else if (k === 'media') { openGallery(conv); }
      else if (k === 'mute') { const cv = S.ov && S.ov.convs.find((x) => x.peer === uid); if (cv) muteSheet(cv.id, cv.muted); else toast('Send a message first.', 'info'); }
      else if (k === 'nick') { const n = await askText('Nickname for ' + p.name, nick || '', 'Leave empty to remove', 24); if (n === null) return; const m = NICKS(); if (n.trim()) m[uid] = n.trim().slice(0, 24); else delete m[uid]; jset('nicks', m); toast('Saved', 'check'); page.close(); renderChats(); renderPeople(); if (CH) paintHead(); }
      else if (k === 'add') { const x = await api('POST', '/social/friend', { uid }); toast(x.error || 'Request sent', x.error ? 'info' : 'check'); }
      else if (k === 'rm') { if (await askConfirm('Remove ' + p.name + '?', 'You can add them again later.', 'Remove', true)) { await api('POST', '/social/unfriend', { uid }); tickOverview(true); closeAllPages(); closeChatNow(); } }
      else if (k === 'blk') { if (await askConfirm('Block ' + p.name + '?', 'They are removed from your friends and cannot message you.', 'Block', true)) { await api('POST', '/social/block', { uid, on: true }); tickOverview(true); closeAllPages(); closeChatNow(); toast('Blocked', 'shield'); } }
      else if (k === 'rep') { const why = await askText('Report ' + p.name, '', 'What is wrong?', 200, true); if (why && why.trim().length > 2) { const r = await api('POST', '/social/report', { uid, reason: why.trim() }); toast(r.error || 'Thanks, we will take a look.', r.error ? 'info' : 'check'); } }
    };
  });
}

// ---------- groups ----------
function groupInfo() {
  const id = CH.id; pushPage('group', 'Group info', (b, page) => {
    const draw = () => {
      const i = CH && CH.id === id ? CH.info : null; if (!i) { page.close(); return; } const me = S.me.uid, mem = i.members || [], mine = !!i.owner;
      b.innerHTML = `<div class="prof"><div style="position:relative">${groupAvatar(i, 110)}${mine ? `<button class="ibtn" id="gpic" style="position:absolute;right:-6px;bottom:-6px;background:var(--grad);color:#fff;box-shadow:0 6px 16px rgba(0,0,0,.3)" aria-label="Change picture">${ic('image', 19)}</button>` : ''}</div><h2>${esc(i.name)}</h2><div class="mut">${mem.length} member${mem.length === 1 ? '' : 's'}</div></div>
      <div class="acts"><button data-a="mute">${ic(i.muted ? 'bell' : 'bellOff', 22)}${i.muted ? 'Unmute' : 'Mute'}</button><button data-a="search">${ic('search', 22)}Search</button><button data-a="media">${ic('image', 22)}Media</button>${mine ? `<button data-a="ren">${ic('edit', 22)}Rename</button>` : ''}</div>
      <div class="sec">Members</div><div class="card">${mem.map((m) => `<div class="row tap" data-m="${m.uid}">${avatar(m, 42, { dot: true })}<div class="rt"><b>${esc(m.uid === me ? 'You' : dname(m))}${m.role === 'owner' ? ' <span class="chip" style="margin-left:6px">Owner</span>' : ''}</b><small>${m.playing ? 'Playing ' + esc(m.playing.name) : m.online ? 'Online' : 'Offline'}</small></div>${mine && m.uid !== me ? `<button class="ibtn flat" data-rm="${m.uid}" aria-label="Remove">${ic('x', 18)}</button>` : ''}</div>`).join('')}</div>
      ${mine ? `<div class="card" style="margin-top:12px"><button class="row tap" data-a="add" style="width:100%;text-align:left"><div class="ri">${ic('userplus', 20)}</div><div class="rt"><b>Add people</b></div></button></div>` : ''}
      <div class="card" style="margin-top:12px"><button class="row tap" data-a="leave" style="width:100%;text-align:left;color:var(--bad)"><div class="ri" style="background:color-mix(in srgb,var(--bad) 14%,transparent);color:var(--bad)">${ic('logout', 20)}</div><div class="rt"><b>Leave group</b></div></button></div>`;
    };
    draw(); page.onClose = () => { };
    const iv = setInterval(() => { if (!document.body.contains(b)) return clearInterval(iv); const sig = JSON.stringify(CH && CH.info && [CH.info.name, CH.info.avatar, CH.info.muted, (CH.info.members || []).map((m) => m.uid + m.online)]); if (b.__sig !== sig) { b.__sig = sig; draw(); } }, 1500);
    b.onclick = async (e) => {
      const rm = e.target.closest('[data-rm]'); if (rm) { e.stopPropagation(); const m = CH.info.members.find((x) => x.uid === rm.dataset.rm); if (await askConfirm('Remove ' + dname(m) + '?', 'They are taken out of the group.', 'Remove', true)) { const r = await api('POST', '/social/group/remove', { conv: id, uid: rm.dataset.rm }); if (r.error) return toast(r.error, 'info'); await loadConv(false); toast('Removed', 'check'); draw(); } return; }
      const mm = e.target.closest('[data-m]'); const a = e.target.closest('[data-a]');
      if (a) { const k = a.dataset.a; hp('tap');
        if (k === 'mute') muteSheet(id, CH.info.muted); else if (k === 'search') { page.close(); setTimeout(searchInChat, 380); } else if (k === 'media') openGallery(id);
        else if (k === 'ren') { const n = await askText('Group name', CH.info.name, 'Name', 32); if (n && n.trim().length > 1) { const r = await api('POST', '/social/group/rename', { conv: id, name: n.trim() }); if (r.error) return toast(r.error, 'info'); CH.info.name = n.trim(); paintHead(); draw(); tickOverview(true); } }
        else if (k === 'add') addToGroup(id, draw);
        else if (k === 'leave') { if (await askConfirm('Leave this group?', 'Someone else becomes the owner if you are the owner.', 'Leave', true)) { const r = await api('POST', '/social/group/remove', { conv: id, uid: S.me.uid }); if (r.error) return toast(r.error, 'info'); closeAllPages(); closeChat(); tickOverview(true); } }
      } else if (mm && mm.dataset.m !== S.me.uid) openContact(mm.dataset.m);
      if (e.target.closest('#gpic')) groupPic(id, draw);
    };
  });
}
function groupPic(id, done) {
  const pid = 'p' + hex(4); toast('Choose a picture...', 'image');
  CB[pid] = (json) => {
    let f = null; try { f = JSON.parse(json || 'null'); } catch (e) { } if (!f || !f.data) return toast('No picture chosen.', 'info'); const img = new Image();
    img.onload = async () => { const s = Math.min(img.width, img.height), cv = document.createElement('canvas'); cv.width = cv.height = 256; cv.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256); const d = cv.toDataURL('image/jpeg', .85).split(',')[1]; toast('Uploading...', 'download'); const u = await api('POST', '/media', { mime: 'image/jpeg', data: d }); if (!u.ok) return toast(u.error || 'Could not upload', 'info'); const r = await api('POST', '/social/group/avatar', { conv: id, media: u.id }); if (r.error) return toast(r.error, 'info'); hp('ok'); toast('Group picture updated', 'check'); if (CH && CH.id === id) { CH.info.avatar = MEDIA + u.id; paintHead(); } tickOverview(true); if (done) done(); };
    img.onerror = () => toast('Could not read that picture', 'info'); img.src = 'data:' + (f.mime || 'image/jpeg') + ';base64,' + f.data;
  }; N('pickImage', pid);
}
function addToGroup(convId, done) {
  const inn = new Set(((CH && CH.info && CH.info.members) || []).map((m) => m.uid)), fr = (S.ov ? S.ov.friends : []).filter((f) => !inn.has(f.uid)); if (!fr.length) return toast('All your friends are already in this group.', 'info');
  openSheet(`<h3>Add people</h3>${fr.map((f) => `<button class="act" data-u="${f.uid}">${avatar(f, 40)}<span class="grow">${esc(dname(f))}</span></button>`).join('')}`, { onOpen: (sh) => { sh.onclick = async (e) => { const b = e.target.closest('[data-u]'); if (!b) return; closeSheet(); const r = await api('POST', '/social/group/add', { conv: convId, uid: b.dataset.u }); if (r.error) return toast(r.error, 'info'); hp('ok'); toast('Added', 'check'); await loadConv(false); if (done) done(); }; } });
}
function groupCreate() {
  const fr = S.ov ? S.ov.friends.slice().sort((a, b) => dname(a).localeCompare(dname(b))) : []; if (!fr.length) return toast('Add some friends first.', 'info'); const sel = new Set();
  openSheet(`<h3>New group</h3><input class="inp" id="gn" placeholder="Group name" maxlength="32" autocomplete="off" style="margin:8px 0 6px"><div class="mut" style="margin:6px 0 4px" id="gcount">Pick at least one friend (up to 19)</div><div id="gl" style="max-height:42vh;overflow-y:auto">${fr.map((f) => `<button class="act" data-u="${f.uid}">${avatar(f, 40)}<span class="grow">${esc(dname(f))}</span><span class="chk" style="width:26px;height:26px;border-radius:50%;border:2px solid var(--line2);display:grid;place-items:center;color:#fff;transition:all .2s var(--ease)"></span></button>`).join('')}</div><button class="btn pri wide" id="gmk" style="margin-top:12px" disabled>Create group</button>`, { onOpen: (sh) => {
    sh.onclick = async (e) => { const b = e.target.closest('[data-u]'); if (b) { const u = b.dataset.u; if (sel.has(u)) sel.delete(u); else if (sel.size < 19) sel.add(u); const c = $('.chk', b), on = sel.has(u); c.style.background = on ? 'var(--acc)' : ''; c.style.borderColor = on ? 'var(--acc)' : ''; c.innerHTML = on ? ic('check', 14) : ''; hp('tap'); $('#gcount').textContent = sel.size ? sel.size + ' selected' : 'Pick at least one friend (up to 19)'; $('#gmk').disabled = !sel.size; return; }
      if (e.target.closest('#gmk')) { const n = $('#gn').value.trim(); if (n.length < 2) return toast('Give the group a name.', 'info'); const r = await api('POST', '/social/group', { name: n, members: [...sel] }); if (r.error) return toast(r.error, 'info'); closeSheet(); hp('ok'); await tickOverview(true); go('chats'); if (r.id) openChat(r.id); } };
  } });
}
