// Ciel étoilé interactif sur toute la page : scintillement, étoiles qui fuient
// la souris, parallaxe au défilement, gerbe d'étoiles au clic, étoiles filantes.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cv = document.createElement("canvas");
  cv.id = "sky";
  cv.setAttribute("aria-hidden", "true");
  document.body.prepend(cv);
  const x = cv.getContext("2d");
  // Couche au-dessus de la page pour les gerbes et les étoiles filantes
  const fx = document.createElement("canvas");
  fx.id = "sky-fx";
  fx.setAttribute("aria-hidden", "true");
  document.body.append(fx);
  const fxx = fx.getContext("2d");

  const COLORS = ["#ffd84a", "#ffffff", "#ffffff", "#9aa6ff"];
  let W = 0, H = 0, stars = [], sparks = [], shooting = null, nextShoot = 3000;
  const mouse = { x: -9999, y: -9999 };

  const makeStar = () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: 1.2 + Math.random() * 2.6,
    c: COLORS[Math.random() * COLORS.length | 0],
    phase: Math.random() * 6.28, speed: .6 + Math.random() * 1.6,
    depth: .15 + Math.random() * .85,
    ox: 0, oy: 0,
    cross: Math.random() < .4,
  });

  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = fx.width = W * dpr; cv.height = fx.height = H * dpr;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    fxx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.min(220, Math.round(W * H / 9000)) }, makeStar);
  }

  function shape(px, py, r, cross, ctx = x) {
    ctx.beginPath();
    if (cross) {
      for (let k = 0; k < 8; k++) {
        const rr = k % 2 ? r * .8 : r * 3.2, a = k * Math.PI / 4;
        ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
      }
    } else ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function burst(px, py, n = 24) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 4.5;
      sparks.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 1, r: 2.5 + Math.random() * 3.5, c: COLORS[i % COLORS.length] });
    }
  }

  function frame(t) {
    x.clearRect(0, 0, W, H);
    fxx.clearRect(0, 0, W, H);
    const scroll = scrollY;

    for (const s of stars) {
      const py = reduce ? s.y : ((s.y - scroll * s.depth * .25) % H + H) % H;
      const dx = s.x + s.ox - mouse.x, dy = py + s.oy - mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 150) {
        const push = (150 - dist) / 150 * 4;
        s.ox += dx / (dist || 1) * push; s.oy += dy / (dist || 1) * push;
      }
      s.ox *= .93; s.oy *= .93;
      const near = dist < 180 ? 1 - dist / 180 : 0;
      const tw = (reduce ? .55 : .3) + (reduce ? .45 : .7) * (.5 + .5 * Math.sin(t * .001 * s.speed * (reduce ? .5 : 1) + s.phase));
      x.globalAlpha = Math.min(1, tw + near * .6);
      const r = s.r * (1 + near * 1.1);
      if (r > 2.6) {
        const halo = x.createRadialGradient(s.x + s.ox, py + s.oy, 0, s.x + s.ox, py + s.oy, r * 4);
        halo.addColorStop(0, s.c === "#ffd84a" ? "rgba(255,216,74,.35)" : "rgba(255,255,255,.25)");
        halo.addColorStop(1, "rgba(255,255,255,0)");
        x.fillStyle = halo; x.beginPath(); x.arc(s.x + s.ox, py + s.oy, r * 4, 0, Math.PI * 2); x.fill();
      }
      x.fillStyle = s.c;
      shape(s.x + s.ox, py + s.oy, r, s.cross);
    }

    for (const p of sparks) {
      p.vy += .06; p.vx *= .98; p.x += p.vx; p.y += p.vy; p.life -= .016;
      fxx.globalAlpha = Math.max(0, p.life); fxx.fillStyle = p.c;
      shape(p.x, p.y, p.r * p.life + .4, true, fxx);
    }
    sparks = sparks.filter(p => p.life > 0);

    if (!reduce) {
      if (!shooting && t > nextShoot) {
        shooting = { x: Math.random() * W * .7, y: Math.random() * H * .35, life: 1 };
        nextShoot = t + 5000 + Math.random() * 7000;
      }
      if (shooting) {
        const s = shooting, len = 160;
        s.x += 13; s.y += 6; s.life -= .018;
        const g = fxx.createLinearGradient(s.x, s.y, s.x - len, s.y - len * .46);
        g.addColorStop(0, "rgba(255,242,176," + Math.max(0, s.life) + ")");
        g.addColorStop(1, "rgba(255,216,74,0)");
        fxx.globalAlpha = 1; fxx.strokeStyle = g; fxx.lineWidth = 2.4; fxx.lineCap = "round";
        fxx.beginPath(); fxx.moveTo(s.x, s.y); fxx.lineTo(s.x - len, s.y - len * .46); fxx.stroke();
        if (s.life <= 0 || s.x > W + 50) shooting = null;
      }
    }
    x.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  addEventListener("resize", resize);
  addEventListener("pointermove", e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  document.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });
  document.addEventListener("click", e => {
    if (e.target.closest("a, button, input, label, summary, select, textarea, [data-drag], .cc, .cc-modal, .dlg")) return;
    burst(e.clientX, e.clientY);
  });

  resize();
  requestAnimationFrame(frame);
})();
