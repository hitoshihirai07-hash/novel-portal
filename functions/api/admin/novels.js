import { json, safe, requireDb, ensureSchema, requireAdmin } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const a = requireAdmin(request, env);
    if (!a.ok) return a.res;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const like = q ? `%${q}%` : null;

    const sql = `
      SELECT id, title, summary, status, is_adult, updated_at, published_at
      FROM novels
      ${like ? "WHERE (title LIKE ? OR summary LIKE ?)" : ""}
      ORDER BY updated_at DESC
      LIMIT 500
    `;
    const stmt = env.DB.prepare(sql);
    const binds = like ? [like, like] : [];
    const rows = await stmt.bind(...binds).all();
    return json({ ok:true, items: rows.results || [] });
  });
}
