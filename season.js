// Thème de saison automatique selon la date de l'ordinateur du visiteur :
// octobre = Halloween, décembre = Noël, le reste de l'année = thème normal.
// Pour tester : ajouter ?saison=halloween, ?saison=noel ou ?saison=normal à l'adresse.
(() => {
  const forced = new URLSearchParams(location.search).get("saison");
  const month = new Date().getMonth();
  const season = ["halloween", "noel", "normal"].includes(forced) ? forced
    : month === 9 ? "halloween" : month === 11 ? "noel" : "normal";
  document.documentElement.dataset.season = season;
  window.ZK_SEASON = season;
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

  document.addEventListener("DOMContentLoaded", () => {
    for (const img of document.querySelectorAll("img")) {
      const src = img.getAttribute("src");
      if (src === "logo.png" || src === "logo-hero.png") img.src = src.replace(".png", `-${season}.png`);
    }
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = `favicon-${season}.png`;

    document.querySelectorAll(".ribbon > div").forEach((row, i) => {
      const words = RIBBONS[season][i % 2];
      row.innerHTML = [...words, ...words].map(w => `<span>${w}</span>`).join("");
    });

    const title = document.querySelector(".hero h1");
    if (title) title.insertAdjacentHTML("beforebegin", `<div class="season-badge">${BADGE[season]}</div>`);
  });
})();
