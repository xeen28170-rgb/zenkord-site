// Ciel étoilé interactif sur toute la page : scintillement, étoiles qui fuient
// la souris, parallaxe au défilement, gerbe d'étoiles au clic, étoiles filantes.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cv = document.createElement("canvas");
  cv.id = "sky";
  cv.setAttribute("aria-hidden", "true");
  document.body.prepend(cv);
  const x = cv.getContext("2d");

  const COLORS = ["#ffd84a", "#ffffff", "#ffffff", "#9aa6ff"];
  let W = 0, H = 0, stars = [], sparks = [], shooting = null, nextShoot = 3000;
  const mouse = { x: -9999, y: -9999 };

  const makeStar = () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: .6 + Math.random() * 1.9,
    c: COLORS[Math.random() * COLORS.length | 0],
    phase: Math.random() * 6.28, speed: .6 + Math.random() * 1.6,
    depth: .15 + Math.random() * .85,
    ox: 0, oy: 0,
    cross: Math.random() < .22,
  });

  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.min(240, Math.round(W * H / 8000)) }, makeStar);
  }

  function shape(px, py, r, cross) {
    x.beginPath();
    if (cross) {
      for (let k = 0; k < 8; k++) {
        const rr = k % 2 ? r * .8 : r * 3.2, a = k * Math.PI / 4;
        x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
      }
    } else x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
  }

  function burst(px, py, n = 16) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 4.5;
      sparks.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 1, r: 1.5 + Math.random() * 2.5, c: COLORS[i % COLORS.length] });
    }
  }

  function frame(t) {
    x.clearRect(0, 0, W, H);
    const scroll = scrollY;

    for (const s of stars) {
      const py = ((s.y - scroll * s.depth * .25) % H + H) % H;
      const dx = s.x + s.ox - mouse.x, dy = py + s.oy - mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 130 && !reduce) {
        const push = (130 - dist) / 130 * 3.2;
        s.ox += dx / (dist || 1) * push; s.oy += dy / (dist || 1) * push;
      }
      s.ox *= .93; s.oy *= .93;
      const near = dist < 160 ? 1 - dist / 160 : 0;
      const tw = reduce ? .7 : .3 + .7 * (.5 + .5 * Math.sin(t * .001 * s.speed + s.phase));
      x.globalAlpha = Math.min(1, tw + near * .6);
      x.fillStyle = s.c;
      shape(s.x + s.ox, py + s.oy, s.r * (1 + near * .9), s.cross);
    }

    for (const p of sparks) {
      p.vy += .06; p.vx *= .98; p.x += p.vx; p.y += p.vy; p.life -= .016;
      x.globalAlpha = Math.max(0, p.life); x.fillStyle = p.c;
      shape(p.x, p.y, p.r * p.life + .4, true);
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
        const g = x.createLinearGradient(s.x, s.y, s.x - len, s.y - len * .46);
        g.addColorStop(0, "rgba(255,242,176," + Math.max(0, s.life) + ")");
        g.addColorStop(1, "rgba(255,216,74,0)");
        x.globalAlpha = 1; x.strokeStyle = g; x.lineWidth = 2.4; x.lineCap = "round";
        x.beginPath(); x.moveTo(s.x, s.y); x.lineTo(s.x - len, s.y - len * .46); x.stroke();
        if (s.life <= 0 || s.x > W + 50) shooting = null;
      }
    }
    x.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(frame);
  }

  addEventListener("resize", resize);
  addEventListener("pointermove", e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  document.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });
  document.addEventListener("click", e => {
    if (reduce || e.target.closest("a, button, input, label, summary, select, textarea, [data-drag], .cc, .cc-modal, .dlg")) return;
    burst(e.clientX, e.clientY);
  });

  resize();
  requestAnimationFrame(frame);
})();
