import { json, safe, requireDb, ensureSchema, requireEdit } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const auth = await requireEdit(request, env);
    if (!auth.ok) return auth.res;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const like = q ? `%${q}%` : null;

    const sql = `
      SELECT id, title, summary, status, is_adult, updated_at, published_at
      FROM novels
      WHERE author_id = ?
        ${like ? "AND (title LIKE ? OR summary LIKE ?)" : ""}
      ORDER BY updated_at DESC
      LIMIT 300
    `;
    const stmt = env.DB.prepare(sql);
    const binds = like ? [auth.user.id, like, like] : [auth.user.id];
    const rows = await stmt.bind(...binds).all();
    return json({ ok:true, items: rows.results || [] });
  });
}
