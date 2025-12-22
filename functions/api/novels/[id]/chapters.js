import { json, badRequest, readJson, clampStr, getIdFromParams, getNowMs, safe, requireDb, ensureSchema, requireEdit } from "../../_utils.js";

export async function onRequestGet({ request, params, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const auth = await requireEdit(request, env);
    if (!auth.ok) return auth.res;

    const novel_id = getIdFromParams(params, "id");
    if (!novel_id) return badRequest("invalid id");

    const owns = await env.DB.prepare(`SELECT id FROM novels WHERE id = ? AND author_id = ? LIMIT 1`).bind(novel_id, auth.user.id).first();
    if (!owns) return badRequest("not found", 404);

    const rows = await env.DB.prepare(
      `SELECT id, number, title, updated_at FROM chapters WHERE novel_id = ? ORDER BY number ASC`
    ).bind(novel_id).all();

    return json({ ok:true, items: rows.results || [] });
  });
}

export async function onRequestPost({ request, params, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const auth = await requireEdit(request, env);
    if (!auth.ok) return auth.res;

    const novel_id = getIdFromParams(params, "id");
    if (!novel_id) return badRequest("invalid id");

    const owns = await env.DB.prepare(`SELECT id FROM novels WHERE id = ? AND author_id = ? LIMIT 1`).bind(novel_id, auth.user.id).first();
    if (!owns) return badRequest("not found", 404);

    const body = await readJson(request);
    if (!body) return badRequest("invalid json");

    const number = Number(body.number);
    const title = clampStr(String(body.title || "").trim(), 120);
    const content = clampStr(String(body.content || ""), 200000);
    if (!Number.isFinite(number) || number <= 0) return badRequest("invalid number");
    if (!title) return badRequest("title required");
    if (!content) return badRequest("content required");

    const now = getNowMs();
    const existing = await env.DB.prepare(`SELECT id FROM chapters WHERE novel_id = ? AND number = ? LIMIT 1`).bind(novel_id, number).first();

    if (existing) {
      await env.DB.prepare(`UPDATE chapters SET title = ?, content = ?, updated_at = ? WHERE id = ?`).bind(title, content, now, existing.id).run();
      await env.DB.prepare(`UPDATE novels SET updated_at = ? WHERE id = ?`).bind(now, novel_id).run();
      return json({ ok:true, chapter_id: existing.id, updated:true });
    } else {
      const r = await env.DB.prepare(
        `INSERT INTO chapters (novel_id, number, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(novel_id, number, title, content, now, now).run();
      await env.DB.prepare(`UPDATE novels SET updated_at = ? WHERE id = ?`).bind(now, novel_id).run();
      return json({ ok:true, chapter_id: r.meta.last_row_id, updated:false });
    }
  });
}
