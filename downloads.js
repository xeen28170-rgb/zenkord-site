(() => {
  const PLATFORMS = [
    { id: "win", title: "Windows", sub: "Installeur .exe", test: /^Zenkord-Installer\.exe$/i, icon: "win", main: true, stable: "Zenkord-Installer.exe" },
    { id: "mac-arm", title: "macOS", sub: "Apple Silicon (M1 et +)", test: /mac-arm64\.dmg$/i, icon: "mac" },
    { id: "mac-x64", title: "macOS", sub: "Intel", test: /mac-x64\.dmg$/i, icon: "mac" },
    { id: "chrome", title: "Chrome & Edge", sub: "Extension navigateur", test: /chrome\.zip$/i, icon: "chrome", stable: "Zenkord-Chrome.zip" },
    { id: "firefox", title: "Firefox", sub: "Extension navigateur", test: /firefox\.zip$/i, icon: "firefox", stable: "Zenkord-Firefox.zip" },
    { id: "userscript", title: "Userscript", sub: "Tampermonkey, Violentmonkey", test: /\.user\.js$/i, icon: "code", stable: "Zenkord.user.js" },
  ];
  // Lien « dernière version » de GitHub : redirige toujours vers le fichier le plus récent, instantanément
  const LATEST = "https://github.com/xeen28170-rgb/zenkord/releases/latest/download/";
  const ICONS = {
    win: '<path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm0 13 7.5 1.1v-7H3v5.9Zm8.4 1.2L21 21v-8.4h-9.6v7.1ZM11.4 4.3V11.5H21V3l-9.6 1.3Z"/>',
    mac: '<path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.8C6.9 7.4 5.4 8.3 4.6 9.8c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.6-1-2.8-4.2ZM14.1 5.8c.7-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3Z"/>',
    chrome: '<path d="M12 2a10 10 0 0 1 8.7 5H12a5 5 0 0 0-4.8 3.6L4.3 5.5A10 10 0 0 1 12 2Zm9.4 6.5A10 10 0 0 1 12.6 22l4.3-7.5A5 5 0 0 0 16.2 9h5.2ZM3.4 7 7.7 14.5A5 5 0 0 0 12 17a5 5 0 0 0 1.3-.2L10.7 21.9A10 10 0 0 1 3.4 7ZM12 8.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z"/>',
    firefox: '<path d="M12 2c2 0 3.6.6 5 1.6-1.6-.4-3.3 0-4.4 1 1.7-.1 3.5.7 4.5 2.3 1.5 2.4.9 5.6-1.4 7.2-2.2 1.6-5.4 1.3-7.1-.8-.9-1-1.2-2.4-.9-3.7-.8.6-1.2 1.6-1.2 2.6-.9-1.1-1.1-2.6-.6-4-1.7 1.3-2.4 3.6-1.9 5.7A10 10 0 1 0 12 2Z"/>',
    code: '<path d="m8.7 16.6-4.6-4.6 4.6-4.6 1.4 1.4L6.9 12l3.2 3.2-1.4 1.4Zm6.6 0-1.4-1.4 3.2-3.2-3.2-3.2 1.4-1.4 4.6 4.6-4.6 4.6Z"/>',
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const size = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " Mo" : Math.max(1, Math.round(b / 1024)) + " Ko";
  const date = d => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const svg = k => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[k]}</svg>`;

  function findLatest(list, test) {
    for (const rel of list) {
      const asset = rel.assets.find(a => test.test(a.name));
      if (asset) return { rel, asset };
    }
    return null;
  }

  function renderCards(el, list) {
    el.innerHTML = PLATFORMS.map(p => {
      const hit = findLatest(list, p.test);
      const url = p.stable ? LATEST + p.stable : hit?.asset.url;
      const cls = `dl-card${p.main ? " main" : ""}${url ? "" : " off"}`;
      const meta = hit ? `${esc(hit.rel.tag)} · ${size(hit.asset.size)}` : url ? "Dernière version" : "Bientôt disponible";
      const inner = `<span class="dl-ic ${p.icon}">${svg(p.icon)}</span><span class="dl-txt"><b>${p.title}</b><small>${p.sub}</small><em>${meta}</em></span>${p.main && url ? '<span class="dl-badge">Recommandé</span>' : ""}`;
      return url
        ? `<a class="${cls}" href="${esc(url)}" data-confetti data-dl download>${inner}</a>`
        : `<div class="${cls}" aria-disabled="true">${inner}</div>`;
    }).join("");
    el.dispatchEvent(new CustomEvent("zk:rendered", { bubbles: true }));
  }

  function renderHistory(el, list) {
    if (!list.length) { el.innerHTML = '<p class="dl-empty">Aucune version publiée pour le moment.</p>'; return; }
    el.innerHTML = list.map((rel, i) => `
      <article class="rel">
        <header>
          <h2>${esc(rel.name)}</h2>
          ${i === 0 ? '<span class="tag new">Dernière version</span>' : ""}
          ${rel.prerelease ? '<span class="tag pre">Préversion</span>' : ""}
          <time datetime="${esc(rel.date)}">${date(rel.date)}</time>
        </header>
        ${rel.assets.length ? `<ul>${rel.assets.map(a => `<li><a href="${esc(a.url)}" data-dl download>${esc(a.name)}</a><span>${size(a.size)} · ${a.downloads.toLocaleString("fr-FR")} téléchargement${a.downloads > 1 ? "s" : ""}</span></li>`).join("")}</ul>` : '<p class="dl-empty">Aucun fichier dans cette version.</p>'}
        <a class="rel-notes" href="${esc(rel.url)}">Notes de version sur GitHub →</a>
      </article>`).join("");
  }

  // Avant le premier téléchargement de la visite, on propose de rejoindre le Discord.
  const INVITE = "https://discord.gg/X3GpHjUNBd";
  let asked = false, pendingUrl = null, lastFocus = null;
  const dlg = document.createElement("div");
  dlg.className = "dlg";
  dlg.innerHTML = `
    <div class="dlg-box" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
      <button class="dlg-close" type="button" aria-label="Fermer" data-dlg="close">✕</button>
      <div class="dlg-ic"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 4.4A19.7 19.7 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9 .1 13.5.3 18a19.8 19.8 0 0 0 6 3l1.3-2a12.8 12.8 0 0 1-2-1l.5-.4a14.1 14.1 0 0 0 12 0l.5.4-2 1 1.3 2a19.7 19.7 0 0 0 6-3c.4-5.2-.8-9.7-3.6-13.6ZM8.5 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg></div>
      <h2 id="dlg-title">Avant d'installer…</h2>
      <p>Rejoins le <b>Discord officiel de Zenkord</b> : aide à l'installation, annonces des mises à jour et une commu qui t'attend !</p>
      <div class="dlg-actions">
        <button class="btn blue" type="button" data-dlg="join">Rejoindre le Discord</button>
        <button class="btn white" type="button" data-dlg="skip">Télécharger sans rejoindre</button>
      </div>
      <small>Le téléchargement démarre dans les deux cas.</small>
    </div>`;
  document.body.append(dlg);

  function start(url) { asked = true; close(); location.href = url; }
  function close() { dlg.classList.remove("show"); lastFocus?.focus?.(); }
  dlg.addEventListener("click", e => {
    const act = e.target.closest("[data-dlg]")?.dataset.dlg;
    if (e.target === dlg || act === "close") return close();
    if (act === "join") { window.open(INVITE, "_blank", "noopener"); setTimeout(() => start(pendingUrl), 400); }
    if (act === "skip") start(pendingUrl);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && dlg.classList.contains("show")) close(); });
  document.addEventListener("click", e => {
    const a = e.target.closest("a[data-dl]");
    if (!a || asked || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    pendingUrl = a.href; lastFocus = a;
    dlg.classList.add("show");
    dlg.querySelector('[data-dlg="join"]').focus();
  });

  fetch("releases.json?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" })
    .then(r => r.json())
    .catch(() => [])
    .then(list => {
      const cards = document.getElementById("dlCards");
      const history = document.getElementById("history");
      if (cards) renderCards(cards, list);
      if (history) renderHistory(history, list);
    });
})();
