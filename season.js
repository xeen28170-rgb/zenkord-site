// Thème de saison automatique selon la date de l'ordinateur du visiteur :
// octobre = Halloween, décembre = Noël, le reste de l'année = thème normal.
// Pour tester : ajouter ?saison=halloween, ?saison=noel ou ?saison=normal à l'adresse.
// Chargé de façon bloquante dans <head> : tout est appliqué avant le premier affichage.
(() => {
  const forced = new URLSearchParams(location.search).get("saison");
  const month = new Date().getMonth();
  const season = ["halloween", "noel", "normal"].includes(forced) ? forced
    : month === 9 ? "halloween" : month === 11 ? "noel" : "normal";
  document.documentElement.dataset.season = season;
  window.ZK_SEASON = season;
  const suffix = season === "normal" ? "" : `-${season}`;

  // Les logos sont choisis ici (attribut data-logo) : seule la bonne version est téléchargée
  const swapImg = img => {
    const kind = img.dataset.logo;
    if (kind && !img.getAttribute("src")) img.src = (kind === "hero" ? "logo-hero" : "logo") + suffix + ".webp";
  };
  const l = document.createElement("link");
  l.rel = "preload"; l.as = "image"; l.href = `logo-hero${suffix}.webp`;
  document.head.append(l);
  let badgeDone = season === "normal";
  const apply = node => {
    if (node.nodeType !== 1) return;
    if (node.tagName === "IMG") swapImg(node);
    else node.querySelectorAll?.("img[data-logo]").forEach(swapImg);
    if (!badgeDone && node.matches?.(".hero h1")) {
      node.insertAdjacentHTML("beforebegin", `<div class="season-badge">${BADGE[season]}</div>`);
      badgeDone = true;
    }
  };
  const observer = new MutationObserver(muts => { for (const m of muts) m.addedNodes.forEach(apply); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => { observer.disconnect(); document.querySelectorAll("img[data-logo]").forEach(swapImg); });
  if (season === "normal") return;

  const RIBBONS = {
    halloween: [
      ["Joyeux Halloween 🎃", "Édition effrayante", "380+ plugins", "Bouh ! 👻", "100% gratuit", "Open source"],
      ["Zenkord 🦇", "Ton Discord en mieux", "Zenkord 🦇", "Des bonbons ou un plugin ?"],
    ],
    noel: [
      ["Joyeux Noël 🎄", "Édition de Noël", "380+ plugins", "Ho ho ho ! 🎅", "100% gratuit", "Open source"],
      ["Zenkord ❄️", "Ton Discord en mieux", "Zenkord ❄️", "Le cadeau parfait 🎁"],
    ],
  };
  const BADGE = { halloween: "🎃 Édition Halloween", noel: "🎄 Édition de Noël" };
  const THEME_COLOR = { halloween: "#140a1f", noel: "#06162b" };

  const icon = document.querySelector('link[rel="icon"]');
  if (icon) icon.href = `favicon-${season}.png`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[season]);

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".ribbon > div").forEach((row, i) => {
      const words = RIBBONS[season][i % 2];
      row.innerHTML = [...words, ...words].map(w => `<span>${w}</span>`).join("");
    });
  });
})();
