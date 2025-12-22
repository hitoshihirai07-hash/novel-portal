import { json, badRequest, readJson, getIdFromParams, getNowMs, safe, requireDb, ensureSchema, requireEdit } from "../../_utils.js";

export async function onRequestPost({ request, params, env }) {
  return safe(async () => {
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

    const is_adult = body.is_adult ? 1 : 0;
    const now = getNowMs();
    await env.DB.prepare(`UPDATE novels SET is_adult = ?, updated_at = ? WHERE id = ?`).bind(is_adult, now, id).run();
    return json({ ok: true });
  });
}
