// Renders the SteamLite sound packs (same recipes as the PC app) to audio files for Android notifications and ringtones.
// Usage: node tools/gen_sounds.js   (needs ffmpeg on the PATH or FFMPEG=path)  ->  app/src/main/res/raw/snd_<pack>_<msg|act|ring>.ogg
const fs = require('fs'), path = require('path'), cp = require('child_process');
const SR = 44100, OUT = path.join(__dirname, '..', 'app', 'src', 'main', 'res', 'raw'), TMP = path.join(require('os').tmpdir(), 'sl-snd');
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
function fft(re, im, inv) {
  const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = 2 * Math.PI / len * (inv ? -1 : 1), wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
function convolve(x, h) {
  let n = 1; while (n < x.length + h.length) n <<= 1; const ar = new Float64Array(n), ai = new Float64Array(n), br = new Float64Array(n), bi = new Float64Array(n);
  ar.set(x); br.set(h); fft(ar, ai, false); fft(br, bi, false);
  for (let i = 0; i < n; i++) { const r = ar[i] * br[i] - ai[i] * bi[i], m = ar[i] * bi[i] + ai[i] * br[i]; ar[i] = r; ai[i] = m; }
  fft(ar, ai, true); return Float32Array.from(ar.subarray(0, x.length + h.length - 1));
}
function render(voices, seconds, reverb) {
  const N = Math.floor(seconds * SR), dry = new Float32Array(N); voices.forEach((v) => voice(dry, v));
  if (reverb > 0) {   // the same decaying-noise room the PC app uses (fixed seed so the files are always identical)
    let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const L = Math.floor(SR * 0.6), ir = new Float32Array(L); for (let i = 0; i < L; i++) ir[i] = (rnd() * 2 - 1) * Math.pow(1 - i / L, 3);
    const wet = convolve(dry, ir).subarray(0, N);
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
// ---- ringtones: each pack has its own tune (about 14 to 16 seconds, made to loop), played with that pack's instrument ----
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const tune = (notes, beat, make) => notes.flatMap(([m, b, l]) => make(m, b * beat, l * beat));
const RINGS = {
  glass: { len: 15, voices: () => tune([[76, 0, 1.5], [79, 1, 1.5], [84, 2, 1.5], [88, 3, 3], [86, 5, 1.5], [84, 6, 1.5], [79, 7, 3], [81, 10, 1.5], [84, 11, 1.5], [88, 12, 1.5], [91, 13, 3], [88, 15.5, 1], [86, 16.5, 1], [84, 17.5, 1], [79, 18.5, 3.5], [64, 0, 3], [60, 5, 3], [65, 10, 3], [60, 15.5, 3]], 0.652, (m, t, d) => bell(hz(m), t, d + 0.6, m < 70 ? 0.04 : 0.06)) },
  classic: { len: 16, voices: () => tune([[72, 0], [76, 1], [79, 2], [76, 3], [72, 4], [76, 5], [79, 6], [84, 7], [74, 8], [77, 9], [81, 10], [77, 11], [74, 12], [77, 13], [81, 14], [79, 15], [76, 16], [79, 17], [84, 18], [79, 19], [76, 20], [79, 21], [84, 22], [88, 23], [83, 24], [81, 25], [79, 26], [77, 27], [76, 28, 3]].map(([m, b, l]) => [m, b, l || 0.85]), 0.476, (m, t, d) => [[hz(m), t, Math.max(0.2, d * 0.95), 'sine', 0.07, 1600, 0.02]]) },
  arcade: { len: 13.6, voices: () => { const E = 0.1875, bars = [[72, 76, 79, 84, 79, 76, 72, 76], [69, 72, 76, 81, 76, 72, 69, 72], [65, 69, 72, 77, 72, 69, 65, 69], [67, 71, 74, 79, 74, 71, 67, 71], [76, 79, 84, 88, 84, 79, 76, 79], [81, 84, 88, 93, 88, 84, 81, 84], [77, 81, 84, 89, 84, 81, 77, 81], [79, 83, 86, 91, 86, 83, 79, 83]], bass = [48, 45, 41, 43, 48, 45, 41, 43], v = []; bars.forEach((bar, bi) => { bar.forEach((m, i) => v.push(chip(hz(m), (bi * 8 + i) * E, 0.17, 0.03))); v.push([hz(bass[bi]), bi * 8 * E, 8 * E * 0.9, 'triangle', 0.05, 1200]); }); [72, 76, 79, 84].forEach((m, i) => v.push(chip(hz(m), (64 + i) * E, 0.3, 0.03))); return v; } },
  crystal: { len: 16, voices: () => tune([[72, 0, 2], [76, 1.5, 2], [79, 3, 2], [84, 4.5, 4], [83, 7.5, 2], [79, 9, 2], [76, 10.5, 2], [72, 12, 4], [74, 15, 2], [76, 16.5, 2], [79, 18, 2], [84, 19.5, 4], [67, 0, 4], [64, 7.5, 4], [65, 15, 4]], 0.625, (m, t, d) => bell(hz(m) * 1.5, t, d + 0.8, m < 70 ? 0.035 : 0.05)) },
  deep: { len: 15, voices: () => tune([[60, 0, 1.4], [63, 1, 1.4], [67, 2, 1.4], [63, 3, 1.4], [58, 4, 1.4], [62, 5, 1.4], [65, 6, 1.4], [62, 7, 1.4], [56, 8, 1.4], [60, 9, 1.4], [63, 10, 1.4], [60, 11, 1.4], [55, 12, 1.4], [59, 13, 1.4], [62, 14, 1.4], [67, 15, 1.4], [63, 16, 1.4], [62, 17, 1.4], [60, 18, 2.2], [48, 0, 4], [46, 4, 4], [44, 8, 4], [43, 12, 4], [48, 16, 4]], 0.7, (m, t, d) => [[hz(m) * 0.7, t, d, 'sine', m < 52 ? 0.05 : 0.07, 1600, 0.02]]) }
};
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
for (const [name, p] of Object.entries(PACKS)) {
  const files = {
    msg: [render(p.events.notify, 1.9, p.reverb), 0.8],
    act: [render(p.events.success, 1.7, p.reverb), 0.7],
    ring: [render(RINGS[name].voices(), RINGS[name].len, p.reverb), 0.92]
  };
  for (const [kind, [buf, tgt]] of Object.entries(files)) {
    const wav = path.join(TMP, `snd_${name}_${kind}.wav`), ogg = path.join(OUT, `snd_${name}_${kind}.ogg`);
    fs.writeFileSync(wav, finish(buf, tgt));
    cp.execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', ogg]);
    console.log('wrote', path.basename(ogg), fs.statSync(ogg).size + ' bytes');
  }
}
