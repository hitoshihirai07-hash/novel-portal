import { json, safe, requireDb, ensureSchema, requireAdmin } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  return safe(async () => {
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const a = requireAdmin(request, env);
    if (!a.ok) return a.res;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const like = q ? `%${q}%` : null;
    const disabled = (url.searchParams.get("disabled") || "all").trim(); // all|on|off

    const where = [];
    const binds = [];
    if (like) { where.push(`u.name LIKE ?`); binds.push(like); }
    if (disabled === "on") where.push(`u.is_disabled = 1`);
    if (disabled === "off") where.push(`u.is_disabled = 0`);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        u.id, u.name, u.is_disabled, u.created_at,
        (SELECT COUNT(1) FROM novels n WHERE n.author_id = u.id) AS novels_count,
        (SELECT COUNT(1) FROM novels n WHERE n.author_id = u.id AND n.status = 'published') AS published_count,
        (SELECT MAX(n.updated_at) FROM novels n WHERE n.author_id = u.id) AS last_updated_at
      FROM users u
      ${whereSql}
      ORDER BY last_updated_at DESC NULLS LAST, created_at DESC
      LIMIT 500
    `;
    const rows = await env.DB.prepare(sql).bind(...binds).all();
    return json({ ok: true, items: rows.results || [] });
  });
}
