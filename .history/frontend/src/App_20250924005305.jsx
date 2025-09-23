
import React, { useEffect, useMemo, useState } from "react";

/* ===== Utilities ===== */
const cx = (...a) => a.filter(Boolean).join(" ");
const API = import.meta.env.VITE_API_URL || "/api";

/* ===== Icons ===== */
const ICON = {
  calendar: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M7 2v2m10-2v2M3 9h18" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      <rect x="3" y="5" width="18" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="1.6" fill="none"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M17 21v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M20 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" stroke="currentColor" strokeWidth="1.6" fill="none"/>
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth="1.6" fill="none"/>
      <path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      <path d="M15 12H3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" fill="none"/>
      <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07 7.07-1.41-1.41M6.34 6.34 4.93 4.93m12.73 0-1.41 1.41M6.34 17.66l-1.41 1.41" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.6" fill="none"/>
    </svg>
  ),
};

/* ===== Fetch wrapper ===== */
function apiFetch(path, opts = {}){
  const token = localStorage.getItem("token");
  const headers = { ...(opts.headers || {}) };
  const isForm = opts.body instanceof FormData;
  if (!isForm && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return fetch(`${API}${path}`, {
    ...opts,
    headers
  }).then(async (r) => {
    if (r.status === 401 || r.status === 403) {
      try { const err = await r.json(); console.warn(err?.detail || "Auth error"); } catch {}
      localStorage.clear();
      location.reload();
      throw new Error("Signed out");
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.status === 204 ? null : r.json();
  });
}

/* ===== Date helpers ===== */
function useMonth(year, month){
  return useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const days = [];
    const last = new Date(year, month, 0).getDate();
    for (let d = 1; d <= last; d++) days.push(new Date(year, month - 1, d));
    return { first, days, last };
  }, [year, month]);
}

/* ====================== Theme Toggle ====================== */
function ThemeToggle(){
  const [mode, setMode] = useState(() => localStorage.getItem("theme") || "light");
  useEffect(()=>{
    document.documentElement.dataset.theme = mode;
    localStorage.setItem("theme", mode);
  },[mode]);
  const toggle = () => setMode(m => m === "light" ? "dark" : "light");
  return (
    <button className="btn btn-ghost btn-icon" onClick={toggle} title="Toggle theme">
      {mode === "light" ? ICON.moon : ICON.sun}
    </button>
  );
}

/* ====================== Auth / Login ====================== */
function Login({ onLogin }){
  const [email, setEmail] = useState("admin@farm.local");
  const [password, setPassword] = useState("Admin@123");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {type:'ok'|'err', text}
  const [shake, setShake] = useState(false);

  const showErr = (text) => { setMsg({ type: "err", text }); setShake(true); setTimeout(()=>setShake(false), 450); };

  const submit = async (e) => {
    e.preventDefault(); if (busy) return; setBusy(true); setMsg(null);
    try {
      const body = new URLSearchParams({ username: email, password });
      const res = await fetch(`${API}/auth/login`, { method:"POST", body });
      if (!res.ok){
        let detail = "Sign in failed.";
        try{ const j = await res.json(); if(j?.detail) detail = j.detail; }catch{}
        if(res.status === 401) detail = "Incorrect email/username or password.";
        if(res.status === 403) detail = "Your account is disabled. Please contact the admin.";
        showErr(detail); setBusy(false); return;
      }
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("email", data.email);
      apiFetch("/me").then(me => {
        localStorage.setItem("username", me.username);
        onLogin({ role: data.role });
      }).catch(() => {
        // fallback if /me fails
        localStorage.setItem("username", data.email?.split("@")?.[0] || "user");
        onLogin({ role: data.role });
      });
      setMsg({ type: "ok", text: "Signed in successfully. Redirecting…" });
      setTimeout(() => onLogin({ role: data.role }), 800);
    } catch {
      showErr("Network error. Please try again."); setBusy(false);
    }
  };

  return (
    <div className="auth">
      {/* Decorative background */}
      <div className="fx fx--grid" aria-hidden />
      <div className="fx fx--aurora" aria-hidden />
      <div className="auth__bg" />
      <div className="auth__blob auth__blob--one" />
      <div className="auth__blob auth__blob--two" />

      {msg && (
        <div className={cx("toast", msg.type === "ok" ? "toast--ok" : "toast--err")}>{msg.text}</div>
      )}

      <div className={cx("login-card glow", shake && "login-card--shake")}>
        <div className="brand-row">
          <div className="brand-mark">
            <span className="brand-dot" />
            <span className="brand-dot brand-dot--2" />
          </div>
          <h1 className="login-title">Farmhouse Booking</h1>
        </div>
        <p className="login-sub">Plan, manage, and confirm farmhouse availability with ease.</p>

        <form onSubmit={submit} className="space-y-3">
          <input className="input input--fancy" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email or Username" autoComplete="username"/>
          <input className="input input--fancy" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" autoComplete="current-password"/>
          <button className={cx("btn-gradient login-btn", busy && "is-loading")} disabled={busy} aria-busy={busy}>
            {busy ? <span className="dots" aria-hidden /> : <span className="btn-sheen">Sign in</span>}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ====================== Calendar ====================== */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function Calendar({ fid, year, month, editable }){
  const { days } = useMonth(year, month);
  const role = typeof window !== "undefined" ? localStorage.getItem("role") : "owner";
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [map, setMap] = useState({}); // key: YYYY-MM-DD -> {is_booked, admin_booked, note}
  const [pending, setPending] = useState(null); // {key, date, next}
  const [filter, setFilter] = useState(null);
  const toggleFilter = (t) => setFilter(f => (f === t ? null : t));

  useEffect(() => {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
    setLoading(true);
    apiFetch(`/farmhouses/${fid}/status?start=${start}&end=${end}`)
      .then((rows) => {
        const m = {}; rows.forEach(r => { m[r.day] = r; }); setMap(m);
      })
      .finally(()=>setLoading(false));
  }, [fid, year, month]);

  const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const todayStr = ymdLocal(new Date());

  const toggleDay = (d) => {
    if (!editable) return;
    const key = ymdLocal(d);
    if (key < todayStr) return;
    const rec = map[key];
    // Owners cannot change admin-booked dates
    if (role === "owner" && rec?.admin_booked) return;
    const prev = rec?.is_booked || false;
    setPending({ key, date:d, next:!prev });
    };

  const confirmChange = async () => {
    if (!pending) return; setBusy(true);
    try {
      const changes = [{ day: pending.key, is_booked: pending.next }];
      await apiFetch(`/farmhouses/${fid}/status`, { method:"PUT", body: JSON.stringify(changes) });
      setMap(m => ({
        ...m,
        [pending.key]: {
        ...(m[pending.key] || {}),
        day: pending.key,
        is_booked: pending.next,
        admin_booked: role === "admin" ? pending.next : false
        }
        }));
      setPending(null);
    } finally { setBusy(false); }
  };
  const cancelChange = () => setPending(null);

  const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const pad = days[0].getDay();

  return (
    <div className="cal" data-filter={filter || undefined}>
      <div className="cal__legend">
        <button
            type="button"
            aria-pressed={filter === "avail"}
            className={cx("chip chip--btn chip--avail", filter === "avail" && "is-active")}
            onClick={() => toggleFilter("avail")}
            >
            Available
        </button>

        <button
            type="button"
            aria-pressed={filter === "booked"}
            className={cx("chip chip--btn chip--booked", filter === "booked" && "is-active")}
            onClick={() => toggleFilter("booked")}
            >
            Booked
        </button>
        <button
            type="button"
            aria-pressed={filter === "admin"}
            className={cx("chip chip--btn chip--admin", filter === "admin" && "is-active")}
            onClick={() => toggleFilter("admin")}
            >
            Admin booked
        </button>

        {/* Removed Today button */}
      </div>


      {(busy || loading) && (
        <div className="cal__saving">
          {busy ? "Saving…" : "Loading…"}
        </div>
      )}

      <div className="cal__weekday">{weekdays.map(w => <div key={w} className="wk">{w}</div>)}</div>

      <div className={cx("cal__grid", loading && "grid--loading")}>
        {Array.from({ length: pad }).map((_, i) => <div key={`pad${i}`} />)}
        {days.map((d, idx) => {
          const key = ymdLocal(d);
          const rec = map[key] || {};
          const adminBooked = !!rec.admin_booked;
          const booked = !!rec.is_booked;
          const isToday = key === todayStr;
          const isPast = key < todayStr;

          if (loading) {
            return <div key={`skeleton-${idx}`} className="day skeleton skeleton--tile" aria-hidden />;
          }

          return (
            <button
              key={key}
              onClick={() => toggleDay(d)}
              disabled={!editable || isPast || (role === "owner" && adminBooked)}
              className={cx(
                "day",
                adminBooked ? "day--admin" : (booked ? "day--booked" : "day--avail"),
                isToday && "day--today",
                (!editable || isPast) && "day--disabled",
                "glow-sm"
              )}
              title={adminBooked ? "Admin booked" : (booked ? "Booked" : "Available")}
            >
              <div className="day__top">
                <div className="day__date">{d.getDate()}</div>
                {adminBooked ? <span className="dot dot--admin" /> : (booked ? <span className="dot dot--booked" /> : <span className="dot dot--avail" />)}
              </div>
              <div className="day__status">{adminBooked ? "Admin booked" : (booked ? "Booked" : "Available")}</div>
            </button>
          );
        })}
      </div>

      {pending && (
        <div className="modal" onClick={cancelChange}>
          <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
            <h2 className="text-xl font-bold" style={{marginTop:0}}>Confirm change</h2>
            <p style={{marginTop:8, marginBottom:16}}>
              Set <b>{pending.date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", year:"numeric", month:"short", day:"numeric" })}</b> to <b>{pending.next ? "Booked" : "Available"}</b>?
            </p>
            <div style={{display:"flex", gap:8, justifyContent:"flex-end"}}>
              <button className="btn" onClick={cancelChange}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmChange}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====================== Media (owners upload, admins view) ====================== */
function MediaGrid({ items, onDelete }){
    if (!items?.length) return <div className="empty glow-sm">No media yet.</div>;
    return (
      <div className="gallery">
        {items.map(m => (
          <div key={m.id} className="thumb">
            {m.kind === "image" ? (
              <img src={API + m.url} alt="" loading="lazy" />
            ) : (
              <video src={API + m.url} controls preload="metadata" />
            )}
            {onDelete && (
              <button className="del" title="Delete" onClick={() => onDelete(m)}>🗑</button>
            )}
          </div>
        ))}
      </div>
    );
  }
  
  function OwnerMediaPanel({ fid }){
    const [items, setItems] = useState([]);
    const [busy, setBusy] = useState(false);
  
    const load = () => apiFetch(`/farmhouses/${fid}/media`).then(setItems).catch(()=>setItems([]));
    useEffect(() => { if (fid) load(); }, [fid]);
  
    // keep these in sync with backend defaults/env
    const MAX_IMAGE_MB = 10, MAX_VIDEO_MB = 100;
  
    const onUpload = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
  
      // quick client pre-check (server still enforces)
      const tooBig = files.find(f => (f.type.startsWith("image/") && f.size > MAX_IMAGE_MB*1024*1024) ||
                                     (f.type.startsWith("video/") && f.size > MAX_VIDEO_MB*1024*1024));
      if (tooBig){
        alert(`File too large. Images ≤ ${MAX_IMAGE_MB}MB, videos ≤ ${MAX_VIDEO_MB}MB.`);
        e.target.value = ""; return;
      }
  
      const fd = new FormData();
      files.forEach(f => fd.append("files", f));
      setBusy(true);
      try { await apiFetch(`/farmhouses/${fid}/media`, { method: "POST", body: fd }); await load(); }
      finally { setBusy(false); e.target.value = ""; }
    };

    const onDelete = async (m) => {
      if (!confirm("Delete this media?")) return;
      await apiFetch(`/farmhouses/${fid}/media/${m.id}`, { method:"DELETE" });
      await load();
    };
  
    return (
      <div className="card glow" style={{marginTop:16}}>
        <div className="hstack" style={{justifyContent:"space-between"}}>
          <h3 className="text-xl font-bold" style={{margin:0}}>Photos &amp; Videos</h3>
          <label className="btn btn-primary">
            Upload
            <input type="file" accept="image/*,video/*" multiple style={{display:"none"}} onChange={onUpload}/>
          </label>
        </div>
        <div className="muted" style={{marginTop:6}}>Max image {MAX_IMAGE_MB}MB · Max video {MAX_VIDEO_MB}MB</div>
        {busy && <div className="muted" style={{marginTop:8}}>Uploading…</div>}
        <div style={{marginTop:12}}><MediaGrid items={items} onDelete={onDelete} /></div>
      </div>
    );
  }
  

  function MediaViewer({ fid }){
    const [items, setItems] = useState([]);
    useEffect(() => { if (fid) apiFetch(`/farmhouses/${fid}/media`).then(setItems).catch(()=>setItems([])); }, [fid]);
    return (
      <div className="card glow" style={{marginTop:16}}>
        <h3 className="text-xl font-bold" style={{marginTop:0}}>Photos &amp; Videos</h3>
        <div style={{marginTop:12}}>
          <MediaGrid items={items} />
        </div>
      </div>
    );
  }
  

/* ====================== Admin: Owners (pagination + edit) ====================== */
function AdminOwnersPage(){
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [editFor, setEditFor] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
// Max sizes (keep in sync with backend env)
  const MAX_IMAGE_MB = 10, MAX_VIDEO_MB = 100;

  const uploadOwnerMedia = async (fid, evt) => {
    const files = Array.from(evt.target.files || []);
    if (!files.length) return;

    const tooBig = files.find(f =>
        (f.type.startsWith("image/") && f.size > MAX_IMAGE_MB * 1024 * 1024) ||
        (f.type.startsWith("video/") && f.size > MAX_VIDEO_MB * 1024 * 1024)
    );
    if (tooBig){
        alert(`File too large. Images ≤ ${MAX_IMAGE_MB}MB, videos ≤ ${MAX_VIDEO_MB}MB.`);
        evt.target.value = ""; return;
    }

    const fd = new FormData();
    files.forEach(f => fd.append("files", f));

    setBusy(true);
    try{
        await apiFetch(`/farmhouses/${fid}/media`, { method: "POST", body: fd });
        evt.target.value = "";
        const items = await apiFetch(`/farmhouses/${fid}/media`).catch(() => []);
        setMediaFor(s => ({ ...s, byFarm: { ...(s?.byFarm||{}), [fid]: items } }));
    } finally {
        setBusy(false);
    }
  };

  const load = async (p = page, ps = pageSize) => {
    const res = await apiFetch(`/admin/owners?page=${p}&page_size=${ps}`);
    setRows(res.items || []); setTotal(res.total || 0); setPage(res.page || 1); setPageSize(res.page_size || ps); setPages(res.pages || 1);
  };
  useEffect(()=>{ load(1, pageSize).catch(()=>{}); }, []);

  const setActive = async (id, active) => { setBusy(true); try{ await apiFetch(`/admin/owners/${id}/set-active`, { method: "POST", body: JSON.stringify({ active }) }); await load(); } finally { setBusy(false); } };

  const openReset = (row) => setResetFor({ id: row.id, username: row.username, pwd: "" });
  const doReset = async () => { if(!resetFor?.pwd) return; setBusy(true); try{ await apiFetch(`/admin/owners/${resetFor.id}/reset-password`, { method: "POST", body: JSON.stringify({ new_password: resetFor.pwd }) }); setResetFor(null);} finally { setBusy(false); } };

  const openEdit = (row) => setEditFor({ id: row.id, username: row.username, email: row.email || "", phone: row.phone || "" });
  const doEdit = async () => {
    if(!editFor) return;
    if (editFor.email && !/^\S+@\S+\.\S+$/.test(editFor.email)) { alert("Enter a valid email address."); return; }
    const digits = (editFor.phone || "").replace(/\D/g, "");
    if (editFor.phone && (digits.length < 7 || digits.length > 15)) { alert("Enter a valid phone number (7–15 digits)."); return; }
    setBusy(true);
    try{
      const body = { ...(editFor.email !== undefined ? { email: editFor.email } : {}), ...(editFor.phone !== undefined ? { phone: editFor.phone } : {}), };
      await apiFetch(`/admin/owners/${editFor.id}/contact`, { method: "PATCH", body: JSON.stringify(body) });
      setEditFor(null); await load(page, pageSize);
    } finally { setBusy(false); }
  };

  const changePageSize = async (e) => { const ps = Number(e.target.value); setPageSize(ps); await load(1, ps); };
  const prev = async () => { if (page > 1) await load(page - 1, pageSize); };
  const next = async () => { if (page < pages) await load(page + 1, pageSize); };

  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end   = total ? start + rows.length - 1 : 0;
  const [mediaFor, setMediaFor] = useState(null); // { ownerId, username, farms: [...], byFarm: { [fid]: items[] } }

  const openManageMedia = (row) => {
    const byFarm = {};
    setMediaFor({ ownerId: row.id, username: row.username, farms: row.farmhouses || [], byFarm });
    // load each farmhouse media
    (row.farmhouses || []).forEach(async (f) => {
      const items = await apiFetch(`/farmhouses/${f.id}/media`).catch(() => []);
      setMediaFor((s) => ({ ...s, byFarm: { ...(s?.byFarm||{}), [f.id]: items } }));
    });
  };
  
  const closeManageMedia = () => setMediaFor(null);
  
  const deleteOwnerMedia = async (fid, mid) => {
    if (!confirm("Delete this media?")) return;
    await apiFetch(`/farmhouses/${fid}/media/${mid}`, { method: "DELETE" });
    const items = await apiFetch(`/farmhouses/${fid}/media`).catch(() => []);
    setMediaFor((s) => ({ ...s, byFarm: { ...(s?.byFarm||{}), [fid]: items } }));
  };
  

  return (
    <div className="shell">
      <div className="card card--lg glow">
        <div className="hstack" style={{justifyContent:"space-between"}}>
          <h2 className="text-xl font-bold" style={{margin:0}}>Owners</h2>
          <div className="text-sm" style={{opacity:.75}}>{busy ? "Working…" : null}</div>
        </div>

        {/* Pager controls */}
        <div className="hstack" style={{justifyContent:"space-between", marginTop:12}}>
          <div className="hstack" style={{gap:8}}>
            <span className="text-sm" style={{opacity:.75}}>Show</span>
            <select className="select" value={pageSize} onChange={changePageSize} style={{width:90}}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm" style={{opacity:.75}}>per page</span>
            <span className="text-sm" style={{opacity:.65, marginLeft:10}}>{total ? `${start}–${end} of ${total}` : "0"}</span>
          </div>
          <div className="hstack" style={{gap:8}}>
            <button className="btn" onClick={prev} disabled={page <= 1}>‹ Prev</button>
            <span className="text-sm" style={{opacity:.75}}>Page {page} of {pages}</span>
            <button className="btn" onClick={next} disabled={page >= pages}>Next ›</button>
          </div>
        </div>

        <div style={{marginTop:12, overflow:"hidden", borderRadius:14, border:"1px solid var(--border)"}}>
          <table className="table">
            <thead>
              <tr>
                <th>Owner ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Active</th>
                <th>Farmhouses</th>
                <th style={{width:300}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r)=> (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.username}</td>
                  <td>{r.email || "—"}</td>
                  <td>{r.phone || "—"}</td>
                  <td>
                    <span className={cx("pill", r.is_active ? "pill--ok" : "pill--bad")}>
                      {r.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td>{r.farmhouses?.length ? r.farmhouses.map(f=>`${f.name}${f.size?` (${f.size})`:''}${f.location?` @ ${f.location}`:''}`).join(", ") : "—"}</td>
                  <td>
                    <div className="actions">
                      <button className="btn" onClick={()=>setActive(r.id, !r.is_active)}>{r.is_active ? "Disable" : "Enable"}</button>
                      <button className="btn" onClick={()=>openEdit(r)}>Edit contact</button>
                      <button className="btn btn-primary" onClick={()=>openReset(r)}>Reset Password</button>
                      <button className="btn btn-danger" onClick={()=>openManageMedia(r)}>Manage media</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (<tr><td colSpan={7} style={{textAlign:"center", padding:"1rem"}}>No owners found.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset password modal */}
      {resetFor && (
        <div className="modal" onClick={()=>setResetFor(null)}>
          <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-xl font-bold" style={{marginTop:0}}>Reset password — {resetFor.username}</h3>
            <input className="input" type="password" placeholder="New password" value={resetFor.pwd} onChange={e=>setResetFor(s=>({...s, pwd:e.target.value}))}/>
            <div className="hstack" style={{justifyContent:"flex-end", marginTop:12}}>
              <button className="btn" onClick={()=>setResetFor(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doReset}>Save</button>
            </div>
          </div>
        </div>
      )}
      {mediaFor && (
        <div className="modal" onClick={closeManageMedia}>
            <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-xl font-bold" style={{marginTop:0}}>
                Media — {mediaFor.username}
            </h3>

            {(!mediaFor.farms || mediaFor.farms.length === 0) ? (
                <div className="empty glow-sm" style={{marginTop:8}}>No farmhouses for this owner.</div>
            ) : (
                <div className="space-y-4" style={{marginTop:8}}>
                {mediaFor.farms.map(f => (
                    <div key={f.id} className="card glow">
                    <div className="hstack" style={{justifyContent:"space-between"}}>
                        <div><b>{f.name}</b>{f.size ? ` (${f.size})` : ""}{f.location ? ` @ ${f.location}` : ""}</div>
                        <label className="btn btn-primary">
                        Upload
                        <input type="file" accept="image/*,video/*" multiple style={{display:"none"}}
                                onChange={(e)=>uploadOwnerMedia(f.id, e)} />
                        </label>
                    </div>
                    <div className="muted" style={{marginTop:6}}>Max image {MAX_IMAGE_MB}MB · Max video {MAX_VIDEO_MB}MB</div>
                    <div style={{marginTop:10}}>
                        <MediaGrid
                        items={mediaFor.byFarm?.[f.id] || []}
                        onDelete={(m)=>deleteOwnerMedia(f.id, m.id)}
                        />
                    </div>
                    </div>
                ))}
                </div>
            )}

            <div className="hstack" style={{justifyContent:"flex-end", marginTop:12}}>
                <button className="btn" onClick={closeManageMedia}>Close</button>
            </div>
            </div>
        </div>
      )}

      {/* Edit contact modal */}
      {editFor && (
        <div className="modal" onClick={()=>setEditFor(null)}>
          <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-xl font-bold" style={{marginTop:0}}>Edit contact — {editFor.username}</h3>
            <div className="space-y-3">
              <input className="input" type="email" placeholder="Email" value={editFor.email} onChange={e=>setEditFor(s=>({...s, email:e.target.value}))}/>
              <input className="input" placeholder="+91 98765 43210" value={editFor.phone} onChange={e=>setEditFor(s=>({...s, phone:e.target.value}))}/>
            </div>
            <div className="hstack" style={{justifyContent:"flex-end", marginTop:12}}>
              <button className="btn" onClick={()=>setEditFor(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====================== Admin: Create Owner ====================== */
function AdminCreateOwnerPage(){
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [farmhouseName, setFarmhouseName] = useState("");
  const [size, setSize] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault(); setMsg(null);
    const sizeNum = Number(size);
    if(!username || !password || !farmhouseName || !email || !location || !size || !phone){
      setMsg({type:"err", text:"Please fill all required fields (Username, Email, Phone, Password, Farmhouse name, Size, Location)."}); return;
    }
    if(!/^\S+@\S+\.\S+$/.test(email)){ setMsg({type:"err", text:"Enter a valid email address."}); return; }
    if(!Number.isFinite(sizeNum) || sizeNum <= 0){ setMsg({type:"err", text:"Size must be a positive number."}); return; }

    setBusy(true);
    try{
      const body = { username, password, farmhouse_name: farmhouseName, email, size: sizeNum, location, phone };
      const fh = await apiFetch(`/admin/owners/create`, { method:"POST", body: JSON.stringify(body) });
      setMsg({type:"ok", text:`Created owner "${username}" and farmhouse "${fh.name}" (id ${fh.id}).`});
      setUsername(""); setPassword(""); setFarmhouseName(""); setSize(""); setLocation(""); setEmail(""); setPhone("");
    } catch(e){ setMsg({type:"err", text:e.message || "Failed to create owner."}); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Create Owner &amp; Farmhouse</h1>
      <form onSubmit={submit} className="space-y-3 card glow">
        <div className="flex" style={{gap:8, flexWrap:"wrap"}}>
          <label style={{flexBasis:"100%"}}><b>Username *</b></label>
          <input className="border p-2 input" required placeholder="e.g. owner1" value={username} onChange={e=>setUsername(e.target.value)} style={{flex:"1 1 320px"}}/>

          <label style={{flexBasis:"100%"}}><b>Email *</b></label>
          <input className="border p-2 input" required type="email" placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)} style={{flex:"1 1 420px"}}/>

          <label style={{flexBasis:"100%"}}><b>Phone *</b></label>
          <input className="border p-2 input" required placeholder="+91 98765 43210" value={phone} onChange={e=>setPhone(e.target.value)} style={{flex:"1 1 320px"}}/>

          <label style={{flexBasis:"100%"}}><b>Password *</b></label>
          <input className="border p-2 input" required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={{flex:"1 1 320px"}}/>

          <label style={{flexBasis:"100%"}}><b>Farmhouse name *</b></label>
          <input className="border p-2 input" required placeholder="Farmhouse name" value={farmhouseName} onChange={e=>setFarmhouseName(e.target.value)} style={{flex:"1 1 420px"}}/>

          <label style={{flexBasis:"100%"}}><b>Size *</b></label>
          <input className="border p-2 input" required type="number" min={1} placeholder="e.g. 10" value={size} onChange={e=>setSize(e.target.value)} style={{flex:"1 1 200px"}}/>

          <label style={{flexBasis:"100%"}}><b>Location *</b></label>
          <input className="border p-2 input" required placeholder="City / Area" value={location} onChange={e=>setLocation(e.target.value)} style={{flex:"2 1 420px"}}/>

          <button className="btn btn-primary" disabled={busy} style={{minWidth:140, marginTop:8}}>{busy? "Creating…" : "Create"}</button>
        </div>

        {msg && (
          <div className="notice" data-type={msg.type}>
            {msg.text}
          </div>
        )}
      </form>
    </div>
  );
}

/* ====================== Owner: Calendar ====================== */
function OwnerPage(){
  const [farms, setFarms] = useState([]);
  const [sel, setSel] = useState(null);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  useEffect(()=>{ apiFetch("/me/farmhouses").then(setFarms); }, []);
  useEffect(()=>{ if(farms.length) setSel(farms[0].id); }, [farms]);

  // current farm
  const currentFarm = useMemo(
    () => (farms && farms.length ? (farms.find(f => f.id === sel) ?? farms[0]) : null),
    [farms, sel]
  );
  useEffect(() => {
    if (!sel && currentFarm) setSel(currentFarm.id);
  }, [currentFarm, sel, setSel]);

  return (
    <div className="shell">
      <div className="page-head">
        <h1 className="text-xl font-bold">
          {(currentFarm ? `${currentFarm.name} Calendar` : "My Farmhouse Calendar").toUpperCase()}
        </h1>
        <p className="muted">Quickly toggle availability for your property.</p>
      </div>

      <div className="hstack">
        {/* removed farmhouse <select /> */}
        <input
          className="input"
          style={{ width: 120 }}
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
        <select
          className="select"
          style={{ width: 160 }}
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        {currentFarm ? (
          <>
            <Calendar fid={currentFarm.id} year={year} month={month} editable={true} />
            <OwnerMediaPanel fid={currentFarm.id} />
          </>
        ) : (
          <div className="chip">No farmhouses found.</div>
        )}
      </div>
    </div>
  );
}

/* ====================== Admin: Calendar + Filters ====================== */
function AdminPage(){
  const [tab, setTab] = useState("calendar");
  const [farms, setFarms] = useState([]);
  const [sel, setSel] = useState(null);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  // Filters
  const [loc, setLoc] = useState("");
  const [sizeMin, setSizeMin] = useState("");
  const [sizeMax, setSizeMax] = useState("");
  const [availDate, setAvailDate] = useState("");
  const [availSet, setAvailSet] = useState(null);

  useEffect(() => { apiFetch("/me/farmhouses").then(setFarms); }, []);
  const locations = useMemo(() => { const s = new Set(); farms.forEach(f => { if (f.location) s.add(f.location); }); return Array.from(s).sort((a,b)=>a.localeCompare(b)); }, [farms]);

  useEffect(() => { if (!availDate) { setAvailSet(null); return; } apiFetch(`/farmhouses/available?date=${availDate}`).then(rows => setAvailSet(new Set(rows.map(r => r.id)))).catch(() => setAvailSet(new Set())); }, [availDate]);

  const filtered = useMemo(() => {
    const base = availSet == null ? farms : farms.filter(f => availSet.has(f.id));
    const min = sizeMin === "" ? -Infinity : Number(sizeMin);
    const max = sizeMax === "" ?  Infinity : Number(sizeMax);
    return base.filter(f => { const sizeVal = Number(f.size ?? 0); const okLoc = !loc || f.location === loc; const okSize = sizeVal >= min && sizeVal <= max; return okLoc && okSize; });
  }, [farms, availSet, loc, sizeMin, sizeMax]);

  useEffect(() => { if (filtered.length === 0) { setSel(null); return; } if (sel == null || !filtered.find(f => f.id === sel)) { setSel(filtered[0].id); } }, [filtered]);

  const clearFilters = () => { setLoc(""); setSizeMin(""); setSizeMax(""); setAvailDate(""); };

  return (
    <div className="with-sidebar">
      <aside className="sidebar glass">
        <div className="sidebar__section">
          <div className="sidebar__title">Admin</div>
          <nav className="sidebar__nav">
            <button className={cx("navlink", tab==="calendar" && "is-active")} onClick={()=>setTab("calendar")}>
              {ICON.calendar} <span>Calendar</span>
            </button>
            <button className={cx("navlink", tab==="owners" && "is-active")} onClick={()=>setTab("owners")}>
              {ICON.users} <span>Owners</span>
            </button>
            <button className={cx("navlink", tab==="create" && "is-active")} onClick={()=>setTab("create")}>
              {ICON.plus} <span>Create Owner</span>
            </button>
          </nav>
        </div>
      </aside>

      <main className="content">
        {tab === "calendar" && (
          <div className="shell" style={{paddingTop:12, paddingBottom:0}}>
            <div className="page-head">
              <h1 className="text-xl font-bold">Farmhouses</h1>
              <p className="muted">Filter by date, location, and size. Then inspect a monthly view.</p>
            </div>

            <div className="filters">
              <div className="filters__row">
                {/* Date */}
                <div className="filters__item">
                  <input className="input input--pill input--icon" type="date" placeholder="dd/mm/yyyy" value={availDate} onChange={(e)=>setAvailDate(e.target.value)} title="Only show farmhouses available on this date" />
                </div>
                {/* Location */}
                <div className="filters__item">
                  <select className="select input--pill input--icon" value={loc} onChange={(e)=>setLoc(e.target.value)} title="Location">
                    <option value="">All locations</option>
                    {locations.map(L => <option key={L} value={L}>{L}</option>)}
                  </select>
                </div>
                {/* Size range */}
                <div className="filters__item filters__range">
                  <input className="input input--pill" type="number" min="0" placeholder="Min size" value={sizeMin} onChange={(e)=>setSizeMin(e.target.value)} />
                  <span className="filters__dash">–</span>
                  <input className="input input--pill" type="number" min="0" placeholder="Max size" value={sizeMax} onChange={(e)=>setSizeMax(e.target.value)} />
                </div>
                <button className="btn btn-ghost" onClick={clearFilters}>Clear filters</button>
                <span className="filters__count">
                  {availDate ? <>Available on <b>{availDate}</b>: {filtered.length} of {farms.length}</> : <>Showing {filtered.length} of {farms.length}</>}
                </span>
              </div>
            </div>

            {/* Calendar controls */}
            <div className="hstack" style={{marginTop:8}}>
              <select className="select" value={sel||""} onChange={(e)=>setSel(Number(e.target.value))}>
                {filtered.map(f => (
                  <option key={f.id} value={f.id}>{f.name}{f.size ? ` (${f.size})` : ""}{f.location ? ` @ ${f.location}` : ""} (owner {f.owner_id})</option>
                ))}
              </select>
              <input className="input" style={{width:120}} type="number" value={year} onChange={e=>setYear(Number(e.target.value))}/>
              <select className="select" style={{width:160}} value={month} onChange={(e)=>setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (<option key={m} value={i+1}>{m}</option>))}
              </select>
            </div>

            <div style={{marginTop:12}}>
              {sel ? (
                <>
                  <Calendar fid={sel} year={year} month={month} editable={true} />
                  <MediaViewer fid={sel} />
                </>
              ) : (
                <div className="empty glow-sm">No farmhouses match the filters.</div>
              )}
            </div>
          </div>
        )}
        {tab === "owners" && <AdminOwnersPage/>}
        {tab === "create" && <AdminCreateOwnerPage/>}
      </main>
    </div>
  );
}

/* ====================== Root App Layout ====================== */
export default function App(){
  const [role, setRole] = useState(localStorage.getItem("role"));
  const logout = () => { localStorage.clear(); setRole(null); };

  const AppHeader = (
    <header className="appbar glass">
      <div className="appbar__inner">
        <div className="brand">Farmhouse Booking</div>
        <div className="space-x-3" style={{display:"flex", alignItems:"center"}}>
          <ThemeToggle />
          {role && (
            <span className="text-sm userchip">
              {localStorage.getItem("username") || localStorage.getItem("email")?.split("@")[0] || "user"} [{role}]
            </span>
          )}
          {role && <button className="btn" onClick={logout}>{ICON.logout} Logout</button>}
        </div>
      </div>
    </header>
  );

  if (!role){
    return (
      <>
        {AppHeader}
        <Login onLogin={({ role }) => setRole(role)} />
      </>
    );
  }

  return (
    <>
      {/* Decorative global FX */}
      <div className="fx fx--grid" aria-hidden />
      <div className="fx fx--aurora" aria-hidden />
      {AppHeader}
      {role === "admin" ? <AdminPage /> : <OwnerPage />}
      <footer className="footer">
        <div className="footer__inner">Made with ♥</div>
      </footer>
    </>
  );
}
    