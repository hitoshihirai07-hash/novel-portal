import { json, safe, requireDb, ensureSchema, requireAdmin } from "../_utils.js";

function parseAdult(v){
  if (!v) return "all";
  v = String(v).toLowerCase();
  if (v === "1" || v === "on" || v === "true") return "on";
  if (v === "0" || v === "off" || v === "false") return "off";
  return "all";
}

export async function onRequestGet({ request, env }) {
  return safe(async () => {
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);

    const a = requireAdmin(request, env);
    if (!a.ok) return a.res;

    const url = new URL(request.url);

    const q = (url.searchParams.get("q") || "").trim();
    const like = q ? `%${q}%` : null;

    const status = (url.searchParams.get("status") || "all").trim();
    const adult = parseAdult(url.searchParams.get("adult"));
    const inBody = (url.searchParams.get("body") || "") === "1";
    const author = (url.searchParams.get("author") || "").trim();
    const authorLike = author ? `%${author}%` : null;

    const where = [];
    const binds = [];

    if (like) {
      // title/summary always
      let clause = `(n.title LIKE ? OR n.summary LIKE ? OR u.name LIKE ?)`;
      binds.push(like, like, like);

      if (inBody) {
        clause = `(${clause} OR EXISTS (SELECT 1 FROM chapters c WHERE c.novel_id = n.id AND c.content LIKE ?))`;
        binds.push(like);
      }
      where.push(clause);
    }

    if (authorLike && !like) {
      where.push(`u.name LIKE ?`);
      binds.push(authorLike);
    }

    if (status && status !== "all") {
      where.push(`n.status = ?`);
      binds.push(status);
    }

    if (adult === "on") {
      where.push(`n.is_adult = 1`);
    } else if (adult === "off") {
      where.push(`n.is_adult = 0`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT n.id, n.title, n.summary, n.status, n.is_adult, n.updated_at, n.published_at,
             u.id AS author_id, u.name AS author_name,
             (SELECT COUNT(1) FROM chapters c WHERE c.novel_id = n.id) AS chapters_count
      FROM novels n
      JOIN users u ON u.id = n.author_id
      ${whereSql}
      ORDER BY n.updated_at DESC
      LIMIT 500
    `;

    const rows = await env.DB.prepare(sql).bind(...binds).all();
    return json({ ok: true, items: rows.results || [] });
  });
}
