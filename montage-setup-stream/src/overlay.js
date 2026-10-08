// Calque transparent (titre, sous-titres, gags) : window.renderFrame(t), t = temps du montage.
(function () {
  const E = window.EDIT;
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, x) => a + (b - a) * x;
  const oBack = (x, s = 1.9) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2));
  const css = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const norm = (w) => w.toLowerCase().replace(/[^a-zà-ÿ'-]/g, '');

  // ---------- sous-titres : groupes de 1 à 3 mots ----------
  const words = E.WORDS.map(([w, s, e]) => ({ w, s: E.mapT(s), e: E.mapT(e), emph: E.EMPH.includes(norm(w)) }));
  const groups = [];
  let cur = [];
  words.forEach((wd, i) => {
    cur.push(wd);
    const next = words[i + 1];
    const chars = cur.reduce((n, x) => n + x.w.length + 1, 0);
    const punct = /[,.?!:]$/.test(wd.w);
    if (!next || punct || cur.length >= 3 || chars + next.w.length > 24 || next.s - wd.e > 0.3) { groups.push(cur); cur = []; }
  });
  groups.forEach((g, i) => {
    g.start = g[0].s - 0.06;
    const next = groups[i + 1];
    const last = g[g.length - 1].e;
    g.end = next && next[0].s - 0.06 - last < 0.6 ? next[0].s - 0.06 : last + 0.35;
  });
  const capLine = $('capLine');
  let shown = null;
  function captions(t) {
    const g = groups.find((x) => t >= x.start && t < x.end);
    if (g !== shown) {
      capLine.innerHTML = '';
      if (g) g.forEach((wd) => {
        const s = document.createElement('span');
        s.className = 'w' + (wd.emph ? ' emph' : '');
        s.textContent = wd.w.replace(/\s([?:!])/g, ' $1');
        wd.el = s;
        capLine.appendChild(s);
      });
      shown = g;
    }
    if (!g) return;
    const k = oBack(P(t, g.start, g.start + 0.12), 2);
    capLine.style.transform = `scale(${lerp(0.75, 1, k)})`;
    g.forEach((wd) => {
      const on = t >= wd.s - 0.03 && t < Math.max(wd.e, wd.s + 0.12);
      const done = t >= wd.s - 0.03;
      wd.el.classList.toggle('on', on);
      const pop = on ? 1 + 0.1 * (1 - P(t, wd.s, wd.s + 0.12)) + 0.02 : 1;
      css(wd.el, { transform: `scale(${pop})`, opacity: done ? 1 : 0.9 });
    });
  }

  // ---------- gags ----------
  const memes = window.MEMES || {};
  const ITEMS = ['peripheriques', 'micro', 'casque', 'ecran'];
  const itemsEnd = E.mapT(26.1) + 0.3;
  const gags = E.GAGS.map((g) => {
    const el = $('g-' + g.id);
    const t0 = E.mapT(g.t);
    const t1 = ITEMS.includes(g.id) ? itemsEnd : t0 + g.dur;
    if (memes[g.id]) { // un vrai mème fourni remplace le visuel
      el.innerHTML = `<img class="memeimg" src="${memes[g.id]}">`;
      css(el, { left: '540px', top: '760px', width: '0', height: '0' });
    }
    return { ...g, el, t0, t1 };
  });
  const prixStampT = E.mapT(11.9);

  function gag(t, g) {
    const on = t >= g.t0 && t < g.t1;
    g.el.classList.toggle('hide', !on);
    if (!on) return;
    const d = t - g.t0;
    const inK = oBack(P(d, 0, 0.18), 2.2), out = P(t, g.t1 - 0.12, g.t1);
    let extra = '';
    if (memes[g.id]) { css(g.el, { transform: `scale(${lerp(0.3, 1, inK) * (1 - out * 0.4)})`, opacity: 1 - out }); return; }
    switch (g.id) {
      case 'reflexion': extra = ` rotate(${Math.sin(d * 9) * 10}deg)`; break;
      case 'comms': case 'comms2':
        g.el.querySelector('.arrow').style.transform = `rotate(40deg) translateX(${Math.sin(d * 14) * 16}px)`; break;
      case 'prix': {
        const st = $('prixStamp'), k = P(t, prixStampT, prixStampT + 0.14);
        css(st, { opacity: k > 0 ? 1 : 0, transform: `rotate(-14deg) scale(${lerp(2.6, 1, oBack(k, 2.5))})` });
        break;
      }
      case 'budget': {
        const v = lerp(500, 12.5, Math.pow(P(d, 0.05, 0.6), 0.7));
        $('budgetVal').textContent = v.toFixed(2).replace('.', ',').replace(',00', '') + ' €';
        const sh = d > 0.6 ? Math.sin(d * 60) * 6 * Math.exp(-(d - 0.6) * 6) : 0;
        extra = ` translateX(${sh}px)`;
        break;
      }
      case 'liste':
        g.el.querySelectorAll('.box').forEach((b, i) => { b.textContent = d > 0.3 + i * 0.22 ? '✓' : ''; });
        break;
      case 'osef': extra = ` rotate(${Math.sin(d * 30) * 3 * Math.exp(-d * 5)}deg)`; break;
    }
    css(g.el, { transform: `scale(${lerp(0.3, 1, inK) * (1 - out * 0.4)})${extra}`, opacity: 1 - out, transformOrigin: '50% 50%' });
  }

  const flashes = [prixStampT, E.mapT(29.77)];
  window.renderFrame = function (t) {
    const tk = oBack(P(t, 0, 0.2), 2);
    css($('title'), { transform: `scale(${lerp(0.6, 1, tk)})`, opacity: P(t, 0, 0.05) });
    captions(t);
    gags.forEach((g) => gag(t, g));
    const end = $('endtag'), es = E.DURATION - 1.5;
    end.classList.toggle('hide', t < es);
    css(end, { transform: `scale(${lerp(0.4, 1, oBack(P(t, es, es + 0.2), 2.2)) * (1 + 0.03 * Math.sin((t - es) * 12))})` });
    let f = 0;
    for (const ft of flashes) if (t >= ft && t < ft + 0.4) f = Math.max(f, 0.35 * Math.exp(-(t - ft) * 10));
    $('flash').style.opacity = f.toFixed(3);
  };

  window.addEventListener('load', () => {
    const q = new URLSearchParams(location.search);
    if (q.has('render')) return;
    document.body.classList.add('preview');
    if (q.has('t')) { window.renderFrame(parseFloat(q.get('t'))); return; }
    const t0 = performance.now();
    const loop = () => { window.renderFrame(((performance.now() - t0) / 1000) % E.DURATION); requestAnimationFrame(loop); };
    loop();
  });
})();
