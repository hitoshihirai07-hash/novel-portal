import { json, badRequest, readJson, getIdFromParams, getNowMs, safe, requireDb, ensureSchema, requireEdit } from "../../_utils.js";
const ALLOWED = new Set(["draft", "published", "hidden"]);

export async function onRequestPost({ request, params, env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const auth = await requireEdit(request, env);
    if (!auth.ok) return auth.res;

    const id = getIdFromParams(params, "id");
    if (!id) return badRequest("invalid id");

    const owns = await env.DB.prepare(`SELECT id FROM novels WHERE id = ? AND author_id = ? LIMIT 1`).bind(id, auth.user.id).first();
    if (!owns) return badRequest("not found", 404);

    const body = await readJson(request);
    if (!body) return badRequest("invalid json");

    const status = String(body.status || "").trim();
    if (!ALLOWED.has(status)) return badRequest("invalid status");

    if (status === "published") {
      const hasCh = await env.DB.prepare(`SELECT 1 FROM chapters WHERE novel_id = ? LIMIT 1`).bind(id).first();
      if (!hasCh) return badRequest("no chapters yet");
    }

    const now = getNowMs();
    await env.DB.prepare(
      `UPDATE novels
       SET status = ?, updated_at = ?,
           published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END
       WHERE id = ?`
    ).bind(status, now, status, now, id).run();

    return json({ ok:true });
  });
}
