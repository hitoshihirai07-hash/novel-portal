// Novel Portal frontend helpers (no popups)
export function qs(sel, el = document){ return el.querySelector(sel); }

const API = {
  async request(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
    const ct = (res.headers.get("content-type") || "");
    const isJson = ct.includes("application/json");
    const body = isJson ? await res.json().catch(()=>null) : await res.text();
    if (!res.ok) {
      const msg = body?.error ? body.error : (typeof body === "string" ? body : `HTTP ${res.status}`);
      throw new Error(msg);
    }
    return body;
  },
};

export function fmtDate(ts){
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString();
}
export function escapeHtml(s){
  return (s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
export function setBusy(btn, busy=true, label="処理中…"){
  if (!btn) return;
  btn.disabled = busy;
  btn.dataset._orig = btn.dataset._orig || btn.textContent;
  btn.textContent = busy ? label : btn.dataset._orig;
}
export function showMsg(id, msg, isError=false){
  const el = qs(id);
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("err", !!isError);
  el.style.display = msg ? "block" : "none";
}

// keys (stored locally)
export function getEditKey(){ return localStorage.getItem("np_edit_key") || ""; }
export function setEditKey(t){ t ? localStorage.setItem("np_edit_key", t) : localStorage.removeItem("np_edit_key"); }
export function getAdminKey(){ return localStorage.getItem("np_admin_key") || ""; }
export function setAdminKey(t){ t ? localStorage.setItem("np_admin_key", t) : localStorage.removeItem("np_admin_key"); }

export function editHeaders(extra = {}){
  const h = { ...extra };
  const t = getEditKey();
  if (t) h["X-Edit-Key"] = t;
  return h;
}
export function adminHeaders(extra = {}){
  const h = { ...extra };
  const t = getAdminKey();
  if (t) h["X-Admin-Key"] = t;
  return h;
}

export async function apiGet(url, headers = {}){ return API.request(url, { method:"GET", headers }); }
export async function apiPost(url, data, headers = {}){ return API.request(url, { method:"POST", body: JSON.stringify(data||{}), headers }); }
export async function apiPut(url, data, headers = {}){ return API.request(url, { method:"PUT", body: JSON.stringify(data||{}), headers }); }
