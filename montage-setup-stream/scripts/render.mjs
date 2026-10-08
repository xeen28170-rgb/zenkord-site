// Montage complet : coupes + recadrage vertical + zooms (ffmpeg), calque titre/sous-titres/gags
// (Chromium via Playwright), bruitages + voix -> out/montage-setup-stream.mp4, puis vérifications.
// Usage : node scripts/render.mjs [--stills]
// Vrais mèmes : dépose assets/memes/<id>.png|jpg|webp et/ou <id>.mp3|wav|ogg (ids dans src/edit.js, GAGS)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join, extname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const E = require('../src/edit.js');
const SRC = join(root, 'input', 'video.mp4');
const BUILD = join(root, 'build'), OUT = join(root, 'out');
const VIDEO = join(OUT, 'montage-setup-stream.mp4');
const SFX = join(BUILD, 'sfx.wav');
const stillsOnly = process.argv.includes('--stills');

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { const p = require('ffmpeg-static'); if (p && existsSync(p)) return p; } catch {}
  return 'ffmpeg';
}
const FFMPEG = findFfmpeg();
const run = (args) => spawnSync(FFMPEG, args, { encoding: 'utf8', maxBuffer: 64 << 20 });

// ---------- vrais mèmes fournis ----------
const MEME_DIR = join(root, 'assets', 'memes');
const ids = new Set(E.GAGS.map((g) => g.id));
const memeImg = {}, memeSnd = {};
if (existsSync(MEME_DIR)) for (const f of readdirSync(MEME_DIR)) {
  const id = basename(f, extname(f)), ext = extname(f).toLowerCase();
  if (!ids.has(id)) continue;
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) memeImg[id] = pathToFileURL(join(MEME_DIR, f)).href;
  if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) memeSnd[id] = join(MEME_DIR, f);
}
if (Object.keys(memeImg).length || Object.keys(memeSnd).length) console.log('mèmes fournis :', { images: Object.keys(memeImg), sons: Object.keys(memeSnd) });

// ---------- filtres ffmpeg ----------
const f3 = (x) => x.toFixed(3);
function zoomExpr() {
  const base = E.SEGMENTS.map((s, i) => `gte(it,${f3(E.SEG_STARTS[i])})*lt(it,${f3(E.SEG_STARTS[i] + s.b - s.a)})*${s.z}`).join('+');
  const punch = E.PUNCHES.map(([t, a]) => `gte(it,${f3(E.mapT(t))})*${a}*exp(-(it-${f3(E.mapT(t))})*9)`).join('+');
  return `max(1,${base}+${punch})`;
}
function graph(memeInputs) {
  const n = E.SEGMENTS.length, c = E.CROP;
  const parts = [`[0:v]split=${n}${E.SEGMENTS.map((_, i) => `[sv${i}]`).join('')}`, `[0:a]asplit=${n}${E.SEGMENTS.map((_, i) => `[sa${i}]`).join('')}`];
  E.SEGMENTS.forEach((s, i) => {
    parts.push(`[sv${i}]trim=start=${s.a}:end=${s.b},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[sa${i}]atrim=start=${s.a}:end=${s.b},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${f3(s.b - s.a - 0.012)}:d=0.012[a${i}]`);
  });
  parts.push(`${E.SEGMENTS.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${n}:v=1:a=1[cv][ca]`);
  parts.push('[cv]fps=30,split[c1][c2]');
  parts.push('[c1]scale=-2:1920,crop=1080:1920,gblur=sigma=36,eq=brightness=-0.28:saturation=0.75[bg]');
  parts.push(`[c2]crop=${c.size}:${c.size}:${c.x}:${c.y},scale=2160:2160:flags=lanczos,zoompan=z='${zoomExpr()}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1080:fps=30[fg]`);
  parts.push(`[bg][fg]overlay=0:${E.FG_Y}[base]`);
  parts.push('[1:v]format=rgba[ov]');
  parts.push('[base][ov]overlay=0:0:format=auto,format=yuv420p[outv]');
  // voix : nettoyage + compression + niveau TikTok
  parts.push('[ca]highpass=f=90,afftdn=nf=-30,acompressor=threshold=-22dB:ratio=3:attack=5:release=120:makeup=4,loudnorm=I=-14:TP=-2:LRA=8,aresample=48000[voice]');
  const mix = ['[voice]', '[2:a]'];
  memeInputs.forEach((m, k) => {
    const ms = Math.round(E.mapT(m.t) * 1000);
    parts.push(`[${3 + k}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.8,adelay=${ms}|${ms}[m${k}]`);
    mix.push(`[m${k}]`);
  });
  parts.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=first,alimiter=limit=0.93[outa]`);
  return parts.join(';\n');
}

// ---------- calque ----------
async function launch() {
  const { chromium } = require('playwright');
  const opts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await chromium.launch(opts);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.addInitScript((m) => { window.MEMES = m; }, memeImg);
  await page.goto(pathToFileURL(join(root, 'src', 'overlay.html')).href + '?render=1');
  await page.evaluate(async () => {
    await Promise.all([document.fonts.load('100px "Lilita One"'), document.fonts.load('900 40px Nunito'), document.fonts.load('100px "Noto Color Emoji"')]);
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  return { browser, page };
}
const shot = async (page, t) => {
  await page.evaluate((tt) => window.renderFrame(tt), t);
  return page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
};

async function main() {
  if (!existsSync(SRC)) throw new Error(`vidéo source manquante : ${SRC}`);
  mkdirSync(BUILD, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const memeInputs = Object.entries(memeSnd).map(([id, file]) => ({ id, file, t: E.GAGS.find((g) => g.id === id).t }));
  const s = spawnSync(process.execPath, [join(root, 'scripts', 'sfx.mjs'), SFX, memeInputs.map((m) => m.id).join(',')], { stdio: 'inherit' });
  if (s.status !== 0) throw new Error('sfx échoué');

  const { browser, page } = await launch();
  try {
    const total = Math.round(E.DURATION * E.FPS);
    if (stillsOnly) {
      // aperçu : quelques images du montage complet
      const times = [0.3, 2.2, 6.4, 8.6, 10.0, 12.0, 15.2, 19.8, 21.4, 23.3, 24.6];
      mkdirSync(join(BUILD, 'stills'), { recursive: true });
      for (const [i, t] of times.entries()) writeFileSync(join(BUILD, 'stills', `ov-${String(i).padStart(2, '0')}.png`), await shot(page, t));
      console.log('calques ->', join(BUILD, 'stills'), times.join(' '));
      return;
    }
    const args = ['-y', '-v', 'error', '-i', SRC, '-f', 'image2pipe', '-framerate', String(E.FPS), '-c:v', 'png', '-i', '-', '-i', SFX];
    memeInputs.forEach((m) => args.push('-i', m.file));
    args.push('-filter_complex', graph(memeInputs), '-map', '[outv]', '-map', '[outa]',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-r', String(E.FPS),
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', E.DURATION.toFixed(3), '-movflags', '+faststart', VIDEO);
    const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => { ff.on('error', rej); ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg code ' + c)))); });
    ff.stdin.on('error', () => {});
    const t0 = Date.now();
    for (let f = 0; f < total; f++) {
      const png = await shot(page, f / E.FPS);
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (f % 30 === 0) process.stdout.write(`\rimages ${f}/${total}`);
    }
    ff.stdin.end();
    await done;
    console.log(`\rimages ${total}/${total} en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } finally {
    await browser.close();
  }
  verify();
}

function verify() {
  const info = run(['-hide_banner', '-i', VIDEO]).stderr;
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(info);
  const secs = d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : NaN;
  const v = /Video: h264[^\n]*?(\d{3,4})x(\d{3,4})[^\n]*?([\d.]+) fps/.exec(info);
  const vol = run(['-hide_banner', '-i', VIDEO, '-vn', '-af', 'volumedetect', '-f', 'null', '-']).stderr;
  const mean = /mean_volume: ([-\d.]+) dB/.exec(vol), max = /max_volume: ([-\d.]+) dB/.exec(vol);
  const checks = [
    [`durée ~${E.DURATION.toFixed(2)} s`, Math.abs(secs - E.DURATION) < 0.1, `${secs.toFixed(2)} s`],
    ['vidéo H.264 1080x1920', !!v && v[1] === '1080' && v[2] === '1920', v ? `${v[1]}x${v[2]}` : 'absente'],
    ['30 fps', !!v && Math.abs(+v[3] - 30) < 0.01, v ? `${v[3]} fps` : '?'],
    ['piste audio AAC', /Audio: aac/.test(info), /Audio: aac/.test(info) ? 'ok' : 'absente'],
    ['audio non muet', !!mean && +mean[1] > -35, mean ? `moyenne ${mean[1]} dB, crête ${max[1]} dB` : '?'],
  ];
  for (const [n, ok, val] of checks) console.log(`${ok ? '✔' : '✘'} ${n} : ${val}`);
  console.log(`${VIDEO} (${(statSync(VIDEO).size / 1e6).toFixed(1)} Mo)`);
  if (checks.some((c) => !c[1])) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
