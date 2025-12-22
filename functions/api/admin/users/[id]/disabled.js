import { json, badRequest, readJson, getIdFromParams, getNowMs, safe, requireDb, ensureSchema, requireAdmin, logAudit } from "../../../_utils.js";

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

    const is_disabled = body.is_disabled ? 1 : 0;

    const u = await env.DB.prepare(`SELECT id, name, is_disabled FROM users WHERE id = ? LIMIT 1`).bind(id).first();
    if (!u) return badRequest("not found", 404);

    await env.DB.prepare(`UPDATE users SET is_disabled = ? WHERE id = ?`).bind(is_disabled, id).run();

    // B: disable => hide all their novels
    if (is_disabled) {
      const now = getNowMs();
      await env.DB.prepare(
        `UPDATE novels SET status = 'hidden', published_at = NULL, updated_at = ?
         WHERE author_id = ?`
      ).bind(now, id).run();
    }

    await logAudit(env, "admin_user_disabled", "user", id, { name: u.name, is_disabled: !!is_disabled });
    return json({ ok: true });
  });
}
