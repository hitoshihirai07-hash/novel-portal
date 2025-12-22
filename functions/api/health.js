import { json, safe, requireDb, ensureSchema } from "./_utils.js";
export async function onRequestGet({ env }) {
  return safe(async ()=>{
    const d = requireDb(env);
    if (!d.ok) return d.res;
    await ensureSchema(env);
    return json({ ok:true, db:true });
  });
}
