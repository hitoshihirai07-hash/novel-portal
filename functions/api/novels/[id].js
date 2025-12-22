import { json, badRequest, safe, requireDb, ensureSchema, getIdFromParams } from "../_utils.js";

export async function onRequestGet({ params, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const id = getIdFromParams(params, "id");
    if (!id) return badRequest("invalid id");

    const n = await env.DB.prepare(
      `SELECT n.id, n.title, n.summary, n.status, n.is_adult, n.updated_at, n.published_at,
              u.id AS author_id, u.id AS author_id, u.name AS author_name
       FROM novels n
       JOIN users u ON u.id = n.author_id
       WHERE n.id = ? AND n.status = 'published'
       LIMIT 1`
    ).bind(id).first();

    if (!n) return badRequest("not found", 404);
    return json(n);
  });
}
