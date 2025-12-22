import { json, badRequest, readJson, clampStr, getNowMs, safe, requireDb, ensureSchema, sha256Hex, randomKey } from "./_utils.js";

export async function onRequestPost({ request, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const body = await readJson(request);
    if (!body) return badRequest("invalid json");

    const name = clampStr(String(body.name || "").trim(), 40);
    const invite = String(body.invite || "").trim();
    if (!name) return badRequest("name required");
    if (!invite || invite !== env.INVITE_CODE) return badRequest("invalid invite", 403);

    const key = randomKey(16);
    const keyHash = await sha256Hex(key);
    const now = getNowMs();

    // Insert user; if name exists, reject
    const existing = await env.DB.prepare(`SELECT id FROM users WHERE name = ? LIMIT 1`).bind(name).first();
    if (existing) return badRequest("name already exists", 409);

    await env.DB.prepare(
      `INSERT INTO users (name, key_hash, is_disabled, created_at) VALUES (?, ?, 0, ?)`
    ).bind(name, keyHash, now).run();

    return json({ ok:true, edit_key: key });
  });
}
