# Pub TikTok /vnr

Vidéo verticale 1080x1920, 30 fps, 20 s, H.264 + AAC, entièrement générée par du code :
animation HTML/CSS/JS rendue image par image dans Chromium (Playwright), bande son synthétisée
en Node (aucun sample, aucun son de mème existant), le tout assemblé avec ffmpeg.

Résultats dans `out/` :
- `vnr-pub-tiktok.mp4` : la version à poster sur TikTok (qualité max)
- `vnr-pub-discord-leger.mp4` : la même en moins de 10 Mo, pour l'envoyer sur Discord sans Nitro
- `keyframes/` et `planche-contact.png` : images clés pour le contrôle

## Refaire le rendu (Windows)

Prérequis : [Node.js 20+](https://nodejs.org).

```powershell
cd pub-vnr
npm install
npx playwright install chromium
npm run stills    # images clés seulement (quelques secondes) -> out/keyframes
npm run render    # vidéo complète + vérifications (environ 10 min)
```

ffmpeg est fourni par le paquet npm `ffmpeg-static`. Pour utiliser le tien, définis la variable
`FFMPEG` (ex. `$env:FFMPEG="C:\ffmpeg\bin\ffmpeg.exe"`).

Aperçu en direct : ouvre `src/index.html` dans Chrome (la vidéo tourne en boucle, sans le son).
`src/index.html?t=12.5` affiche l'image figée à 12,5 s.

## Modifier

| Quoi | Où |
|---|---|
| Nom, lien, chiffres du serveur | `src/timeline.js` → `SERVER` (et les textes en dur dans `src/index.html`) |
| Messages du faux chat, pseudos | `src/timeline.js` → `MSG_TEXT`, `USERS` |
| Fausses notifs | `src/timeline.js` → `NOTIFS` |
| Moments des bruitages, tremblements, glitchs, flashs | `src/timeline.js` → `SFX`, `HITS`, `GLITCHES`, `FLASHES` |
| Mise en page, couleurs (accent `--acc`) | `src/index.html` |
| Mouvements de chaque scène | `src/anim.js` (une fonction par scène : `s1` … `s5`) |
| Sons, musique (120 BPM, la mineur) | `scripts/audio.mjs` |

Les textes importants restent dans la zone sûre TikTok (`.safe` : x 64→900, y 250→1440),
hors du haut (onglets), du bas (légende, musique) et de la colonne de boutons à droite.

Polices : Lilita One et Nunito (licence SIL OFL, voir `assets/fonts`).
