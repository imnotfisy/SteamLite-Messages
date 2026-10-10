// Renders the SteamLite sound packs (same recipes as the PC app) to audio files for Android notifications and ringtones.
// Usage: node tools/gen_sounds.js   (needs ffmpeg on the PATH or FFMPEG=path)  ->  app/src/main/res/raw/snd_<pack>_<msg|act|ring>.ogg
const fs = require('fs'), path = require('path'), cp = require('child_process');
const SR = 32000, OUT = path.join(__dirname, '..', 'app', 'src', 'main', 'res', 'raw'), TMP = path.join(require('os').tmpdir(), 'sl-snd');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
function bell(f, t, d, g) { return [[f, t, d, 'sine', g], [f * 2.76, t, d * 0.55, 'sine', g * 0.22], [f * 5.4, t, d * 0.3, 'sine', g * 0.08]]; }
function chip(f, t, d, g) { return [f, t, d, 'square', g, 4200]; }
const PACKS = {
  glass: { reverb: 0.3, events: {
    notify: [...bell(1047, 0, 0.55, 0.06), ...bell(1319, 0.13, 0.7, 0.06)],
    success: [...bell(784, 0, 0.35, 0.05), ...bell(1175, 0.09, 0.55, 0.055)] } },
  classic: { reverb: 0, events: {
    notify: [[440, 0, 0.45, 'sine', 0.07, 1600, 0.02], [659.25, 0.12, 0.45, 'sine', 0.07, 1600, 0.02]],
    success: [[523.25, 0, 0.4, 'sine', 0.07, 1600, 0.02], [659.25, 0.1, 0.45, 'sine', 0.07, 1600, 0.02]] } },
  arcade: { reverb: 0, events: {
    notify: [chip(784, 0, 0.07, 0.03), chip(988, 0.08, 0.07, 0.03), chip(1319, 0.16, 0.14, 0.03)],
    success: [chip(988, 0, 0.06, 0.03), chip(1319, 0.06, 0.2, 0.03)] } }
};
const derive = (base, k) => { const o = { reverb: base.reverb, events: {} }; for (const ev in base.events) o.events[ev] = base.events[ev].map((v) => v.map((x, i) => i === 0 ? (Array.isArray(x) ? x.map((f) => f * k) : x * k) : x)); return o; };
PACKS.crystal = derive(PACKS.glass, 1.5); PACKS.deep = derive(PACKS.classic, 0.7);

function voice(buf, v) {
  const f = v[0], f0 = Array.isArray(f) ? f[0] : f, f1 = Array.isArray(f) ? f[1] : f, start = v[1], dur = v[2], type = v[3], peak = Math.max(0.0002, v[4]), cut = v[5], attack = v[6] || Math.min(0.008, dur * 0.2);
  const n0 = Math.floor(start * SR), n1 = Math.min(buf.length, Math.floor((start + dur + 0.05) * SR)); let ph = 0;
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  if (cut) { const w = 2 * Math.PI * cut / SR, Q = 1.122, al = Math.sin(w) / (2 * Q), c = Math.cos(w), a0 = 1 + al; b0 = (1 - c) / 2 / a0; b1 = (1 - c) / a0; b2 = b0; a1 = -2 * c / a0; a2 = (1 - al) / a0; }
  for (let n = n0; n < n1; n++) {
    const t = n / SR - start; if (t < 0) continue;
    let env; if (t < attack) env = 0.0001 + (peak - 0.0001) * (t / attack); else if (t < dur) env = peak * Math.pow(0.0001 / peak, (t - attack) / Math.max(1e-6, dur - attack)); else env = 0;
    const fr = f1 === f0 ? f0 : f0 * Math.pow(f1 / f0, Math.min(1, t / dur)); ph += 2 * Math.PI * fr / SR;
    const p = ph % (2 * Math.PI); let s = type === 'sine' ? Math.sin(p) : type === 'square' ? (p < Math.PI ? 1 : -1) : type === 'triangle' ? 2 / Math.PI * Math.asin(Math.sin(p)) : (p / Math.PI - 1);
    if (cut) { const y = b0 * s + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = s; y2 = y1; y1 = y; s = y; }
    buf[n] += s * env;
  }
}
function render(voices, seconds, reverb) {
  const N = Math.floor(seconds * SR), dry = new Float32Array(N); voices.forEach((v) => voice(dry, v));
  if (reverb > 0) {   // the same decaying-noise room the PC app uses (fixed seed so the files are always identical)
    let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const L = Math.floor(SR * 0.6), ir = new Float32Array(L); for (let i = 0; i < L; i++) ir[i] = (rnd() * 2 - 1) * Math.pow(1 - i / L, 3);
    const wet = new Float32Array(N);
    for (let i = 0; i < N; i++) { const s = dry[i]; if (Math.abs(s) < 1e-5) continue; const m = Math.min(L, N - i); for (let j = 0; j < m; j++) wet[i + j] += s * ir[j]; }
    for (let i = 0; i < N; i++) dry[i] += wet[i] * reverb * 0.5;
  }
  return dry;
}
function finish(buf, target) {
  let mx = 0; for (const s of buf) mx = Math.max(mx, Math.abs(s)); const k = mx > 0 ? target / mx : 1, fade = Math.floor(SR * 0.04);
  const pcm = Buffer.alloc(buf.length * 2); for (let i = 0; i < buf.length; i++) { let s = buf[i] * k; if (i > buf.length - fade) s *= (buf.length - i) / fade; pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(s * 32767))), i * 2); }
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
for (const [name, p] of Object.entries(PACKS)) {
  const files = {
    msg: [render(p.events.notify, 1.9, p.reverb), 0.8],
    act: [render(p.events.success, 1.7, p.reverb), 0.7],
    ring: [(() => { const v = [...p.events.notify, ...p.events.notify.map((x) => [x[0], x[1] + 1.0, ...x.slice(2)])]; return render(v, 3.4, p.reverb); })(), 0.92]
  };
  for (const [kind, [buf, tgt]] of Object.entries(files)) {
    const wav = path.join(TMP, `snd_${name}_${kind}.wav`), ogg = path.join(OUT, `snd_${name}_${kind}.ogg`);
    fs.writeFileSync(wav, finish(buf, tgt));
    cp.execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', ogg]);
    console.log('wrote', path.basename(ogg), fs.statSync(ogg).size + ' bytes');
  }
}
