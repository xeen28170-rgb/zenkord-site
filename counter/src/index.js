import { DurableObject } from "cloudflare:workers";

// Zenkord envoie un signal toutes les 5 minutes : un identifiant vu il y a
// moins de 6 minutes compte comme « en ligne ».
const WINDOW = 6 * 60 * 1000;
const MAX_IDS_PER_IP = 5;
const MAX_INSTALLS_PER_IP_PER_DAY = 3;
const ID_RE = /^[a-f0-9]{32}$/;

// Seul le site lit /stats depuis un navigateur. Les signaux /ping, /install
// et /bye viennent du logiciel, jamais d'une page web.
const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
});

// En IPv6, une même connexion dispose d'un bloc /64 entier : on regroupe
// donc par bloc, sinon les limites par IP se contournent en changeant d'adresse.
function ipKey(ip) {
    if (!ip.includes(":")) return ip;
    const [head, tail = ""] = ip.split("::");
    const start = head ? head.split(":") : [];
    const end = tail ? tail.split(":") : [];
    const groups = [...start, ...Array(Math.max(0, 8 - start.length - end.length)).fill("0"), ...end];
    return groups.slice(0, 4).join(":") + "::/64";
}

export class Presence extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;
        this.sql.exec("CREATE TABLE IF NOT EXISTS seen (id TEXT PRIMARY KEY, ip TEXT NOT NULL, ts INTEGER NOT NULL)");
        this.sql.exec("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
        this.sql.exec("CREATE TABLE IF NOT EXISTS install_ips (ip TEXT PRIMARY KEY, n INTEGER NOT NULL)");
    }

    getMeta(k) {
        return this.sql.exec("SELECT v FROM meta WHERE k = ?", k).toArray()[0]?.v;
    }

    setMeta(k, v) {
        this.sql.exec("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", k, String(v));
    }

    // L'adresse IP n'est jamais stockée en clair : seulement une empreinte
    // salée avec un sel aléatoire renouvelé chaque jour, gardée 6 minutes.
    async hashIp(ip) {
        const day = new Date().toISOString().slice(0, 10);
        let salt = this.getMeta("salt");
        if (this.getMeta("saltDay") !== day || !salt) {
            salt = crypto.randomUUID();
            this.setMeta("salt", salt);
            this.setMeta("saltDay", day);
            this.sql.exec("DELETE FROM install_ips");
        }
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ip));
        return [...new Uint8Array(digest).slice(0, 12)].map(b => b.toString(16).padStart(2, "0")).join("");
    }

    prune() {
        this.sql.exec("DELETE FROM seen WHERE ts < ?", Date.now() - WINDOW);
    }

    async ping(id, ip) {
        this.prune();
        const ipHash = await this.hashIp(ip);
        const known = this.sql.exec("SELECT 1 FROM seen WHERE id = ?", id).toArray().length > 0;
        const perIp = this.sql.exec("SELECT COUNT(*) AS n FROM seen WHERE ip = ?", ipHash).one().n;
        if (known || perIp < MAX_IDS_PER_IP)
            this.sql.exec("INSERT INTO seen (id, ip, ts) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET ts = excluded.ts", id, ipHash, Date.now());
        return this.stats();
    }

    // Une installation = un signal unique envoyé par Zenkord, sans identifiant.
    // Limité par empreinte d'IP et par jour pour éviter qu'on gonfle le chiffre.
    async install(ip) {
        const ipHash = await this.hashIp(ip);
        const n = this.sql.exec("SELECT n FROM install_ips WHERE ip = ?", ipHash).toArray()[0]?.n ?? 0;
        if (n < MAX_INSTALLS_PER_IP_PER_DAY) {
            this.sql.exec("INSERT INTO install_ips (ip, n) VALUES (?, 1) ON CONFLICT(ip) DO UPDATE SET n = n + 1", ipHash);
            this.setMeta("installs", Number(this.getMeta("installs") ?? 0) + 1);
        }
        return this.stats();
    }

    bye(id) {
        this.sql.exec("DELETE FROM seen WHERE id = ?", id);
        return this.stats();
    }

    stats() {
        this.prune();
        const online = this.sql.exec("SELECT COUNT(*) AS n FROM seen").one().n;
        let peak = Number(this.getMeta("peak") ?? 0);
        let peakAt = this.getMeta("peakAt") ?? null;
        if (online > peak) {
            peak = online;
            peakAt = new Date().toISOString();
            this.setMeta("peak", peak);
            this.setMeta("peakAt", peakAt);
        }
        return { online, peak, peakAt, installs: Number(this.getMeta("installs") ?? 0) };
    }
}

export default {
    async fetch(request, env, ctx) {
        const { pathname } = new URL(request.url);
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

        const presence = env.PRESENCE.get(env.PRESENCE.idFromName("global"));

        if (request.method === "GET" && pathname === "/stats") {
            const cache = caches.default;
            const cached = await cache.match(request);
            if (cached) return cached;
            const response = json(await presence.stats(), 200, { ...cors, "Cache-Control": "public, max-age=10" });
            ctx.waitUntil(cache.put(request, response.clone()));
            return response;
        }

        // Les pages web envoient toujours leur origine (https://…) avec ces requêtes,
        // contrairement au logiciel : un site tiers ne peut donc pas gonfler les compteurs.
        if (request.method === "POST" && /^https?:/i.test(request.headers.get("Origin") ?? ""))
            return json({ error: "forbidden" }, 403);

        const ip = ipKey(request.headers.get("CF-Connecting-IP") ?? "unknown");

        if (request.method === "POST" && pathname === "/install")
            return json(await presence.install(ip));

        if (request.method === "POST" && (pathname === "/ping" || pathname === "/bye")) {
            if (!request.headers.get("Content-Type")?.startsWith("application/json"))
                return json({ error: "invalid content type" }, 415);
            const body = await request.json().catch(() => null);
            if (!body || typeof body.id !== "string" || !ID_RE.test(body.id))
                return json({ error: "invalid id" }, 400);
            if (pathname === "/bye") return json(await presence.bye(body.id));
            return json(await presence.ping(body.id, ip));
        }

        return json({ error: "not found" }, 404);
    },
};
