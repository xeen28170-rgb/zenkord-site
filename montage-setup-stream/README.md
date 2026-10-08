# Montage « quel setup pour débuter le stream ? »

Transforme la vidéo selfie horizontale en TikTok vertical 1080x1920 :
- coupes : intro « Yo les gars… » retirée (accroche directe) et toutes les pauses, ~31 s → 27 s ;
- recadrage carré zoomé sur le visage + fond flouté, zoom alterné à chaque coupe et zooms « punch » sur les mots forts ;
- titre fixe, sous-titres mot par mot (mot prononcé en vert, mots clés en rose) ;
- gags façon mèmes calés sur la voix + bruitages et petit fond lo-fi synthétisés (aucun fichier externe) ;
- voix nettoyée, compressée et mise au niveau TikTok (−14 LUFS).

La vidéo source (`input/video.mp4`) et le résultat (`out/`) ne sont **pas** commités : le dépôt est public.

## Rendu (Windows)

```powershell
cd montage-setup-stream
npm install
npx playwright install chromium
# copier la vidéo source en input\video.mp4
npm run render        # -> out\montage-setup-stream.mp4 (+ vérifications)
```

## Modifier

| Quoi | Où |
|---|---|
| Texte des sous-titres (et leurs temps) | `src/edit.js` → `WORDS` |
| Mots en couleur | `src/edit.js` → `EMPH` |
| Coupes / zoom de chaque plan | `src/edit.js` → `SEGMENTS` |
| Gags (moments, sons) | `src/edit.js` → `GAGS` ; visuels dans `src/overlay.html` / `overlay.js` |
| Vrais mèmes | `assets/memes/` (voir LISEZMOI.txt) |
| Bruitages, musique | `scripts/sfx.mjs` |

Aperçu du calque sans la vidéo : ouvrir `src/overlay.html` dans Chrome (`?t=12` pour figer une image).
Les polices viennent de `../pub-vnr/assets/fonts`.
