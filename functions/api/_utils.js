export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}
export function badRequest(msg = "bad request", status = 400) { return json({ error: msg }, { status }); }
export async function readJson(request) { try { return await request.json(); } catch { return null; } }
export function getNowMs() { return Date.now(); }
export function clampStr(s, max = 5000) { if (typeof s !== "string") return ""; return s.length <= max ? s : s.slice(0, max); }
export function getIdFromParams(params, name = "id") {
  const v = params[name];
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
export function requireDb(env) {
  if (!env.DB) return { ok:false, res: badRequest("DB not configured", 500) };
  return { ok:true };
}

export async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map(b => b.toString(16).padStart(2,"0")).join("");
}
export function randomKey(len = 32) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
}

let _schemaReady = false;
export async function ensureSchema(env) {
  if (_schemaReady) return;
  const db = env.DB;
  const stmts = [
    `PRAGMA foreign_keys = ON;`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      is_disabled INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON users(name);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_keyhash ON users(key_hash);`,
    `CREATE TABLE IF NOT EXISTS novels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      is_adult INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      published_at INTEGER,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
      UNIQUE (novel_id, number)
    );`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      meta TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(ts);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id);`,
    `CREATE INDEX IF NOT EXISTS idx_novels_status_pub ON novels(status, published_at);`,
    `CREATE INDEX IF NOT EXISTS idx_novels_author_upd ON novels(author_id, updated_at);`,
    `CREATE INDEX IF NOT EXISTS idx_chapters_novel_num ON chapters(novel_id, number);`,
  ];
  // Run sequentially
  for (const s of stmts) {
    await db.prepare(s).run();
  }
  // Add missing columns for existing DBs
  const info = await db.prepare(`PRAGMA table_info(novels)`).all();
  const cols = (info.results || []).map(r => r.name);
  if (!cols.includes("is_adult")) {
    await db.prepare(`ALTER TABLE novels ADD COLUMN is_adult INTEGER NOT NULL DEFAULT 0`).run();
  }

  
  // Add missing columns for users (profile)
  const uinfo = await db.prepare(`PRAGMA table_info(users)`).all();
  const ucols = (uinfo.results || []).map(r => r.name);
  if (!ucols.includes("bio")) {
    await db.prepare(`ALTER TABLE users ADD COLUMN bio TEXT`).run();
  }
  if (!ucols.includes("links")) {
    await db.prepare(`ALTER TABLE users ADD COLUMN links TEXT`).run();
  }
_schemaReady = true;
}

export async function requireEdit(request, env) {
  const key = (request.headers.get("x-edit-key") || "").trim();
  if (!key) return { ok:false, res: badRequest("unauthorized", 401) };
  const keyHash = await sha256Hex(key);
  const u = await env.DB.prepare(
    `SELECT id, name, is_disabled FROM users WHERE key_hash = ? LIMIT 1`
  ).bind(keyHash).first();
  if (!u || u.is_disabled) return { ok:false, res: badRequest("unauthorized", 401) };
  return { ok:true, user: u };
}

export async function logAudit(env, action, target_type, target_id = null, meta = null, actor = "admin") {
  try{
    const ts = getNowMs();
    const m = meta ? (typeof meta === "string" ? meta : JSON.stringify(meta)) : null;
    await env.DB.prepare(
      `INSERT INTO audit_logs (ts, actor, action, target_type, target_id, meta) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(ts, actor, action, target_type, target_id, m).run();
  }catch(_e){
    // do not break main flow if audit fails
  }
}

export function requireAdmin(request, env) {
  const key = (request.headers.get("x-admin-key") || "").trim();
  if (!key || key !== env.ADMIN_TOKEN) return { ok:false, res: badRequest("admin unauthorized", 401) };
  return { ok:true };
}

export async function safe(handler) {
  try { return await handler(); }
  catch (e) { return badRequest(e?.message || "internal error", 500); }
}
