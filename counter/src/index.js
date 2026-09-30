import { DurableObject } from "cloudflare:workers";

// Zenkord envoie un signal toutes les 5 minutes : un identifiant vu il y a
// moins de 6 minutes compte comme « en ligne ».
const WINDOW = 6 * 60 * 1000;
const MAX_IDS_PER_IP = 5;
const ID_RE = /^[a-f0-9]{32}$/;

const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors, ...extra },
});

export class Presence extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;
        this.sql.exec("CREATE TABLE IF NOT EXISTS seen (id TEXT PRIMARY KEY, ip TEXT NOT NULL, ts INTEGER NOT NULL)");
        this.sql.exec("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
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
        return { online, peak, peakAt };
    }
}

export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

        const presence = env.PRESENCE.get(env.PRESENCE.idFromName("global"));

        if (request.method === "GET" && pathname === "/stats")
            return json(await presence.stats(), 200, { "Cache-Control": "public, max-age=10" });

        if (request.method === "POST" && (pathname === "/ping" || pathname === "/bye")) {
            const body = await request.json().catch(() => null);
            if (!body || typeof body.id !== "string" || !ID_RE.test(body.id))
                return json({ error: "invalid id" }, 400);
            if (pathname === "/bye") return json(await presence.bye(body.id));
            const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
            return json(await presence.ping(body.id, ip));
        }

        return json({ error: "not found" }, 404);
    },
};
