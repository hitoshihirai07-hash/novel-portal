import { json, badRequest, readJson, getIdFromParams, getNowMs, safe, requireDb, ensureSchema, requireAdmin } from "../../../_utils.js";

export async function onRequestPost({ request, params, env }) {
  return safe(async () => {
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const a = requireAdmin(request, env);
    if (!a.ok) return a.res;

    const id = getIdFromParams(params, "id");
    if (!id) return badRequest("invalid id");

    const body = await readJson(request);
    if (!body) return badRequest("invalid json");

    const is_adult = body.is_adult ? 1 : 0;
    const now = getNowMs();
    await env.DB.prepare(`UPDATE novels SET is_adult = ?, updated_at = ? WHERE id = ?`).bind(is_adult, now, id).run();
    return json({ ok: true });
  });
}
