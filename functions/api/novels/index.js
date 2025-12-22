import { json, safe, requireDb, ensureSchema } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const like = q ? `%${q}%` : null;

    const sql = `
      SELECT n.id, n.title, n.summary, n.status, n.is_adult, n.updated_at, n.published_at,
             u.name AS author_name
      FROM novels n
      JOIN users u ON u.id = n.author_id
      WHERE n.status = 'published'
        ${like ? "AND (title LIKE ? OR summary LIKE ?)" : ""}
      ORDER BY published_at DESC, updated_at DESC
      LIMIT 100
    `;
    const stmt = env.DB.prepare(sql);
    const binds = like ? [like, like] : [];
    const rows = await stmt.bind(...binds).all();
    return json({ ok:true, items: rows.results || [] });
  });
}

import { badRequest, readJson, clampStr, getNowMs, requireEdit } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const auth = await requireEdit(request, env);
    if (!auth.ok) return auth.res;

    const body = await readJson(request);
    if (!body) return badRequest("invalid json");

    const title = clampStr(String(body.title || "").trim(), 120);
    const summary = clampStr(String(body.summary || "").trim(), 2000);
    const is_adult = body.is_adult ? 1 : 0;
    if (!title) return badRequest("title required");
    if (!summary) return badRequest("summary required");

    const now = getNowMs();
    const r = await env.DB.prepare(
      `INSERT INTO novels (author_id, title, summary, status, is_adult, created_at, updated_at, published_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, NULL)`
    ).bind(auth.user.id, title, summary, is_adult, now, now).run();

    return json({ ok:true, id: r.meta.last_row_id });
  });
}
