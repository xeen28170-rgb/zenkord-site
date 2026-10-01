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

  const season = window.ZK_SEASON || "normal";
  const COLORS = {
    halloween: ["#ff8a1f", "#ffffff", "#c79bff", "#ffd09a"],
    noel: ["#ffffff", "#ffffff", "#ffd84a", "#ff8a95"],
  }[season] || ["#ffd84a", "#ffffff", "#ffffff", "#9aa6ff"];
  let W = 0, H = 0, stars = [], sparks = [], shooting = null, nextShoot = 3000;
  let flakes = [], bats = [], nextBat = 2500;
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
    if (season === "noel") flakes = Array.from({ length: Math.min(160, Math.round(W * H / 12000)) }, () => makeFlake(true));
  }

  // Noël : flocons qui tombent en se balançant
  const makeFlake = (anywhere) => ({
    x: Math.random() * W, y: anywhere ? Math.random() * H : -10,
    r: 1.5 + Math.random() * 3.5, vy: .4 + Math.random() * 1.1,
    sway: Math.random() * 6.28, swaySpeed: .5 + Math.random(), a: .5 + Math.random() * .5,
  });

  // Halloween : silhouette de chauve-souris qui bat des ailes
  function drawBat(bx, by, size, flap) {
    const w = size, h = size * .5, f = Math.sin(flap) * .6;
    fxx.fillStyle = "#1a0b26"; fxx.globalAlpha = .92;
    fxx.beginPath();
    fxx.moveTo(bx, by);
    fxx.quadraticCurveTo(bx - w * .35, by - h * (1 + f), bx - w, by - h * f * 1.2);
    fxx.quadraticCurveTo(bx - w * .7, by + h * .15, bx - w * .55, by + h * .35);
    fxx.quadraticCurveTo(bx - w * .3, by + h * .1, bx, by + h * .45);
    fxx.quadraticCurveTo(bx + w * .3, by + h * .1, bx + w * .55, by + h * .35);
    fxx.quadraticCurveTo(bx + w * .7, by + h * .15, bx + w, by - h * f * 1.2);
    fxx.quadraticCurveTo(bx + w * .35, by - h * (1 + f), bx, by);
    fxx.fill();
    fxx.fillStyle = "#ff8a1f"; fxx.globalAlpha = 1;
    fxx.beginPath(); fxx.arc(bx - size * .07, by + h * .12, size * .03, 0, 7); fxx.arc(bx + size * .07, by + h * .12, size * .03, 0, 7); fxx.fill();
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

    if (season === "noel") {
      fxx.fillStyle = "#ffffff";
      for (const fl of flakes) {
        fl.y += fl.vy * (reduce ? .5 : 1); fl.sway += .01 * fl.swaySpeed;
        const fxp = fl.x + Math.sin(fl.sway) * 18;
        const dx = fxp - mouse.x, dy = fl.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 90) fl.x += dx / (d || 1) * (90 - d) / 90 * 3;
        fxx.globalAlpha = fl.a * .85;
        fxx.beginPath(); fxx.arc(fxp, fl.y, fl.r, 0, Math.PI * 2); fxx.fill();
        if (fl.y > H + 10) Object.assign(fl, makeFlake(false));
      }
    }

    if (season === "halloween") {
      if (!reduce && t > nextBat) {
        const ltr = Math.random() < .5;
        bats.push({ x: ltr ? -60 : W + 60, y: 80 + Math.random() * H * .5, vx: (ltr ? 1 : -1) * (2.2 + Math.random() * 2), size: 26 + Math.random() * 26, flap: Math.random() * 6, wob: Math.random() * 6 });
        nextBat = t + 2500 + Math.random() * 4500;
      }
      for (const bt of bats) {
        bt.x += bt.vx; bt.flap += .32; bt.wob += .04;
        drawBat(bt.x, bt.y + Math.sin(bt.wob) * 24, bt.size, bt.flap);
      }
      bats = bats.filter(bt => bt.x > -120 && bt.x < W + 120);
    }

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
