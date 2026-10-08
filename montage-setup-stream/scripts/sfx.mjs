// Bruitages des gags + petit fond musical, synthétisés (aucun sample), calés sur le temps du montage.
// Usage : node scripts/sfx.mjs sortie.wav [id1,id2,...]
//   la liste optionnelle = gags dont le son est remplacé par un vrai mème (pas de son synthétisé pour eux)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const E = createRequire(import.meta.url)('../src/edit.js');
const out = resolve(process.argv[2] || 'build/sfx.wav');
const replaced = new Set((process.argv[3] || '').split(',').filter(Boolean));

const SR = 48000, TAU = Math.PI * 2;
const N = Math.ceil(SR * E.DURATION);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 99;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const noise = () => rand() * 2 - 1;

function put(t0, buf, gain = 1, pan = 0) {
  const i0 = Math.round(t0 * SR), a = ((pan + 1) * Math.PI) / 4;
  for (let i = 0; i < buf.length; i++) {
    const j = i0 + i;
    if (j < 0 || j >= N) continue;
    L[j] += buf[i] * gain * Math.cos(a);
    R[j] += buf[i] * gain * Math.sin(a);
  }
}
class Biquad {
  constructor(type, f, q = 0.707) { this.type = type; this.q = q; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f); }
  set(f) {
    const w = (TAU * Math.min(Math.max(f, 20), SR * 0.45)) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * this.q);
    let b0, b1, b2;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a;
    Object.assign(this, { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * c) / a0, a2: (1 - a) / a0 });
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}
const gen = (dur, fn) => { const n = Math.round(dur * SR), b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = fn(i / SR, i / n); return b; };
const osc = (fOf, shape = Math.sin) => { let ph = 0; return (t) => { ph += (TAU * fOf(t)) / SR; return shape(ph); }; };
const saw = (ph) => 2 * ((ph / TAU) % 1) - 1;
const sq = (ph) => (Math.sin(ph) >= 0 ? 1 : -1);

const S = {
  pop() { const o = osc((t) => 380 + 620 * (1 - Math.exp(-t * 90))); return gen(0.12, (t) => o(t) * Math.min(1, t / 0.002) * Math.exp(-t * 38)); },
  // "hein ?" de dessin animé : glissando montant
  question() {
    const o = osc((t) => 300 * Math.pow(2.6, Math.min(t / 0.35, 1)) * (1 + 0.03 * Math.sin(t * 40)));
    const lp = new Biquad('lp', 2400, 0.8);
    return gen(0.45, (t, x) => lp.run(o(t) * 0.7 + 0.3 * Math.sin(2 * TAU * 300 * t)) * Math.min(1, t / 0.01) * (1 - x));
  },
  notif() {
    const note = (f) => (t) => Math.sin(TAU * f * t + 1.1 * Math.exp(-t * 18) * Math.sin(TAU * f * 2.01 * t)) * Math.min(1, t / 0.003) * Math.exp(-t * 9);
    const a = note(1174.7), b = note(1568);
    return gen(0.6, (t) => a(t) * 0.6 + (t > 0.085 ? b(t - 0.085) : 0) * 0.7);
  },
  // tiroir-caisse : clic métallique + sonnette
  cash() {
    const hp = new Biquad('hp', 3000, 0.9);
    const bell = (f) => (t) => (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 2.76 * t)) * Math.exp(-t * 6);
    const b1 = bell(2093), b2 = bell(2637);
    return gen(0.9, (t) => hp.run(noise()) * Math.exp(-t * 60) * 0.8 + (t > 0.08 ? b1(t - 0.08) * 0.35 + b2(t - 0.08) * 0.25 : 0));
  },
  // buzzer "mauvaise réponse"
  buzzer() {
    const o1 = osc(() => 110, sq), o2 = osc(() => 116, sq), lp = new Biquad('lp', 1400, 0.9);
    return gen(0.7, (t, x) => lp.run((o1(t) + o2(t)) * 0.4) * Math.min(1, t / 0.01) * (x > 0.85 ? (1 - x) / 0.15 : 1));
  },
  // trombone triste : 4 notes qui descendent, la dernière qui tremble
  trombone() {
    const notes = [[0, 0.22, 311], [0.24, 0.22, 293.7], [0.48, 0.22, 277.2], [0.72, 0.75, 261.6]];
    const lp = new Biquad('lp', 900, 1.2);
    let ph = 0;
    return gen(1.5, (t) => {
      const n = notes.find(([a, d]) => t >= a && t < a + d);
      if (!n) return lp.run(0);
      const [a, d, f] = n, u = t - a;
      const vib = u > 0.15 && n === notes[3] ? 1 + 0.025 * Math.sin(TAU * 6 * u) : 1;
      ph += (TAU * f * vib) / SR;
      const env = Math.min(1, u / 0.02) * Math.min(1, (d - u) / 0.04);
      return lp.run(saw(ph) * 0.8 + Math.sin(ph) * 0.4) * env;
    });
  },
  // stylo qui coche la liste
  scribble() {
    const bp = new Biquad('bp', 3000, 1.5);
    return gen(1.2, (t) => {
      const strokes = [0.3, 0.52, 0.74, 0.96].some((s) => t >= s && t < s + 0.12);
      bp.set(2500 + 1500 * Math.sin(t * 90));
      return bp.run(noise()) * (strokes ? 1 : 0.05) * 1.6;
    });
  },
  // scratch de vinyle
  scratch() {
    const bp = new Biquad('bp', 800, 2);
    return gen(0.42, (t, x) => {
      const sp = Math.sin(x * Math.PI * 2.5);
      bp.set(500 + 2200 * Math.abs(sp));
      return bp.run(noise()) * Math.abs(sp) * 2.2;
    });
  },
  swish() {
    const bp = new Biquad('bp', 600, 1.4);
    return gen(0.22, (t, x) => { bp.set(600 * Math.pow(8, x)); return bp.run(noise()) * Math.sin(Math.PI * x) * 1.4; });
  },
  kick() { const o = osc((t) => 48 + 90 * Math.exp(-t * 30)); return gen(0.3, (t) => o(t) * Math.exp(-t * 10)); },
  hat() { const hp = new Biquad('hp', 8000, 0.8); return gen(0.05, (t) => hp.run(noise()) * Math.exp(-t * 80)); },
  keys(freqs, dur) {
    const oscs = freqs.map((f) => osc(() => f));
    const lp = new Biquad('lp', 1800, 0.7);
    return gen(dur, (t, x) => lp.run(oscs.reduce((s, o) => s + o(t), 0) / freqs.length) * Math.min(1, t / 0.03) * Math.exp(-t * 1.6));
  },
};

const LEVEL = { pop: 0.5, question: 0.4, notif: 0.4, cash: 0.45, buzzer: 0.35, trombone: 0.42, scribble: 0.3, scratch: 0.5, swish: 0.18 };
for (const g of E.GAGS) {
  if (replaced.has(g.id)) continue;
  put(E.mapT(g.t), S[g.sfx](), LEVEL[g.sfx] ?? 0.4, g.id === 'comms' || g.id === 'comms2' ? 0.4 : 0);
  if (g.sfx2) put(E.mapT(g.sfx2.t), S[g.sfx2.type](), LEVEL[g.sfx2.type] ?? 0.4);
}
// petit "swish" sur chaque coupe
E.SEG_STARTS.slice(1).forEach((t) => put(t - 0.08, S.swish(), LEVEL.swish));

// Fond musical léger (lo-fi, 90 BPM, accords de 7e) : très bas pour laisser la voix devant
const BEAT = 60 / 90;
const CHORDS = [[220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [261.6, 329.6, 392, 493.9], [196, 246.9, 293.7, 349.2]];
for (let bar = 0, t = 0; t < E.DURATION; bar++, t += 4 * BEAT) {
  put(t, S.keys(CHORDS[bar % 4], 4 * BEAT), 0.16);
  for (let b = 0; b < 4; b++) {
    const tb = t + b * BEAT;
    if (b === 0 || b === 2) put(tb, S.kick(), 0.22);
    put(tb + BEAT / 2, S.hat(), 0.06, 0.3);
  }
}

let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = peak > 0.95 ? 0.95 / peak : 1;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
const fade = Math.round(0.4 * SR);
for (let i = 0; i < N; i++) {
  const f = Math.min(1, (N - i) / fade);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g * f)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g * f)) * 32767), 46 + i * 4);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
console.log(`sfx: ${out} (${E.DURATION.toFixed(2)} s)`);
