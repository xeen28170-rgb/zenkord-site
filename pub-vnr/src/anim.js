// Animation pilotée par le temps : window.renderFrame(t) dessine l'image à l'instant t.
// Aucune animation CSS ni horloge : le rendu image par image est donc exact et reproductible.
(function () {
  const { FPS, MESSAGES, NOTIFS, HITS, GLITCHES, FLASHES, STATS, SCENES, SERVER, USERS } = window.TL;

  const $ = (id) => document.getElementById(id);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, x) => a + (b - a) * x;
  const oCubic = (x) => 1 - Math.pow(1 - x, 3);
  const iCubic = (x) => x * x * x;
  const oBack = (x, s = 1.9) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const css = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const show = (el, on, d = 'block') => { el.style.display = on ? d : 'none'; };
  const pop = (el, x, from = 0.4, s = 1.9) => css(el, { opacity: x > 0 ? 1 : 0, transform: `scale(${lerp(from, 1, oBack(x, s))})` });

  const stage = $('stage'), cam = $('cam');
  const scenes = { s1: $('s1'), s2: $('s2'), s3: $('s3'), s4: $('s4'), s5: $('s5') };

  // ---------- construction des éléments répétés ----------
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const msgEls = MESSAGES.map((m, i) => {
    const el = document.createElement('div');
    el.className = 'msg' + (m.mention ? ' mention' : '');
    const min = String(41 + Math.floor(i / 6)).padStart(2, '0');
    const txt = esc(m.txt).replace('@everyone', '<span class="tag">@everyone</span>');
    el.innerHTML = `<div class="av" style="background:${m.color}">${esc(m.u[0].toUpperCase())}</div>`
      + `<div><div><span class="mname" style="color:${m.color}">${esc(m.u)}</span><span class="mtime">auj. à 03:${min}</span></div>`
      + `<div class="mtxt">${txt}</div></div>`;
    $('msgs').appendChild(el);
    return el;
  });

  const notifEls = NOTIFS.map((n) => {
    const el = document.createElement('div');
    el.className = 'notif' + (n.ping ? ' ping' : '');
    el.innerHTML = `<div class="ic">/vnr</div><div><div class="nt">${esc(n.title)}</div><div class="nb">${esc(n.body)}</div></div><div class="now">maintenant</div>`;
    $('notifs').appendChild(el);
    return el;
  });

  // 588 points = 588 membres (grille 21 x 28), allumés dans un ordre aléatoire fixe
  const DOT_COLORS = ['#ccff00', '#ff3dae', '#00e5ff', '#ffd54a', '#4ade80', '#b18cff', '#ff7a59'];
  const dots = [];
  for (let r = 0; r < 28; r++) for (let c = 0; c < 21; c++) {
    const i = document.createElement('i');
    const k = r * 21 + c;
    css(i, { left: c * 48 + 9 + 'px', top: r * 48 + 9 + 'px', background: DOT_COLORS[Math.floor(hash(k * 3.7) * DOT_COLORS.length)] });
    $('dots').appendChild(i);
    dots.push({ el: i, order: hash(k * 9.13 + 1) });
  }
  dots.sort((a, b) => a.order - b.order);

  // 29 gemmes de boost, en couronne autour du texte
  const GEM = '<svg viewBox="0 0 24 24"><path d="M12 2l7 7-7 13L5 9z" fill="#ff3dae"/><path d="M12 2l7 7H5z" fill="#ff8fd0"/><path d="M12 22L9 9h6z" fill="#ffffff55"/></svg>';
  const gems = [];
  for (let i = 0, k = 0; gems.length < 29 && k < 5000; k++) {
    const x = 20 + hash(k * 5.1 + 2) * 960, y = 220 + hash(k * 7.3 + 4) * 1300;
    if (x > 30 && x < 960 && y > 420 && y < 1330) continue; // zone du texte
    if (gems.some((g) => Math.hypot(g.x - x, g.y - y) < 105)) continue;
    const w = document.createElement('div');
    w.innerHTML = GEM;
    const el = w.firstChild;
    $('gems').appendChild(el);
    gems.push({ el, x, y, i: i++ });
  }

  const pplEls = ['kenzo', 'lou', 'sami', 'kaïs', 'lili.exe'].map((u) => {
    const el = document.createElement('div');
    el.className = 'av';
    el.style.background = USERS[u];
    el.textContent = u[0].toUpperCase();
    $('ppl').appendChild(el);
    return el;
  });
  const more = document.createElement('div');
  more.className = 'more';
  more.textContent = '+90';
  $('ppl').appendChild(more);

  const rows = [];
  for (let r = 0; r < 12; r++) {
    const el = document.createElement('div');
    el.className = 'row';
    el.textContent = 'WLH JSUI /VNR • '.repeat(8);
    $('marquee').appendChild(el);
    rows.push(el);
  }

  const bars = [];
  for (let i = 0; i < 8; i++) {
    const el = document.createElement('div');
    el.className = 'bar';
    $('glitch').appendChild(el);
    bars.push(el);
  }

  // grain : quelques trames de bruit pré-calculées
  const grain = $('grain');
  css(grain, { width: '1080px', height: '1920px' });
  const gctx = grain.getContext('2d');
  const grainFrames = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let g = 0; g < 6; g++) {
    const img = gctx.createImageData(540, 960);
    for (let p = 0; p < img.data.length; p += 4) {
      const v = rnd() * 255;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
      img.data[p + 3] = 255;
    }
    grainFrames.push(img);
  }

  // Position du bouton REJOINS (pour le faux curseur) : offsets de mise en page, insensibles aux transformations
  let joinPos = null;
  function measureJoin() {
    let el = $('join'), x = el.offsetWidth / 2, y = el.offsetHeight / 2;
    for (; el && el !== stage; el = el.offsetParent) { x += el.offsetLeft; y += el.offsetTop; }
    joinPos = { x, y };
  }

  // ---------- effets globaux ----------
  function camera(t, f) {
    let A = 0, Z = 0;
    for (const h of HITS) if (t >= h.t) { const d = t - h.t; A += h.s * Math.exp(-d * 10); Z += h.s * Math.exp(-d * 16); }
    A = Math.min(A, 1.3);
    let base = 1;
    if (t < 3) base = 1 + 0.05 * P(t, 0, 2.5);
    if (t >= 15.5 && t < 17.5) base = 1 + 0.12 * P(t, 15.5, 17.5);
    const g = glitchAt(t, f);
    const sx = (hash(f * 1.7) - 0.5) * 2 * A * 34 + (hash(f * 4.1) - 0.5) * g * 60;
    const sy = (hash(f * 2.3 + 5) - 0.5) * 2 * A * 34;
    const rot = (hash(f * 3.1 + 9) - 0.5) * 2 * A * 1.4;
    const skew = (hash(f * 6.9) - 0.5) * g * 12;
    cam.style.transform = `translate(${sx}px,${sy}px) rotate(${rot}deg) skewX(${skew}deg) scale(${base * (1 + Z * 0.07)})`;
  }

  function glitchAt(t, f) {
    let g = 0;
    for (const [a, b, m] of GLITCHES) if (t >= a && t < b) {
      const x = P(t, a, b);
      g = Math.max(g, m * (b - a > 0.3 ? 0.3 + 0.7 * x : 1 - 0.5 * x) * (0.55 + 0.45 * hash(f * 5.3)));
    }
    return g;
  }

  function glitch(t, f) {
    const g = glitchAt(t, f);
    stage.style.setProperty('--rgb', (g * 18).toFixed(1) + 'px');
    $('scan').style.opacity = (g * 0.7).toFixed(2);
    const cols = ['#ccff00', '#ff3dae', '#00e5ff', '#ffffff'];
    bars.forEach((b, i) => {
      const on = g > 0 && hash(f * 11 + i) < 0.35 + g * 0.5;
      show(b, on);
      if (!on) return;
      css(b, {
        top: hash(f * 13 + i * 7) * 1920 + 'px',
        height: 8 + hash(f * 17 + i) * 90 + 'px',
        transform: `translateX(${(hash(f * 19 + i) - 0.5) * 300}px)`,
        background: cols[i % cols.length],
        opacity: (0.25 + g * 0.6).toFixed(2),
      });
    });
  }

  function flash(t) {
    let o = 0, c = '#fff';
    for (const [ft, a, col] of FLASHES) if (t >= ft && t < ft + 0.6) {
      const v = a * Math.exp(-(t - ft) * 9);
      if (v > o) { o = v; c = col; }
    }
    css($('flash'), { opacity: o.toFixed(3), background: c });
  }

  function background(t) {
    const dim = t < 3;
    css($('grid'), { transform: `translate(${(t * 30) % 90}px,${(t * 60) % 90}px)`, opacity: dim ? 0.5 : 1 });
    css($('blobA'), { left: 240 + Math.sin(t * 0.7) * 260 - 450 + 'px', top: 300 + Math.cos(t * 0.5) * 300 + 'px', opacity: dim ? 0.06 : 0.28 });
    css($('blobB'), { left: 640 + Math.cos(t * 0.6) * 240 - 450 + 'px', top: 1250 + Math.sin(t * 0.8) * 260 + 'px', opacity: dim ? 0.1 : 0.34 });
  }

  // ---------- 1. POV : serveur mort (0-3 s) ----------
  const words = [...document.querySelectorAll('#s1title .w')];
  function s1(t) {
    const pv = oBack(P(t, -0.1, 0.06));
    $('pov').style.transform = `scale(${lerp(0.6, 1, pv)}) rotate(${-6 * (1 - pv)}deg)`;
    words.forEach((w, i) => {
      const a = -0.06 + i * 0.15, x = P(t, a, a + 0.16), e = oBack(x);
      let extra = '';
      if (i === 4 && t > 0.6) { const d = t - 0.6; extra = ` rotate(${Math.sin(d * 7) * 7 * Math.exp(-d * 1.6)}deg)`; }
      css(w, { opacity: x > 0 ? 1 : 0, transform: `translateY(${(1 - e) * 70}px) scale(${0.5 + 0.5 * e})${extra}` });
    });
    const c = oCubic(P(t, 0.1, 0.45));
    css($('dc1'), { transform: `translateY(${(1 - c) * 220}px)`, opacity: c });
    const x = P(t, 1.0, 2.6);
    const px = lerp(-150, 860, x);
    const bounce = Math.abs(Math.sin(x * Math.PI * 3)) * 80 * (1 - x * 0.4);
    css($('tumble'), { left: px + 'px', top: 280 - bounce + 'px', transform: `rotate(${px / 65}rad)` });
    $('tdots1').textContent = '.'.repeat(Math.floor(t * 4) % 4);
  }

  // ---------- 2. bascule /vnr (3-8 s) ----------
  let lastMsg = -1;
  function s2(t) {
    const x = P(t, 3.0, 3.2), e = oBack(x, 2.2), eo = iCubic(P(t, 3.5, 3.75));
    show($('slam'), t < 3.75, 'flex');
    css($('slam'), { transform: `translateY(${-eo * 650}px) scale(${lerp(3.2, 1, e) * (1 - eo * 0.6)})`, opacity: 1 - eo });
    $('slam').firstChild.style.opacity = P(t, 3.08, 3.2);

    const c = oCubic(P(t, 3.5, 3.85)), z = iCubic(P(t, 7.55, 8.0));
    css($('dc2'), { transform: `translateY(${(1 - c) * 1300}px) scale(${1 + z * 1.4})`, filter: z > 0 ? `blur(${z * 24}px)` : 'none', opacity: 1 - z });

    let n = 0;
    MESSAGES.forEach((m, i) => {
      const el = msgEls[i], d = t - m.t;
      if (d < 0) { show(el, false); return; }
      n++;
      lastMsg = m.t;
      show(el, true, 'flex');
      const k = P(d, 0, 0.16), ek = oBack(k);
      css(el, { transform: `translateX(${(1 - ek) * -70}px) scale(${0.8 + 0.2 * ek})`, opacity: Math.min(1, k * 2.5) });
      if (!m.mention) el.style.background = d < 0.3 ? `rgba(255,255,255,${(0.09 * (1 - d / 0.3)).toFixed(3)})` : '';
    });
    const badge = $('badge');
    const val = Math.round(Math.pow(n / MESSAGES.length, 1.25) * 112);
    show(badge, n > 0, 'grid');
    badge.textContent = val > 99 ? '99+' : String(Math.max(1, val));
    badge.style.transform = `scale(${1 + 0.3 * Math.exp(-(t - lastMsg) * 14)})`;

    NOTIFS.forEach((nf, i) => {
      const el = notifEls[i], d = t - nf.t;
      if (d < 0 || d > 1.25 || t > 7.6) { show(el, false); return; }
      show(el, true, 'flex');
      const k = NOTIFS.filter((o, j) => j > i && t >= o.t && t - o.t <= 1.25).length;
      const en = oBack(P(d, 0, 0.22), 1.6), out = P(d, 1.05, 1.25);
      css(el, { transform: `translateY(${(1 - en) * -330 + k * 150}px) scale(${1 - k * 0.05})`, opacity: 1 - out, zIndex: 10 - k });
    });

    const de = t - 5.05;
    show($('everyone'), de >= 0 && de < 0.62);
    css($('everyone').firstChild, { transform: `rotate(-8deg) scale(${lerp(2.6, 1, oBack(P(de, 0, 0.15), 2.5))})`, opacity: 1 - P(de, 0.5, 0.62) });
  }

  // ---------- 3. chiffres + gags (8-14 s) ----------
  function card(id, t, [a, b], delays) {
    const el = $(id);
    if (t < a || t >= b) { show(el, false); return null; }
    show(el, true, 'flex');
    const i = oBack(P(t, a, a + 0.18), 1.6), o = iCubic(P(t, b - 0.13, b));
    css(el, { transform: `translateX(${-o * 1150}px) scale(${lerp(1.5, 1, i)})`, filter: o > 0 ? `blur(${o * 16}px)` : 'none' });
    [...el.children].forEach((k, j) => { if (delays[j] != null) pop(k, P(t, a + delays[j], a + delays[j] + 0.16)); });
    return { o };
  }

  function s3(t) {
    const m = card('st-members', t, STATS.members, [0, 0.25, 0.5]);
    show($('dots'), !!m);
    if (m) {
      const n = Math.round(SERVER.members * oCubic(P(t, 8.05, 8.7)));
      $('nMembers').textContent = n;
      $('dots').style.opacity = 1 - m.o;
      dots.forEach((d, k) => { d.el.style.opacity = k < n ? 0.3 : 0; });
    }

    const on = card('st-online', t, STATS.online, [0, 0.25, 0.5]);
    if (on) {
      $('nOnline').textContent = Math.round(SERVER.online * oCubic(P(t, 9.55, 9.95)));
      [$('ring1'), $('ring2')].forEach((r, i) => {
        const ph = (((t - 9.5) / 0.5) + i * 0.5) % 1;
        css(r, { left: '0px', top: '0px', transform: `scale(${1 + ph * 1.6})`, opacity: (1 - ph).toFixed(2) });
      });
    }

    const bo = card('st-boost', t, STATS.boost, [0, 0.12, 0.25, 0.5]);
    show($('gems'), !!bo);
    if (bo) {
      $('nBoost').textContent = Math.round(SERVER.boosts * oCubic(P(t, 11.2, 11.7)));
      $('gems').style.opacity = 1 - bo.o;
      gems.forEach((g) => {
        const k = P(t, 11.05 + g.i * 0.035, 11.05 + g.i * 0.035 + 0.2);
        css(g.el, {
          left: g.x - 45 + 'px', top: g.y - 45 + Math.sin(t * 3 + g.i) * 14 + 'px', opacity: k > 0 ? 1 : 0,
          transform: `scale(${oBack(k, 2.5)}) rotate(${Math.sin(t * 2 + g.i * 1.3) * 18}deg)`,
        });
      });
    }

    const ty = card('st-typing', t, STATS.typing, [0, 0.05, null, 0.9]);
    if (ty) {
      pplEls.forEach((a, i) => { a.style.transform = `translateY(${-Math.abs(Math.sin(t * 8 + i * 0.9)) * 16}px)`; });
      const swap = t >= 13.15;
      show($('tlA'), !swap);
      show($('tlB'), swap);
      if (swap) css($('tlB'), { opacity: 1, transform: `scale(${lerp(1.7, 1, oBack(P(t, 13.15, 13.3), 2.4))}) rotate(${-3 * (1 - P(t, 13.15, 13.4))}deg)` });
      document.querySelectorAll('#st-typing .tdots i').forEach((d, j) => {
        d.style.transform = `translateY(${-Math.max(0, Math.sin(t * 11 - (j % 3) * 0.9)) * 18}px)`;
      });
    }
  }

  // ---------- 4. montée (14-18 s) ----------
  function s4(t) {
    const blackout = t >= 17.5;
    const beatPh = (t - 15.5) % 0.5;
    const inv = t >= 15.5 && t < 17.5 && beatPh < 0.25;
    css($('s4bg'), { background: blackout ? '#000' : inv ? 'var(--acc)' : 'transparent' });
    show($('marquee'), !blackout);
    rows.forEach((r, i) => {
      const dir = i % 2 ? 1 : -1;
      css(r, { transform: `translateX(${dir * (t - 14) * 280 - 900 + (i % 3) * 120}px)`, webkitTextStroke: `3px ${inv ? '#0000003a' : '#ffffff1f'}` });
    });
    show($('hype'), !blackout, 'flex');
    show($('shout'), blackout);
    if (blackout) {
      $('shout').textContent = 'prêt ?';
      pop($('shout'), P(t, 17.55, 17.7), 0.6);
      return;
    }
    const tag = $('hTag');
    tag.textContent = t < 15.5 ? 'répète après moi :' : t < 16.5 ? 'plus fort' : 'ENCORE PLUS FORT';
    tag.style.color = inv ? '#111' : t >= 16.5 ? 'var(--txt)' : 'var(--mute)';
    pop(tag, P(t, 14.0, 14.15));
    [['h1', 14.0], ['h2', 14.5], ['h3', 15.0]].forEach(([id, a]) => {
      const el = $(id), x = P(t, a, a + 0.15);
      css(el, { opacity: x > 0 ? 1 : 0, transform: `scale(${lerp(2.6, 1, oBack(x, 2.4))})`, color: inv ? '#0b0b0b' : '' });
    });
    let sc = 1, rot = 0;
    if (t >= 15.5) {
      const beat = Math.floor((t - 15.5) / 0.5);
      sc = 1 + 0.08 * Math.exp(-beatPh * 10);
      rot = (beat % 2 ? 1 : -1) * 3 * oCubic(P(beatPh, 0, 0.1));
    }
    $('hype').style.transform = `scale(${sc}) rotate(${rot}deg)`;
  }

  // ---------- 5. écran final (18-20 s) ----------
  function s5(t) {
    if (!joinPos) measureJoin();
    const L = oBack(P(t, 18.0, 18.18), 2.2);
    css($('eLogo'), { transform: `scale(${lerp(2.5, 1, L)})`, opacity: 1 });
    pop($('eSmall'), P(t, 18.12, 18.28), 0.6);
    const iv = oBack(P(t, 18.22, 18.42), 1.6);
    css($('invite'), { opacity: P(t, 18.22, 18.3), transform: `translateY(${(1 - iv) * 120}px)` });
    const jx = P(t, 18.32, 18.5);
    const pulse = t > 18.5 ? 1 + 0.045 * Math.exp(-(((t - 18.0) % 0.5)) * 8) : 1;
    const press = t >= 18.95 && t < 19.1 ? 0.9 : 1;
    css($('join'), { opacity: jx > 0 ? 1 : 0, transform: `scale(${lerp(0.3, 1, oBack(jx, 2)) * pulse * press})` });
    const rp = P(t, 19.0, 19.45);
    css($('ripple'), { opacity: rp > 0 && rp < 1 ? (1 - rp).toFixed(2) : 0, transform: `scale(${1 + rp * 7})` });
    css($('stats5'), { opacity: P(t, 18.45, 18.6), transform: `translateY(${(1 - oCubic(P(t, 18.45, 18.65))) * 50}px)` });

    const cp = oCubic(P(t, 18.45, 18.9));
    const cx = lerp(1010, joinPos.x + 40, cp), cy = lerp(1780, joinPos.y + 10, cp);
    const cs = t >= 18.95 && t < 19.1 ? 0.85 : 1;
    css($('cursor'), { left: cx - 18 + 'px', top: cy - 9 + 'px', opacity: t >= 18.45 ? 1 : 0, transform: `scale(${cs})` });

    const jn = oBack(P(t, 19.25, 19.45), 2);
    css($('joined'), { opacity: P(t, 19.25, 19.32), transform: `translateX(-50%) translateY(${(1 - jn) * 90}px) scale(${lerp(0.7, 1, jn)})` });
  }

  // ---------- rendu ----------
  window.renderFrame = function (t) {
    const f = Math.round(t * FPS);
    const at = (k) => t >= SCENES[k][0] && t < SCENES[k][1];
    show(scenes.s1, at('dead'));
    show(scenes.s2, at('vnr'));
    show(scenes.s3, at('stats'));
    show(scenes.s4, at('hype'));
    show(scenes.s5, t >= SCENES.end[0]);
    background(t);
    if (at('dead')) s1(t);
    else if (at('vnr')) s2(t);
    else if (at('stats')) s3(t);
    else if (at('hype')) s4(t);
    else s5(t);
    camera(t, f);
    glitch(t, f);
    flash(t);
    gctx.putImageData(grainFrames[f % grainFrames.length], 0, 0);
  };

  // Aperçu dans le navigateur : ouvrir index.html joue l'animation en boucle (?t=12.3 fige une image)
  window.addEventListener('load', () => {
    const q = new URLSearchParams(location.search);
    if (q.has('render')) return;
    if (q.has('t')) { window.renderFrame(parseFloat(q.get('t'))); return; }
    const t0 = performance.now();
    const loop = () => { window.renderFrame(((performance.now() - t0) / 1000) % TL.DURATION); requestAnimationFrame(loop); };
    loop();
  });
})();
