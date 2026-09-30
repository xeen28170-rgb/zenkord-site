// Gestion du consentement (CNIL) : refuser est aussi simple qu'accepter,
// aucun appel tiers avant accord, choix conservé 6 mois maximum.
(() => {
  const KEY = "zk-consent";
  const MAX_AGE = 1000 * 60 * 60 * 24 * 182;

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (v && v.v === 1 && Date.now() - v.ts < MAX_AGE) return v;
    } catch {}
    return null;
  }

  function save(live) {
    const v = { v: 1, live, ts: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
    if (!live) { try { sessionStorage.removeItem("zk-live"); } catch {} }
    hideBanner(); closeModal();
    document.dispatchEvent(new CustomEvent("zk:consent", { detail: v }));
  }

  const banner = document.createElement("div");
  banner.className = "cc";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Gestion des cookies");
  banner.innerHTML = `
    <h2>🍪 Ton choix, tes données</h2>
    <p>Ce site n'utilise ni publicité ni mesure d'audience. Avec ton accord, il peut afficher les compteurs <b>en temps réel</b> en interrogeant GitHub, Discord et le compteur Zenkord (hébergé chez Cloudflare) depuis ton navigateur, ce qui leur transmet ton adresse IP. Sans accord, les chiffres sont mis à jour toutes les 10 minutes, sans aucun service tiers. <a href="confidentialite.html">En savoir plus</a></p>
    <div class="cc-actions">
      <button class="btn outline" data-cc="refuse" type="button">Tout refuser</button>
      <button class="btn outline" data-cc="custom" type="button">Personnaliser</button>
      <button class="btn blue" data-cc="accept" type="button">Tout accepter</button>
    </div>`;

  const modal = document.createElement("div");
  modal.className = "cc-modal";
  modal.innerHTML = `
    <div class="cc-box" role="dialog" aria-modal="true" aria-labelledby="cc-title">
      <h2 id="cc-title">Préférences</h2>
      <p>Choisis ce que tu autorises. Tu peux changer d'avis à tout moment avec le lien « Gérer les cookies » en bas de page.</p>
      <div class="cc-row">
        <div><h3>Strictement nécessaires</h3><p>Mémorisent uniquement ton choix sur cette page (stockage local de ton navigateur, 6 mois maximum). Ils ne peuvent pas être désactivés.</p></div>
        <label class="switch"><input type="checkbox" checked disabled aria-label="Strictement nécessaires, toujours actifs"><span></span></label>
      </div>
      <div class="cc-row">
        <div><h3>Contenus en direct</h3><p>Ton navigateur interroge directement api.github.com, discord.com et zenkord-counter.zenkord.workers.dev (Cloudflare) pour afficher les chiffres en temps réel. Ces services reçoivent ton adresse IP.</p></div>
        <label class="switch"><input type="checkbox" id="cc-live" aria-label="Contenus en direct"><span></span></label>
      </div>
      <div class="cc-actions">
        <button class="btn outline" data-cc="refuse" type="button">Tout refuser</button>
        <button class="btn blue" data-cc="save" type="button">Enregistrer</button>
      </div>
    </div>`;

  let lastFocus = null;
  function showBanner() { banner.classList.add("show"); }
  function hideBanner() { banner.classList.remove("show"); }
  function openModal() {
    lastFocus = document.activeElement;
    modal.querySelector("#cc-live").checked = !!read()?.live;
    modal.classList.add("show");
    modal.querySelector("#cc-live").focus();
  }
  function closeModal() {
    if (!modal.classList.contains("show")) return;
    modal.classList.remove("show");
    lastFocus?.focus?.();
  }

  function onClick(e) {
    const a = e.target.closest("[data-cc]")?.dataset.cc;
    if (a === "accept") save(true);
    else if (a === "refuse") save(false);
    else if (a === "custom") openModal();
    else if (a === "save") save(modal.querySelector("#cc-live").checked);
  }
  banner.addEventListener("click", onClick);
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); else onClick(e); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  window.ZKConsent = { get: read, open: openModal };

  document.addEventListener("DOMContentLoaded", () => {
    document.body.append(banner, modal);
    document.querySelectorAll("[data-open-consent]").forEach(b => b.addEventListener("click", openModal));
    if (!read()) showBanner();
  });
})();
