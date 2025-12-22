import { json, badRequest, safe, requireDb, ensureSchema, getIdFromParams } from "../_utils.js";

export async function onRequestGet({ params, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const id = getIdFromParams(params, "id");
    if (!id) return badRequest("invalid id");

    const row = await env.DB.prepare(
      `SELECT c.id, c.number, c.title, c.content,
              n.id AS novel_id, n.title AS novel_title, n.status, n.is_adult
       FROM chapters c
       JOIN novels n ON n.id = c.novel_id
       WHERE c.id = ?
       LIMIT 1`
    ).bind(id).first();

    if (!row) return badRequest("not found", 404);
    if (row.status !== "published") return badRequest("not published", 403);

    const prev = await env.DB.prepare(
      `SELECT id FROM chapters WHERE novel_id = ? AND number < ? ORDER BY number DESC LIMIT 1`
    ).bind(row.novel_id, row.number).first();

    const next = await env.DB.prepare(
      `SELECT id FROM chapters WHERE novel_id = ? AND number > ? ORDER BY number ASC LIMIT 1`
    ).bind(row.novel_id, row.number).first();

    return json({
      ok:true,
      novel: { id: row.novel_id, title: row.novel_title, is_adult: !!row.is_adult },
      chapter: { id: row.id, number: row.number, title: row.title, content: row.content },
      prev_id: prev?.id || null,
      next_id: next?.id || null
    });
  });
}
