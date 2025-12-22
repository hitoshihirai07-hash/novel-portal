import { json, badRequest, safe, requireDb, ensureSchema, getIdFromParams } from "../_utils.js";

function parseLinks(t){
  if (!t) return [];
  try{
    const arr = JSON.parse(t);
    if (Array.isArray(arr)) return arr.filter(x=>typeof x==="string");
  }catch(_){}
  return [];
}

export async function onRequestGet({ params, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const id = getIdFromParams(params, "id");
    if (!id) return badRequest("invalid id");

    const u = await env.DB.prepare(`SELECT id, name, bio, links FROM users WHERE id = ? AND is_disabled = 0 LIMIT 1`).bind(id).first();
    if (!u) return badRequest("not found", 404);

    const rows = await env.DB.prepare(
      `SELECT n.id, n.title, n.summary, n.is_adult, n.updated_at, n.published_at
       FROM novels n
       WHERE n.author_id = ? AND n.status='published'
       ORDER BY COALESCE(n.published_at, n.updated_at) DESC`
    ).bind(u.id).all();

    return json({
      ok:true,
      user: { id: u.id, name: u.name, bio: u.bio || "", links: parseLinks(u.links) },
      items: rows.results || []
    });
  });
}
