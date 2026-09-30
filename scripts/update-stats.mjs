import { readFile, writeFile } from "node:fs/promises";

const REPO = "xeen28170-rgb/zenkord";
const INVITE = "X3GpHjUNBd";
const COUNTER = "https://zenkord-counter.zenkord.workers.dev/stats";
const OUT = new URL("../stats.json", import.meta.url);

const headers = { "User-Agent": "zenkord-site-stats", Accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const previous = JSON.parse(await readFile(OUT, "utf8").catch(() => "{}"));

async function github() {
    let all = [];
    for (let page = 1; page <= 10; page++) {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`, { headers });
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        const batch = await res.json();
        all = all.concat(batch);
        if (batch.length < 100) break;
    }
    let downloads = 0;
    for (const rel of all)
        for (const asset of rel.assets)
            if (/\.(exe|dmg|zip|user\.js)$/i.test(asset.name) && !/^(Discord|elevate)\.exe$/i.test(asset.name))
                downloads += asset.download_count;
    const tagged = all.filter(r => /^v\d/.test(r.tag_name) && !r.draft);
    return { downloads, releases: tagged.length, version: tagged[0]?.tag_name ?? null };
}

async function discord() {
    const res = await fetch(`https://discord.com/api/v10/invites/${INVITE}?with_counts=true`, { headers: { "User-Agent": "zenkord-site-stats" } });
    if (!res.ok) throw new Error(`Discord ${res.status}`);
    const json = await res.json();
    return { online: json.approximate_presence_count, members: json.approximate_member_count };
}

async function counter() {
    const res = await fetch(COUNTER, { headers: { "User-Agent": "zenkord-site-stats" } });
    if (!res.ok) throw new Error(`Counter ${res.status}`);
    return res.json();
}

const [gh, dc, ct] = await Promise.allSettled([github(), discord(), counter()]);
const next = {
    downloads: gh.status === "fulfilled" ? gh.value.downloads : previous.downloads ?? null,
    releases: gh.status === "fulfilled" ? gh.value.releases : previous.releases ?? null,
    version: gh.status === "fulfilled" ? gh.value.version : previous.version ?? null,
    online: dc.status === "fulfilled" ? dc.value.online : previous.online ?? null,
    members: dc.status === "fulfilled" ? dc.value.members : previous.members ?? null,
    users: ct.status === "fulfilled" ? ct.value.online : previous.users ?? null,
    peak: ct.status === "fulfilled" ? ct.value.peak : previous.peak ?? null,
};

const changed = Object.keys(next).some(k => next[k] !== previous[k]);
if (!changed) {
    console.log("No change.");
    process.exit(0);
}

await writeFile(OUT, JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2) + "\n");
console.log("stats.json updated", next);
for (const r of [gh, dc, ct]) if (r.status === "rejected") console.warn(r.reason.message);
