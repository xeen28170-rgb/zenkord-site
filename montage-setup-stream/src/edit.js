// Données du montage, partagées par la couche graphique (navigateur) et les scripts Node.
// Les temps des mots et des gags sont ceux de la vidéo SOURCE ; mapT() les convertit
// dans le temps du montage (après les coupes).
(function () {
  const FPS = 30;

  // Recadrage : carré de 480 px pris dans la source 854x480, centré sur le visage
  const CROP = { x: 190, y: 0, size: 480 };
  // Position du carré agrandi (1080x1080) dans l'image verticale 1080x1920
  const FG_Y = 420;

  // Passages gardés [début, fin] dans la source. Coupés : l'intro "Yo les gars, j'espère
  // que vous allez bien" (accroche plus directe) et toutes les pauses.
  // z = zoom de base du plan (alterné pour masquer les jump cuts)
  const SEGMENTS = [
    { a: 1.84, b: 4.86, z: 1.0 },
    { a: 5.1, b: 9.36, z: 1.14 },
    { a: 9.66, b: 14.68, z: 1.0 },
    { a: 14.94, b: 23.92, z: 1.12 },
    { a: 24.4, b: 26.12, z: 1.24 },
    { a: 26.55, b: 30.5, z: 1.0 },
  ];

  // Sous-titres : [mot, début, fin] (temps source). Corrige le texte ici si besoin.
  const WORDS = [
    ['Dites-moi', 1.9, 2.24], ['les', 2.24, 2.34], ['gars,', 2.34, 2.46], ['vous', 2.5, 2.78], ['conseillez', 2.78, 3.2],
    ['quoi', 3.2, 3.64], ['pour', 3.64, 4.28], ['un', 4.28, 4.54], ['setup', 4.54, 4.8],
    ['pour', 5.21, 5.37], ['débuter', 5.37, 5.59], ['dans', 5.59, 5.69], ['le', 5.69, 5.85], ['stream ?', 5.85, 6.35],
    ['Dites-moi', 6.53, 7.33], ['dans', 7.63, 7.73], ['les', 7.73, 7.93], ['commentaires', 7.93, 8.37],
    ['ce', 8.41, 8.49], ['que', 8.49, 8.59], ['vous', 8.59, 8.93], ['conseillez,', 8.93, 9.25],
    ['ce', 9.86, 9.96], ['que', 9.96, 10.02], ['je', 10.02, 10.14], ['devrais', 10.14, 10.62], ['prendre.', 10.62, 10.86],
    ['Mettez-moi', 10.94, 11.24], ['pas', 11.24, 11.34], ['des', 11.34, 11.46], ['trucs', 11.46, 11.62], ['de', 11.62, 11.76],
    ['salopard,', 11.76, 12.0], ["d'accord ?", 12.2, 12.48],
    ['Je', 12.48, 12.56], ['débute', 12.56, 12.66], ['dans', 12.66, 12.78], ['le', 12.78, 12.92], ['stream,', 12.92, 13.14],
    ['vu', 13.14, 13.3], ['que', 13.3, 13.44], ["j'ai", 13.44, 13.62], ['un', 13.62, 13.66], ['budget', 13.66, 13.84],
    ['limité', 13.84, 14.1], ['de', 14.1, 14.34], ['fou.', 14.34, 14.64],
    ['Donc', 15.55, 15.86], ['dites-moi', 15.86, 16.08], ['dans', 16.08, 16.16], ['les', 16.16, 16.36], ['commentaires,', 16.36, 16.92],
    ['et', 16.92, 17.18], ['on', 17.18, 17.28], ['se', 17.28, 17.64], ['retrouve', 17.64, 18.1],
    ['quand', 18.1, 18.24], ["j'aurai", 18.24, 18.52], ['fait', 18.52, 18.92], ['toute', 18.92, 19.08], ['la', 19.08, 19.24], ['liste', 19.24, 19.76],
    ['avec', 19.76, 20.18], ['tous', 20.18, 20.26], ['les', 20.26, 20.42], ['setups', 20.42, 20.76], ['complets,', 20.76, 21.56],
    ['et', 21.56, 21.66], ['je', 21.66, 21.74], ['vais', 21.74, 21.84], ['vous', 21.84, 22.02], ['les', 22.02, 22.34], ['présenter.', 22.34, 22.78],
    ['Du', 22.78, 23.0], ['coup :', 23.0, 23.34], ['périphériques,', 23.34, 23.86],
    ['micro,', 24.57, 24.85], ['casque,', 25.21, 25.57], ['écran.', 25.67, 26.1],
    ['Centrez-vous', 26.73, 27.57], ['principalement', 27.57, 28.01], ['sur', 28.01, 28.15], ['tout', 28.15, 28.25], ['le', 28.25, 28.41], ['setup,', 28.41, 28.77],
    ['après', 28.99, 29.25], ['le', 29.25, 29.45], ['reste,', 29.45, 29.6], ['on', 29.77, 29.83], ["s'en", 29.83, 29.97], ['fout', 29.97, 30.15], ['un', 30.15, 30.23], ['peu.', 30.23, 30.41],
  ];
  // Mots mis en couleur (comparés sans ponctuation, en minuscules)
  const EMPH = ['setup', 'stream', 'commentaires', 'salopard', 'budget', 'limité', 'liste', 'setups', 'micro', 'casque', 'écran', 'périphériques', 'fout'];

  // Gags façon mème (temps source). id = nom de fichier pour remplacer par un vrai mème :
  // assets/memes/<id>.png|jpg|webp (image) et/ou <id>.mp3|wav|ogg (son).
  const GAGS = [
    { id: 'reflexion', t: 2.78, dur: 1.1, sfx: 'question' },
    { id: 'comms', t: 7.63, dur: 1.5, sfx: 'notif' },
    { id: 'prix', t: 11.46, dur: 1.35, sfx: 'cash', sfx2: { t: 11.9, type: 'buzzer' } },
    { id: 'budget', t: 13.66, dur: 1.25, sfx: 'trombone' },
    { id: 'comms2', t: 16.08, dur: 1.2, sfx: 'notif' },
    { id: 'liste', t: 18.92, dur: 1.5, sfx: 'scribble' },
    { id: 'peripheriques', t: 23.34, dur: 2.7, sfx: 'pop' },
    { id: 'micro', t: 24.57, dur: 1.5, sfx: 'pop' },
    { id: 'casque', t: 25.21, dur: 0.9, sfx: 'pop' },
    { id: 'ecran', t: 25.67, dur: 0.45, sfx: 'pop' },
    { id: 'osef', t: 29.77, dur: 0.75, sfx: 'scratch' },
  ];

  // Zooms "punch" sur la vidéo (temps source, intensité)
  const PUNCHES = [[3.2, 0.1], [7.93, 0.12], [11.76, 0.16], [13.66, 0.12], [16.36, 0.08], [23.34, 0.1],
    [24.57, 0.08], [25.21, 0.08], [25.67, 0.08], [29.97, 0.18]];

  // Conversion temps source -> temps du montage (null si le moment a été coupé)
  const starts = [];
  let acc = 0;
  for (const s of SEGMENTS) { starts.push(acc); acc += s.b - s.a; }
  const DURATION = Math.round(acc * FPS) / FPS;
  function mapT(t) {
    for (let i = 0; i < SEGMENTS.length; i++) {
      const s = SEGMENTS[i];
      if (t >= s.a - 1e-6 && t <= s.b + 1e-6) return starts[i] + (t - s.a);
    }
    for (let i = 0; i < SEGMENTS.length; i++) if (t < SEGMENTS[i].a) return starts[i]; // tombé dans une coupe
    return DURATION;
  }

  const EDIT = { FPS, CROP, FG_Y, SEGMENTS, SEG_STARTS: starts, DURATION, WORDS, EMPH, GAGS, PUNCHES, mapT };
  if (typeof module !== 'undefined' && module.exports) module.exports = EDIT;
  else window.EDIT = EDIT;
})();
