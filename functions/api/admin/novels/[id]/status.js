import { json, badRequest, readJson, getIdFromParams, getNowMs, safe, requireDb, ensureSchema, requireAdmin, logAudit } from "../../../_utils.js";

const ALLOWED = new Set(["draft", "published", "hidden"]);

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

    const status = String(body.status || "").trim();
    if (!ALLOWED.has(status)) return badRequest("invalid status");

    const now = getNowMs();

    // Keep published_at the first time it becomes published.
    await env.DB.prepare(
      `UPDATE novels
       SET status = ?, updated_at = ?,
           published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END
       WHERE id = ?`
    ).bind(status, now, status, now, id).run();

    await logAudit(env, "admin_novel_status", "novel", id, { status });
    return json({ ok: true });
  });
}
