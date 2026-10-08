// Rendu complet : son -> images (Chromium via Playwright) -> MP4 H.264 + AAC -> vérifications.
// Usage : node scripts/render.mjs            (vidéo complète)
//         node scripts/render.mjs --stills   (seulement les images clés, pour contrôler vite)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TL = require('../src/timeline.js');
const BUILD = join(root, 'build'), OUT = join(root, 'out');
const VIDEO = join(OUT, 'vnr-pub-tiktok.mp4');
const AUDIO = join(BUILD, 'audio.wav');
const STILLS = join(OUT, 'keyframes');
const KEY_TIMES = [0.9, 2.2, 3.1, 5.15, 7.3, 8.8, 10.2, 11.9, 13.6, 14.6, 15.6, 17.7, 18.6, 19.6];
const stillsOnly = process.argv.includes('--stills');

// ffmpeg : celui du système, sinon le paquet npm ffmpeg-static s'il est installé
function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { const p = require('ffmpeg-static'); if (p && existsSync(p)) return p; } catch {}
  return 'ffmpeg';
}
const FFMPEG = findFfmpeg();

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error) throw new Error(`${cmd} introuvable (${r.error.message}). Installe ffmpeg ou "npm i ffmpeg-static".`);
  return r;
}

async function launch() {
  const { chromium } = require('playwright');
  const opts = {};
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(opts);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(root, 'src', 'index.html')).href + '?render=1');
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('100px "Lilita One"'), document.fonts.load('900 40px Nunito'),
      document.fonts.load('700 40px Nunito'), document.fonts.load('800 40px Nunito'),
    ]);
    await document.fonts.ready;
  });
  const ok = await page.evaluate(() => document.fonts.check('100px "Lilita One"') && document.fonts.check('900 40px Nunito'));
  if (!ok) throw new Error('Polices non chargées (assets/fonts).');
  return { browser, page };
}

const shot = async (page, t) => {
  await page.evaluate((tt) => window.renderFrame(tt), t);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 } });
};

async function renderStills(page) {
  mkdirSync(STILLS, { recursive: true });
  const { writeFileSync } = await import('node:fs');
  for (const [i, t] of KEY_TIMES.entries()) writeFileSync(join(STILLS, `key-${String(i + 1).padStart(2, '0')}.png`), await shot(page, t));
  // planche contact pour un coup d'œil (ordre = KEY_TIMES)
  run(FFMPEG, ['-y', '-v', 'error', '-i', join(STILLS, 'key-%02d.png'),
    '-vf', 'scale=270:480,tile=7x2:padding=6:color=0x333333', '-frames:v', '1', join(OUT, 'planche-contact.png')]);
  console.log(`images clés -> ${STILLS}`);
}

async function main() {
  mkdirSync(BUILD, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const { browser, page } = await launch();
  try {
    await renderStills(page);
    if (stillsOnly) return;

    // 1. son
    const a = spawnSync(process.execPath, [join(root, 'scripts', 'audio.mjs'), AUDIO], { stdio: 'inherit' });
    if (a.status !== 0) throw new Error('génération audio échouée');

    // 2. images envoyées directement à ffmpeg
    const total = Math.round(TL.FPS * TL.DURATION);
    const ff = spawn(FFMPEG, [
      '-y', '-v', 'error',
      '-f', 'image2pipe', '-framerate', String(TL.FPS), '-c:v', 'png', '-i', '-',
      '-i', AUDIO,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
      '-r', String(TL.FPS), '-g', String(TL.FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-t', String(TL.DURATION), '-movflags', '+faststart', VIDEO,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => { ff.on('error', rej); ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg code ' + c)))); });
    const t0 = Date.now();
    for (let f = 0; f < total; f++) {
      const png = await shot(page, f / TL.FPS);
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

// 3. contrôles : durée, piste audio, résolution, fps
function verify() {
  const r = run(FFMPEG, ['-hide_banner', '-i', VIDEO]);
  const info = r.stderr;
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(info);
  const secs = dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : NaN;
  const v = /Video: h264[^\n]*?(\d{3,4})x(\d{3,4})[^\n]*?([\d.]+) fps/.exec(info);
  const hasAac = /Audio: aac/.test(info);
  const checks = [
    ['durée ~20 s', Math.abs(secs - TL.DURATION) < 0.1, `${secs.toFixed(2)} s`],
    ['vidéo H.264 1080x1920', !!v && v[1] === '1080' && v[2] === '1920', v ? `${v[1]}x${v[2]}` : 'absente'],
    ['30 fps', !!v && Math.abs(+v[3] - TL.FPS) < 0.01, v ? `${v[3]} fps` : '?'],
    ['piste audio AAC', hasAac, hasAac ? 'ok' : 'absente'],
  ];
  const vol = run(FFMPEG, ['-hide_banner', '-i', VIDEO, '-af', 'volumedetect', '-vn', '-f', 'null', '-']).stderr;
  const mean = /mean_volume: ([-\d.]+) dB/.exec(vol), max = /max_volume: ([-\d.]+) dB/.exec(vol);
  checks.push(['audio non muet', !!mean && +mean[1] > -40, mean ? `moyenne ${mean[1]} dB, crête ${max[1]} dB` : '?']);
  for (const [name, ok, val] of checks) console.log(`${ok ? '✔' : '✘'} ${name} : ${val}`);
  console.log(`\n${VIDEO} (${(statSync(VIDEO).size / 1e6).toFixed(1)} Mo)`);
  if (checks.some((c) => !c[1])) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
