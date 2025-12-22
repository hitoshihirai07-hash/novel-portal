import { json, safe, requireDb, ensureSchema, requireAdmin } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  return safe(async () => {
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const a = requireAdmin(request, env);
    if (!a.ok) return a.res;

    const url = new URL(request.url);
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 200)));
    const q = (url.searchParams.get("q") || "").trim();
    const like = q ? `%${q}%` : null;

    const where = [];
    const binds = [];
    if (like) { where.push(`(action LIKE ? OR target_type LIKE ? OR meta LIKE ?)`); binds.push(like, like, like); }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const sql = `
      SELECT id, ts, actor, action, target_type, target_id, meta
      FROM audit_logs
      ${whereSql}
      ORDER BY ts DESC
      LIMIT ${limit}
    `;
    const rows = await env.DB.prepare(sql).bind(...binds).all();
    return json({ ok: true, items: rows.results || [] });
  });
}
