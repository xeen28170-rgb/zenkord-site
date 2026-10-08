// Miniature (couverture TikTok 1080x1920) : extrait l'image de la vidéo puis rend src/miniature.html.
// Usage : node scripts/miniature.mjs [temps_en_secondes]   (par défaut 16.4 : le doigt pointé vers la caméra)
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const t = process.argv[2] || '16.4';
let FFMPEG = process.env.FFMPEG || 'ffmpeg';
try { const p = require('ffmpeg-static'); if (!process.env.FFMPEG && p && existsSync(p)) FFMPEG = p; } catch {}

mkdirSync(join(root, 'build', 'thumb'), { recursive: true });
mkdirSync(join(root, 'out'), { recursive: true });
const r = spawnSync(FFMPEG, ['-v', 'error', '-y', '-ss', t, '-i', join(root, 'input', 'video.mp4'), '-frames:v', '1',
  '-vf', 'crop=440:422:200:58,scale=1125:1080:flags=lanczos,unsharp=5:5:0.8,eq=saturation=1.15:contrast=1.06',
  join(root, 'build', 'thumb', 'photo.png')], { stdio: 'inherit' });
if (r.status !== 0) process.exit(1);

const { chromium } = require('playwright');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(pathToFileURL(join(root, 'src', 'miniature.html')).href);
await page.evaluate(async () => {
  await Promise.all([document.fonts.load('100px "Lilita One"'), document.fonts.load('900 40px Nunito'), document.fonts.load('100px "Noto Color Emoji"')]);
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((res) => { i.onload = i.onerror = res; }))));
});
const out = join(root, 'out', 'miniature.png');
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
await browser.close();
console.log('miniature ->', out);
