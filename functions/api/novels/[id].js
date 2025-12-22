import { json, badRequest, safe, requireDb, ensureSchema, getIdFromParams } from "../_utils.js";

export async function onRequestGet({ params, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const id = getIdFromParams(params, "id");
    if (!id) return badRequest("invalid id");

    const n = await env.DB.prepare(
      `SELECT id, title, summary, status, is_adult, updated_at, published_at
       FROM novels
       WHERE id = ? AND status = 'published'
       LIMIT 1`
    ).bind(id).first();

    if (!n) return badRequest("not found", 404);
    return json(n);
  });
}
