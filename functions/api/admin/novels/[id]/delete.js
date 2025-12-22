import { json, badRequest, getIdFromParams, safe, requireDb, ensureSchema, requireAdmin, logAudit } from "../../../_utils.js";

export async function onRequestPost({ request, params, env }) {
  return safe(async () => {
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const a = requireAdmin(request, env);
    if (!a.ok) return a.res;

    const id = getIdFromParams(params, "id");
    if (!id) return badRequest("invalid id");

    const found = await env.DB.prepare(`SELECT id, title FROM novels WHERE id = ? LIMIT 1`).bind(id).first();
    if (!found) return badRequest("not found", 404);

    await env.DB.prepare(`DELETE FROM novels WHERE id = ?`).bind(id).run();
    await logAudit(env, "admin_novel_delete", "novel", id, { title: found.title });
    return json({ ok: true });
  });
}
