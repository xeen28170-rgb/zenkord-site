(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Titre : chaque lettre saute à l'arrivée et au survol
  let delay = 0;
  $$("[data-split]").forEach(el => {
    const text = el.textContent;
    el.textContent = "";
    el.setAttribute("aria-hidden", "true");
    for (const ch of text) {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = ch === " " ? " " : ch;
      s.style.animationDelay = (delay += 45) + "ms";
      el.append(s);
    }
  });

  // Étoiles du hero
  const stars = $("#stars");
  const starSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c1 6 5 11 12 12-7 1-11 6-12 12-1-6-5-11-12-12 7-1 11-6 12-12Z"/></svg>';
  for (let i = 0; i < 22; i++) {
    stars.insertAdjacentHTML("beforeend", starSvg);
    const s = stars.lastElementChild;
    const size = 10 + Math.random() * 20;
    Object.assign(s.style, { left: Math.random() * 100 + "%", top: Math.random() * 90 + "%", width: size + "px", height: size + "px", animationDelay: -Math.random() * 3 + "s" });
    s.dataset.depth = (0.2 + Math.random() * 0.8).toFixed(2);
    if (Math.random() > .6) s.classList.add("w");
  }

  // Confettis
  const canvas = $("#confetti"), ctx = canvas.getContext("2d");
  let parts = [], running = false;
  const colors = ["#ffd84a", "#e8a900", "#3b3fd9", "#6c7bff", "#ffffff"];
  function resize() { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; }
  resize(); addEventListener("resize", resize);
  function burst(x, y, n = 90) {
    if (reduce) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .4, w: 7 + Math.random() * 8, h: 5 + Math.random() * 6, c: colors[i % colors.length], star: Math.random() > .75, life: 1 });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function tick() {
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += .32; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= .009;
      ctx.save(); ctx.globalAlpha = Math.max(p.life, 0); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.star) { ctx.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? 3 : 8; ctx.lineTo(Math.cos(k * Math.PI / 4) * rr, Math.sin(k * Math.PI / 4) * rr); } ctx.fill(); }
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
    if (parts.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  // Logo : inclinaison 3D + clic surprise
  const stage = $("#logoStage"), logo = $("#logoBtn");
  if (fine && !reduce) {
    stage.addEventListener("pointermove", e => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      logo.style.transform = `rotateY(${x * 28}deg) rotateX(${-y * 28}deg) scale(1.03)`;
    });
    stage.addEventListener("pointerleave", () => logo.style.transform = "");
  }
  logo.addEventListener("click", () => {
    const r = logo.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 120);
    logo.classList.remove("boing"); void logo.offsetWidth; logo.classList.add("boing");
  });

  // Stickers déplaçables
  $$("[data-drag]").forEach(el => {
    let sx = 0, sy = 0, ox = 0, oy = 0, dx = 0, dy = 0;
    el.addEventListener("pointerdown", e => {
      el.setPointerCapture(e.pointerId); el.classList.add("dragging");
      sx = e.clientX; sy = e.clientY; ox = dx; oy = dy;
    });
    el.addEventListener("pointermove", e => {
      if (!el.classList.contains("dragging")) return;
      dx = ox + e.clientX - sx; dy = oy + e.clientY - sy;
      el.style.translate = `${dx}px ${dy}px`;
      el.style.rotate = `calc(var(--r) + ${Math.max(-20, Math.min(20, (e.clientX - sx) / 8))}deg)`;
    });
    const end = () => { el.classList.remove("dragging"); el.style.rotate = ""; };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("dblclick", () => { dx = dy = 0; el.style.translate = ""; });
  });

  // Parallaxe des étoiles
  if (fine && !reduce) {
    addEventListener("pointermove", e => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      for (const s of stars.children) s.style.translate = `${x * -40 * s.dataset.depth}px ${y * -40 * s.dataset.depth}px`;
    }, { passive: true });
  }

  // Boutons magnétiques
  if (fine && !reduce) $$("[data-magnet]").forEach(b => {
    b.addEventListener("pointermove", e => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`;
    });
    b.addEventListener("pointerleave", () => b.style.transform = "");
  });

  // Cartes qui s'inclinent avec reflet
  if (fine && !reduce) $$(".tilt").forEach(c => {
    c.addEventListener("pointermove", e => {
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.transform = `perspective(900px) rotateY(${(x - .5) * 10}deg) rotateX(${(.5 - y) * 10}deg) translateY(-4px)`;
      c.style.setProperty("--gx", x * 100 + "%"); c.style.setProperty("--gy", y * 100 + "%");
    });
    c.addEventListener("pointerleave", () => c.style.transform = "");
  });

  // Confettis sur les boutons de téléchargement
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-confetti]");
    if (!a || reduce || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const r = a.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 80);
  });

  // Barre de progression + nav
  const nav = $("#nav"), bar = $("#progress");
  const onScroll = () => {
    nav.classList.toggle("scrolled", scrollY > 20);
    bar.style.transform = `scaleX(${scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)})`;
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // Apparitions au défilement
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .15 });
  $$(".pop").forEach((el, i) => { el.style.transitionDelay = (i % 4) * 90 + "ms"; io.observe(el); });

  // Démo interactive
  const app = $("#app");
  let seconds = false;
  $$("[data-app]").forEach(input => input.addEventListener("change", () => {
    const k = input.dataset.app;
    if (k === "clock") { seconds = input.checked; clock(); }
    else app.classList.toggle(k, input.checked);
    if (input.checked) {
      const r = input.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 24);
    }
  }));
  const base = new Date(); base.setHours(15, 34, 21, 0);
  const start = Date.now();
  const pad = n => String(n).padStart(2, "0");
  function clock() {
    const now = base.getTime() + Date.now() - start;
    $$("[data-clock]").forEach(el => {
      const d = new Date(now + +el.dataset.clock * 1000);
      el.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + (seconds ? ":" + pad(d.getSeconds()) : "");
    });
  }
  clock(); setInterval(clock, 1000);

  // Compteurs : stats.json par défaut (même site), temps réel si consentement
  const shown = {};
  const fmt = v => typeof v === "number" ? v.toLocaleString("fr-FR") : (v ?? "—");
  function setLive(key, value) {
    if (value == null) value = "—";
    $$(`[data-live="${key}"]`).forEach(el => {
      if (typeof value !== "number" || reduce) { el.textContent = fmt(value); return; }
      const from = typeof shown[key] === "number" ? shown[key] : 0;
      if (from === value) { el.textContent = fmt(value); return; }
      const t0 = performance.now();
      const step = t => {
        const p = Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(from + (value - from) * e));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    shown[key] = value;
  }
  const apply = d => ["downloads", "online", "members", "releases", "version", "users", "peak", "installs"].forEach(k => d[k] !== undefined && setLive(k, d[k]));

  async function fromFile() {
    try {
      const r = await fetch("stats.json?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" });
      const d = await r.json();
      apply(d);
      if (!isLive() && d.updatedAt) {
        const mins = Math.max(0, Math.round((Date.now() - Date.parse(d.updatedAt)) / 60000));
        $("#statsNote").textContent = `Mis à jour il y a ${mins < 1 ? "moins d'une" : mins} minute${mins > 1 ? "s" : ""}.`;
      }
    } catch { apply({}); }
  }

  async function fromApis() {
    try {
      let all = [];
      for (let page = 1; page <= 5; page++) {
        const r = await fetch(`https://api.github.com/repos/xeen28170-rgb/zenkord/releases?per_page=100&page=${page}`);
        if (!r.ok) throw 0;
        const batch = await r.json();
        all = all.concat(batch);
        if (batch.length < 100) break;
      }
      let downloads = 0;
      for (const rel of all) for (const a of rel.assets)
        if (/\.(exe|dmg|zip|user\.js)$/i.test(a.name) && !/^(Discord|elevate)\.exe$/i.test(a.name)) downloads += a.download_count;
      const tagged = all.filter(r => /^v\d/.test(r.tag_name) && !r.draft);
      apply({ downloads, releases: tagged.length, version: tagged[0]?.tag_name });
    } catch {}
    try {
      const r = await fetch("https://discord.com/api/v10/invites/X3GpHjUNBd?with_counts=true");
      if (!r.ok) throw 0;
      const j = await r.json();
      apply({ online: j.approximate_presence_count, members: j.approximate_member_count });
    } catch {}
    try {
      const r = await fetch("https://zenkord-counter.zenkord.workers.dev/stats");
      if (!r.ok) throw 0;
      const j = await r.json();
      apply({ users: j.online, peak: j.peak, installs: j.installs });
    } catch {}
  }

  const isLive = () => !!window.ZKConsent?.get()?.live;
  let timer = null;
  function refreshMode() {
    clearInterval(timer);
    const live = isLive();
    $$("[data-dot]").forEach(d => d.classList.toggle("idle", !live));
    const mode = $("#liveMode");
    if (live) {
      mode.innerHTML = 'Temps réel activé · <button type="button" data-open-consent-inline>modifier</button>';
      $("#statsNote").textContent = "En temps réel.";
      fromFile().then(fromApis);
      timer = setInterval(fromApis, 30000);
    } else {
      mode.innerHTML = 'Mis à jour toutes les 10 min · <button type="button" data-open-consent-inline>passer en temps réel</button>';
      fromFile();
      timer = setInterval(fromFile, 120000);
    }
    $$("[data-open-consent-inline]").forEach(b => b.addEventListener("click", () => window.ZKConsent.open()));
  }
  document.addEventListener("zk:consent", refreshMode);
  refreshMode();
})();
