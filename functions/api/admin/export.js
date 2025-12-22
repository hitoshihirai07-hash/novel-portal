import { safe, requireDb, ensureSchema, requireAdmin, badRequest } from "../_utils.js";

function asJsonDownload(obj, filename = "export.json") {
  const body = JSON.stringify(obj);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${filename}"`
    }
  });
}

export async function onRequestGet({ request, env }) {
  return safe(async () => {
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const a = requireAdmin(request, env);
    if (!a.ok) return a.res;

    const url = new URL(request.url);
    const type = (url.searchParams.get("type") || "all").trim(); // all|novels|users|audit
    const withContent = (url.searchParams.get("content") || "") === "1";

    const now = Date.now();

    if (type === "users") {
      const users = await env.DB.prepare(`SELECT id, name, is_disabled, created_at FROM users ORDER BY id`).all();
      return asJsonDownload({ generated_at: now, users: users.results || [] }, `users-${now}.json`);
    }

    if (type === "audit") {
      const audit = await env.DB.prepare(`SELECT id, ts, actor, action, target_type, target_id, meta FROM audit_logs ORDER BY ts DESC LIMIT 5000`).all();
      return asJsonDownload({ generated_at: now, audit: audit.results || [] }, `audit-${now}.json`);
    }

    if (type === "novels") {
      const novels = await env.DB.prepare(`
        SELECT n.id, n.author_id, u.name AS author_name, n.title, n.summary, n.status, n.is_adult, n.created_at, n.updated_at, n.published_at
        FROM novels n JOIN users u ON u.id = n.author_id
        ORDER BY n.id
      `).all();
      let chapters = { results: [] };
      if (withContent) {
        chapters = await env.DB.prepare(`SELECT id, novel_id, number, title, content, created_at, updated_at FROM chapters ORDER BY novel_id, number`).all();
      } else {
        chapters = await env.DB.prepare(`SELECT id, novel_id, number, title, created_at, updated_at FROM chapters ORDER BY novel_id, number`).all();
      }
      return asJsonDownload({ generated_at: now, novels: novels.results || [], chapters: chapters.results || [] }, `novels-${now}.json`);
    }

    if (type !== "all") return badRequest("invalid type");

    const users = await env.DB.prepare(`SELECT id, name, is_disabled, created_at FROM users ORDER BY id`).all();
    const novels = await env.DB.prepare(`
      SELECT n.id, n.author_id, u.name AS author_name, n.title, n.summary, n.status, n.is_adult, n.created_at, n.updated_at, n.published_at
      FROM novels n JOIN users u ON u.id = n.author_id
      ORDER BY n.id
    `).all();
    const chapters = withContent
      ? await env.DB.prepare(`SELECT id, novel_id, number, title, content, created_at, updated_at FROM chapters ORDER BY novel_id, number`).all()
      : await env.DB.prepare(`SELECT id, novel_id, number, title, created_at, updated_at FROM chapters ORDER BY novel_id, number`).all();
    const audit = await env.DB.prepare(`SELECT id, ts, actor, action, target_type, target_id, meta FROM audit_logs ORDER BY ts DESC LIMIT 5000`).all();

    return asJsonDownload({
      generated_at: now,
      users: users.results || [],
      novels: novels.results || [],
      chapters: chapters.results || [],
      audit: audit.results || []
    }, `export-${now}.json`);
  });
}
