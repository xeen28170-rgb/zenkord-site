// Synthétise toute la bande son (bruitages + fond rythmique) à partir de la timeline.
// Aucun sample externe : tout est généré ici, en Node pur, sans dépendance.
// Usage : node scripts/audio.mjs [sortie.wav]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TL = createRequire(import.meta.url)('../src/timeline.js');
const out = resolve(process.argv[2] || resolve(here, '../build/audio.wav'));

const SR = 48000;
const N = Math.ceil(SR * TL.DURATION);
const TAU = Math.PI * 2;

// Deux bus stéréo : bruitages et musique (la musique est "pompée" par le kick)
const sfx = [new Float32Array(N), new Float32Array(N)];
const mus = [new Float32Array(N), new Float32Array(N)];

let seed = 1234;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const noise = () => rand() * 2 - 1;

function put(bus, t0, buf, gain = 1, pan = 0) {
  const i0 = Math.round(t0 * SR);
  for (let i = 0; i < buf.length; i++) {
    const j = i0 + i;
    if (j < 0 || j >= N) continue;
    const p = typeof pan === 'function' ? pan(i / buf.length) : pan;
    const a = ((p + 1) * Math.PI) / 4;
    bus[0][j] += buf[i] * gain * Math.cos(a);
    bus[1][j] += buf[i] * gain * Math.sin(a);
  }
}

class Biquad {
  constructor(type, f, q = 0.707) { this.type = type; this.q = q; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f); }
  set(f) {
    const w = (TAU * Math.min(Math.max(f, 20), SR * 0.45)) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * this.q);
    let b0, b1, b2;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const gen = (dur, fn) => { const n = Math.round(dur * SR), b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = fn(i / SR, i / n); return b; };
const sweepOsc = (fOf, shape = Math.sin) => { let ph = 0; return (t) => { ph += (TAU * fOf(t)) / SR; return shape(ph); }; };
const saw = (ph) => 2 * ((ph / TAU) % 1) - 1;

// ---------------- bruitages ----------------
const S = {
  kick() {
    const o = sweepOsc((t) => 44 + 120 * Math.exp(-t * 30));
    return gen(0.42, (t) => Math.tanh(1.6 * (o(t) * Math.exp(-t * 7.5) + noise() * 0.25 * Math.exp(-t * 300))));
  },
  clap() {
    const bp = new Biquad('bp', 1600, 0.9);
    return gen(0.26, (t) => {
      const e = [0, 0.011, 0.022].reduce((s, d) => s + (t >= d ? Math.exp(-(t - d) * 160) : 0), 0) * 0.7 + Math.exp(-t * 16) * 0.5;
      return bp.run(noise()) * e * 2.2;
    });
  },
  hat(open = false) {
    const hp = new Biquad('hp', 7500, 0.8);
    return gen(open ? 0.2 : 0.06, (t) => hp.run(noise()) * Math.exp(-t * (open ? 18 : 70)));
  },
  bass(f, dur) {
    const lp = new Biquad('lp', 420, 1.1);
    const o1 = sweepOsc(() => f, saw), o2 = sweepOsc(() => f * 1.006, saw), sub = sweepOsc(() => f);
    return gen(dur, (t, x) => {
      const env = Math.min(1, t / 0.004) * Math.min(1, (1 - x) * 12) * (0.7 + 0.3 * Math.exp(-t * 8));
      return (lp.run((o1(t) + o2(t)) * 0.5) * 0.8 + sub(t) * 0.6) * env;
    });
  },
  pluck(f) {
    const lp = new Biquad('lp', 3000, 0.9);
    const o = sweepOsc(() => f, (ph) => (Math.sin(ph) > 0 ? 1 : -1) * 0.5 + Math.sin(ph * 2) * 0.3);
    return gen(0.22, (t) => { lp.set(400 + 3200 * Math.exp(-t * 22)); return lp.run(o(t)) * Math.exp(-t * 14); });
  },
  boom() {
    const o = sweepOsc((t) => 30 + 70 * Math.exp(-t * 5));
    const lp = new Biquad('lp', 260, 0.9);
    return gen(2.2, (t) => Math.tanh(2.2 * (o(t) * Math.exp(-t * 1.7) + lp.run(noise()) * 1.4 * Math.exp(-t * 5))) * 0.95);
  },
  boomLite() {
    const o = sweepOsc((t) => 38 + 80 * Math.exp(-t * 9));
    const lp = new Biquad('lp', 500, 0.9);
    return gen(1.0, (t) => Math.tanh(1.8 * (o(t) * Math.exp(-t * 3.2) + lp.run(noise()) * Math.exp(-t * 10))));
  },
  slam() {
    const o = sweepOsc((t) => 46 + 110 * Math.exp(-t * 20));
    const bp = new Biquad('bp', 900, 0.7);
    return gen(0.6, (t) => Math.tanh(1.8 * (o(t) * Math.exp(-t * 7) + bp.run(noise()) * 1.3 * Math.exp(-t * 28))));
  },
  bonk() {
    const o = sweepOsc((t) => 140 * Math.exp(-t * 5) + 60);
    return gen(0.35, (t) => o(t) * Math.exp(-t * 12) + noise() * 0.2 * Math.exp(-t * 200));
  },
  pop(pitch = 1) {
    const o = sweepOsc((t) => pitch * (380 + 620 * (1 - Math.exp(-t * 90))));
    return gen(0.12, (t) => o(t) * Math.min(1, t / 0.002) * Math.exp(-t * 38));
  },
  // Notification "maison" : deux notes cristallines montantes
  notif() {
    const note = (f) => (t) => Math.sin(TAU * f * t + 1.1 * Math.exp(-t * 18) * Math.sin(TAU * f * 2.01 * t)) * Math.min(1, t / 0.003) * Math.exp(-t * 9);
    const a = note(1174.7), b = note(1568);
    return gen(0.6, (t) => a(t) * 0.6 + (t > 0.085 ? b(t - 0.085) : 0) * 0.7);
  },
  ping() {
    const notes = [1046.5, 1318.5, 1568, 2093];
    const oscs = notes.map((f) => sweepOsc(() => f));
    return gen(0.7, (t) => notes.reduce((s, _, i) => {
      const d = t - i * 0.045;
      return s + (d >= 0 ? oscs[i](d) * Math.exp(-d * 10) * Math.min(1, d / 0.003) * 0.45 : 0);
    }, 0));
  },
  crickets(dur) {
    const b = new Float32Array(Math.round(dur * SR));
    const chirp = (t0, f, g) => {
      for (let p = 0; p < 3; p++) {
        const s0 = Math.round((t0 + p * 0.036) * SR), n = Math.round(0.022 * SR);
        for (let i = 0; i < n && s0 + i < b.length; i++) {
          const tt = i / SR, env = Math.sin((Math.PI * i) / n);
          b[s0 + i] += (Math.sin(TAU * f * tt) + 0.3 * Math.sin(TAU * f * 2 * tt)) * env * g;
        }
      }
    };
    for (let t = 0.05; t < dur - 0.15; t += 0.55 + rand() * 0.25) chirp(t, 4300, 0.5);
    for (let t = 0.3; t < dur - 0.15; t += 0.7 + rand() * 0.3) chirp(t, 4750, 0.32);
    // vent très léger
    const lp = new Biquad('lp', 380, 0.7);
    for (let i = 0; i < b.length; i++) b[i] += lp.run(noise()) * 0.35 * (0.6 + 0.4 * Math.sin((i / SR) * 1.3));
    return b;
  },
  tumble(dur) {
    const bp = new Biquad('bp', 2500, 1.2);
    return gen(dur, (t, x) => bp.run(noise()) * (0.4 + 0.6 * Math.abs(Math.sin(x * Math.PI * 3))) * Math.sin(Math.PI * x) * 0.5);
  },
  whoosh(dur = 0.4) {
    const bp = new Biquad('bp', 400, 1.4);
    return gen(dur, (t, x) => { bp.set(350 * Math.pow(14, x)); return bp.run(noise()) * Math.pow(Math.sin(Math.PI * x), 1.5) * 2; });
  },
  suck(dur = 0.5) {
    const bp = new Biquad('bp', 300, 1.3);
    return gen(dur, (t, x) => { bp.set(300 * Math.pow(20, x)); return bp.run(noise()) * Math.pow(x, 3) * (x > 0.97 ? (1 - x) / 0.03 : 1) * 2.2; });
  },
  riser(dur) {
    const bp = new Biquad('bp', 300, 1.2), lp = new Biquad('lp', 2000, 0.8);
    const o = sweepOsc((t) => 110 * Math.pow(8, t / dur), saw);
    return gen(dur, (t, x) => { bp.set(300 * Math.pow(25, x)); return (bp.run(noise()) * 1.6 + lp.run(o(t)) * 0.4) * x * x; });
  },
  glitch(dur) {
    const b = new Float32Array(Math.round(dur * SR));
    let i = 0;
    while (i < b.length) {
      const n = Math.round((0.012 + rand() * 0.035) * SR), kind = rand(), f = 80 + rand() * 1800;
      let hold = 0;
      for (let k = 0; k < n && i < b.length; k++, i++) {
        if (kind < 0.4) b[i] = Math.sin((TAU * f * k) / SR) > 0 ? 0.6 : -0.6;
        else if (kind < 0.75) { if (k % 24 === 0) hold = noise(); b[i] = hold * 0.8; }
        else b[i] = 0;
      }
    }
    return b;
  },
  tick(pitch = 1) { return gen(0.03, (t) => Math.sin(TAU * 1700 * pitch * t) * Math.exp(-t * 260)); },
  key() {
    const hp = new Biquad('hp', 1800 + rand() * 1500, 0.9);
    return gen(0.04, (t) => hp.run(noise()) * (Math.exp(-t * 300) + 0.5 * (t > 0.012 ? Math.exp(-(t - 0.012) * 400) : 0)));
  },
  click() {
    const bp = new Biquad('bp', 3500, 1.5);
    return gen(0.09, (t) => bp.run(noise()) * (Math.exp(-t * 500) + (t > 0.06 ? Math.exp(-(t - 0.06) * 500) * 0.7 : 0)) * 2.5);
  },
  sparkle(i = 0) {
    const f = 2200 + ((i * 7) % 11) * 180;
    return gen(0.25, (t) => (Math.sin(TAU * f * t) + 0.4 * Math.sin(TAU * f * 2.7 * t)) * Math.exp(-t * 20));
  },
};

// Volume de base de chaque bruitage
const LEVEL = { crickets: 0.6, tumble: 0.25, pop: 0.55, bonk: 0.8, glitch: 0.35, suck: 0.5, boom: 1.0, boomLite: 0.85,
  whoosh: 0.45, notif: 0.45, ping: 0.6, slam: 0.75, tick: 0.25, sparkle: 0.12, key: 0.3, riser: 0.32, click: 0.6 };

for (const e of TL.SFX) {
  const g = (LEVEL[e.type] ?? 0.5) * (e.gain ?? 1);
  let buf;
  switch (e.type) {
    case 'crickets': case 'tumble': case 'whoosh': case 'suck': case 'riser': case 'glitch': buf = S[e.type](e.dur); break;
    case 'pop': case 'tick': buf = S[e.type](e.pitch ?? 1); break;
    case 'sparkle': buf = S.sparkle(e.pitch ?? 0); break;
    default: buf = S[e.type]();
  }
  let pan = e.pan ?? 0;
  if (e.type === 'whoosh') pan = (x) => -0.7 + 1.4 * x;
  if (e.type === 'tumble') pan = (x) => -0.8 + 1.6 * x;
  if (e.type === 'sparkle') pan = ((e.pitch * 5) % 7) / 3.5 - 1;
  put(sfx, e.t, buf, g, pan);
}

// ---------------- fond rythmique (120 BPM, la mineur) ----------------
const B = TL.BEAT;
const kicks = [];
const ROOTS = [55, 43.65, 65.41, 49]; // La, Fa, Do, Sol
const PENTA = [440, 523.25, 587.33, 659.25, 783.99, 880];
function groove(from, to, opt = {}) {
  for (let t = from, k = 0; t < to - 1e-6; t += B / 2, k++) {
    const onBeat = k % 2 === 0, beatIdx = Math.floor(k / 2);
    if (onBeat) { put(mus, t, S.kick(), 0.9); kicks.push(t); }
    if (onBeat && beatIdx % 2 === 1) put(mus, t, S.clap(), 0.45);
    put(mus, t, S.hat(!onBeat && opt.openHats), onBeat ? 0.12 : 0.2, 0.25);
    const bar = Math.floor((t - 3) / (4 * B));
    const root = ROOTS[((bar % 4) + 4) % 4];
    put(mus, t, S.bass(onBeat ? root : root * 2, B / 2 * 0.95), opt.bassGain ?? 0.32);
    if (opt.pluck) {
      for (let s = 0; s < 2; s++) {
        const n = PENTA[Math.floor(hashN(k * 2 + s) * PENTA.length)];
        put(mus, t + s * B / 4, S.pluck(n), 0.07, s ? 0.35 : -0.35);
      }
    }
  }
}
function hashN(n) { const x = Math.sin(n * 91.7 + 13.1) * 43758.5453; return x - Math.floor(x); }

groove(3.0, 8.0);
groove(8.0, 14.0, { pluck: true, openHats: true });
groove(14.0, 17.5, { openHats: true, bassGain: 0.36 });
// roulement de caisse claire qui accélère avant le drop
for (let t = 16.0; t < 17.5 - 1e-6; t += t < 17.0 ? B / 4 : B / 8) put(mus, t, S.clap(), 0.18 + 0.35 * ((t - 16) / 1.5));
// fin : reprise plus légère après le gros boom
groove(18.5, 20.0, { bassGain: 0.26 });

// sidechain : la musique s'écrase à chaque kick
for (let i = 0; i < N; i++) {
  const t = i / SR;
  let duck = 1;
  for (let k = kicks.length - 1; k >= 0; k--) {
    if (kicks[k] <= t) { const d = t - kicks[k]; duck = 1 - 0.55 * Math.exp(-d * 14); break; }
  }
  mus[0][i] *= duck; mus[1][i] *= duck;
}

// ---------------- mix final ----------------
const L = new Float32Array(N), R = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh((sfx[0][i] + mus[0][i] * 0.8) * 1.15);
  R[i] = Math.tanh((sfx[1][i] + mus[1][i] * 0.8) * 1.15);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak; // crête à -1 dBFS
const fadeOut = Math.round(0.25 * SR);
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8);
pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const f = Math.min(1, i / 240, (N - i) / fadeOut);
  pcm.writeInt16LE(Math.round(clamp16(L[i] * norm * f)), 44 + i * 4);
  pcm.writeInt16LE(Math.round(clamp16(R[i] * norm * f)), 46 + i * 4);
}
function clamp16(x) { return Math.max(-32767, Math.min(32767, x * 32767)); }
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, pcm);
console.log(`audio: ${out} (${TL.DURATION}s, ${SR} Hz, ${TL.SFX.length} bruitages)`);
