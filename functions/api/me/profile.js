import { json, badRequest, safe, requireDb, ensureSchema, readJson, clampStr, requireEdit } from "../_utils.js";

function normalizeLinks(links){
  if (!Array.isArray(links)) return [];
  const out = [];
  for (const raw of links){
    if (typeof raw !== "string") continue;
    const s = raw.trim();
    if (!s) continue;
    if (s.length > 200) continue;
    // allow http/https only
    if (!/^https?:\/\//i.test(s)) continue;
    out.push(s);
    if (out.length >= 5) break;
  }
  return out;
}

export async function onRequestGet({ request, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const auth = await requireEdit(request, env);
    if (!auth.ok) return auth.res;

    const u = await env.DB.prepare(`SELECT id, name, bio, links FROM users WHERE id = ? LIMIT 1`).bind(auth.user.id).first();
    return json({
      ok:true,
      user: {
        id: u.id,
        name: u.name,
        bio: u.bio || "",
        links: (()=>{ try{ const a=JSON.parse(u.links||"[]"); return Array.isArray(a)?a:[]; }catch(_){ return []; } })()
      }
    });
  });
}

export async function onRequestPost({ request, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const auth = await requireEdit(request, env);
    if (!auth.ok) return auth.res;

    const body = await readJson(request);
    if (!body) return badRequest("invalid json");

    const bio = clampStr(String(body.bio || "").trim(), 1000);
    const links = normalizeLinks(body.links || []);

    await env.DB.prepare(`UPDATE users SET bio = ?, links = ? WHERE id = ?`).bind(bio, JSON.stringify(links), auth.user.id).run();
    return json({ ok:true });
  });
}
