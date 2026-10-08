// Timeline partagée entre l'animation (navigateur) et le son (Node).
// Tous les temps sont en secondes. Tempo 120 BPM : 1 temps = 0,5 s, donc
// les grosses coupes tombent pile sur les temps de la musique.
(function () {
  const FPS = 30;
  const DURATION = 20;
  const BPM = 120;
  const BEAT = 60 / BPM;

  const SERVER = {
    name: '/vnr',
    invite: 'discord.gg/vnr',
    tagline: 'wlh jsui /vnr',
    members: 588,
    online: 95,
    boostLevel: 3,
    boosts: 29,
  };

  // Découpage (tous sur un temps fort)
  const SCENES = {
    dead: [0, 3],      // POV : serveur mort
    vnr: [3, 8],       // bascule + avalanche de messages
    stats: [8, 14],    // gags + chiffres
    hype: [14, 18],    // montée "wlh jsui /vnr"
    end: [18, 20],     // écran final
  };
  const STATS = { members: [8, 9.5], online: [9.5, 11], boost: [11, 12.5], typing: [12.5, 14] };

  const USERS = {
    lou: '#ff7a59', kenzo: '#5ad1ff', yanis_off: '#b18cff', nox: '#ffd54a', sami: '#4ade80',
    'ptitgâteau': '#ff8fd0', 'kaïs': '#ff5d5d', neo: '#7dd3fc', 'lili.exe': '#f0abfc',
    zarbi: '#fbbf24', mehdi: '#a3e635',
  };

  // Avalanche : les messages arrivent de plus en plus vite.
  const MSG_TEXT = [
    ['lou', "WSH Y'A DU MONDE ??"],
    ['kenzo', 'qui vient en voc'],
    ['yanis_off', 'moi'],
    ['nox', 'moi aussi'],
    ['sami', 'jsuis là depuis 3h en vrai'],
    ['kaïs', '@everyone RÉVEILLEZ-VOUS', true],
    ['neo', 'il est 4h pourquoi vous êtes tous co'],
    ['lili.exe', 'on dort pas ici'],
    ['zarbi', "jsuis pas fou c'est lui qui a commencé"],
    ['ptitgâteau', "non c'est toi"],
    ['kenzo', 'VOC. MAINTENANT.'],
    ['lou', 'mdrrrrrrrrrr'],
    ['mehdi', 'frérot a mis 40 min pour écrire « ok »'],
    ['nox', 'ok'],
    ['sami', 'LA HONTE'],
    ['kaïs', 'qui a ping'],
    ['yanis_off', "c'est toi qui as ping"],
    ['neo', 'ah oui'],
    ['lili.exe', 'jvais dormir'],
    ['lili.exe', 'non en fait'],
    ['zarbi', 'QUI A CHANGÉ MON PSEUDO'],
    ['kenzo', 'personne'],
    ['mehdi', 'wlh jsui /vnr'],
    ['lou', 'wlh jsui /vnr'],
    ['sami', 'wlh jsui /vnr'],
  ];
  const MSG_TIMES = [3.8, 4.05, 4.28, 4.5, 4.7, 5.05, 5.22, 5.38, 5.53, 5.67, 5.8, 5.92, 6.04, 6.16, 6.28,
    6.4, 6.52, 6.64, 6.76, 6.88, 6.99, 7.1, 7.2, 7.3, 7.4];
  const MESSAGES = MSG_TEXT.map(([u, txt, mention], i) => ({ t: MSG_TIMES[i], u, color: USERS[u], txt, mention: !!mention }));

  // Fausses notifs qui tombent du haut
  const NOTIFS = [
    { t: 4.5, title: '/vnr • #général', body: '12 nouveaux messages' },
    { t: 5.05, title: '@everyone', body: 'kaïs vous a tous mentionnés', ping: true },
    { t: 6.0, title: '/vnr • vocal', body: '8 personnes sont en vocal' },
    { t: 6.75, title: '/vnr • #général', body: '99+ nouveaux messages' },
  ];

  // Impacts : tremblement + zoom "punch" (s = intensité)
  const HITS = [
    { t: 0.84, s: 0.35 },
    { t: 3.0, s: 1.0 },
    { t: 5.05, s: 0.65 },
    { t: 8.0, s: 0.6 }, { t: 8.25, s: 0.3 },
    { t: 9.5, s: 0.6 }, { t: 9.75, s: 0.3 },
    { t: 11.0, s: 0.7 }, { t: 11.25, s: 0.3 },
    { t: 12.5, s: 0.5 }, { t: 13.15, s: 0.85 },
    { t: 14.0, s: 0.7 }, { t: 14.5, s: 0.75 }, { t: 15.0, s: 1.0 },
    { t: 15.5, s: 0.3 }, { t: 16.0, s: 0.35 }, { t: 16.5, s: 0.42 }, { t: 17.0, s: 0.5 },
    { t: 17.25, s: 0.5 },
    { t: 18.0, s: 1.0 }, { t: 19.0, s: 0.25 },
  ];

  // Fenêtres de glitch [début, fin, intensité max]
  const GLITCHES = [
    [2.45, 3.0, 1.0], [3.0, 3.14, 0.8], [5.05, 5.15, 0.5], [7.75, 8.02, 0.9],
    [13.1, 13.26, 0.8], [17.3, 17.5, 1.0], [17.98, 18.1, 0.8],
  ];

  // Flashs plein écran [temps, opacité, couleur]
  const FLASHES = [
    [3.0, 0.95, '#ffffff'], [5.05, 0.45, '#ccff00'], [8.0, 0.4, '#ffffff'], [13.15, 0.35, '#ffffff'],
    [14.0, 0.3, '#ccff00'], [14.5, 0.3, '#ccff00'], [15.0, 0.55, '#ffffff'], [18.0, 0.9, '#ccff00'],
  ];

  // Bruitages, calés sur l'image
  const SFX = [];
  const add = (t, type, o) => SFX.push(Object.assign({ t, type }, o || {}));
  // 1. serveur mort
  add(0, 'crickets', { dur: 2.6 });
  add(0.02, 'pop', { pitch: 1.3 });
  [0.12, 0.3, 0.48, 0.66].forEach((t, i) => add(t, 'pop', { pitch: 0.9 + i * 0.12, gain: 0.7 }));
  add(0.84, 'bonk');
  add(1.0, 'tumble', { dur: 1.6 });
  add(2.45, 'glitch', { dur: 0.55 });
  add(2.55, 'suck', { dur: 0.45 });
  // 2. bascule /vnr
  add(3.0, 'boom');
  add(3.5, 'whoosh', { dur: 0.4 });
  MESSAGES.forEach((m, i) => add(m.t, 'pop', { pitch: 0.8 + ((i * 7) % 9) * 0.06, gain: 0.45, pan: ((i % 3) - 1) * 0.4 }));
  NOTIFS.forEach((n) => add(n.t, n.ping ? 'ping' : 'notif'));
  add(5.05, 'slam', { gain: 0.8 });
  add(5.05, 'glitch', { dur: 0.1, gain: 0.6 });
  add(7.6, 'whoosh', { dur: 0.45 });
  add(7.75, 'glitch', { dur: 0.25, gain: 0.7 });
  // 3. stats
  [8.0, 9.5, 11.0, 12.5].forEach((t) => add(t, 'slam'));
  [8.25, 9.75, 11.25].forEach((t) => add(t, 'pop', { pitch: 0.7, gain: 0.8 }));
  [9.38, 10.88, 12.38].forEach((t) => add(t, 'whoosh', { dur: 0.22 }));
  for (let t = 8.05; t < 8.7; t += 0.045) add(t, 'tick', { pitch: 1 + (t - 8) });
  for (let t = 9.55; t < 9.95; t += 0.045) add(t, 'tick', { pitch: 1 + (t - 9.5) });
  for (let i = 0; i < 29; i++) add(11.05 + i * 0.035, 'sparkle', { pitch: i });
  add(10.0, 'notif', { gain: 0.5 });
  for (let t = 12.55; t < 13.95; t += 0.07) add(t, 'key', { pitch: t });
  add(13.15, 'slam');
  add(13.1, 'glitch', { dur: 0.16 });
  // 4. montée
  [14.0, 14.5].forEach((t) => add(t, 'slam'));
  add(15.0, 'boomLite');
  add(15.0, 'riser', { dur: 2.5 });
  add(17.3, 'glitch', { dur: 0.2 });
  add(17.5, 'suck', { dur: 0.5 });
  // 5. fin
  add(18.0, 'boom');
  add(18.95, 'click');
  add(19.25, 'notif');

  const TL = { FPS, DURATION, BPM, BEAT, SERVER, SCENES, STATS, USERS, MESSAGES, NOTIFS, HITS, GLITCHES, FLASHES, SFX };
  if (typeof module !== 'undefined' && module.exports) module.exports = TL;
  else window.TL = TL;
})();
