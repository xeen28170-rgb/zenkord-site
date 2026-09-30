(() => {
  const PLATFORMS = [
    { id: "win", title: "Windows", sub: "Installeur .exe", test: /^Zenkord-Installer\.exe$/i, icon: "win", main: true },
    { id: "mac-arm", title: "macOS", sub: "Apple Silicon (M1 et +)", test: /mac-arm64\.dmg$/i, icon: "mac" },
    { id: "mac-x64", title: "macOS", sub: "Intel", test: /mac-x64\.dmg$/i, icon: "mac" },
    { id: "chrome", title: "Chrome & Edge", sub: "Extension navigateur", test: /chrome\.zip$/i, icon: "chrome" },
    { id: "firefox", title: "Firefox", sub: "Extension navigateur", test: /firefox\.zip$/i, icon: "firefox" },
    { id: "userscript", title: "Userscript", sub: "Tampermonkey, Violentmonkey", test: /\.user\.js$/i, icon: "code" },
  ];
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
      const cls = `dl-card${p.main ? " main" : ""}${hit ? "" : " off"}`;
      const meta = hit ? `${esc(hit.rel.tag)} · ${size(hit.asset.size)}` : "Bientôt disponible";
      const inner = `<span class="dl-ic ${p.icon}">${svg(p.icon)}</span><span class="dl-txt"><b>${p.title}</b><small>${p.sub}</small><em>${meta}</em></span>${p.main && hit ? '<span class="dl-badge">Recommandé</span>' : ""}`;
      return hit
        ? `<a class="${cls}" href="${esc(hit.asset.url)}" data-confetti download>${inner}</a>`
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
        ${rel.assets.length ? `<ul>${rel.assets.map(a => `<li><a href="${esc(a.url)}" download>${esc(a.name)}</a><span>${size(a.size)} · ${a.downloads.toLocaleString("fr-FR")} téléchargement${a.downloads > 1 ? "s" : ""}</span></li>`).join("")}</ul>` : '<p class="dl-empty">Aucun fichier dans cette version.</p>'}
        <a class="rel-notes" href="${esc(rel.url)}">Notes de version sur GitHub →</a>
      </article>`).join("");
  }

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
