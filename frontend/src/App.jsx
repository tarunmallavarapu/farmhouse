import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "/api";

function apiFetch(path, opts = {}) {
    const token = localStorage.getItem("token");
    return fetch(`${API}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }).then(async (r) => {
      // Auto sign-out on auth failures (covers disabled owners)
      if (r.status === 401 || r.status === 403) {
        try { const err = await r.json(); console.warn(err?.detail || "Auth error"); } catch {}
        localStorage.clear();
        // Hard reload to show the login screen
        location.reload();
        throw new Error("Signed out"); // stop callers
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.status === 204 ? null : r.json();
    });
  }

function useMonth(year, month) {
  return useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const days = [];
    const last = new Date(year, month, 0).getDate();
    for (let d = 1; d <= last; d++) days.push(new Date(year, month - 1, d));
    return { first, days, last };
  }, [year, month]);
}

/* ---------- Auth ---------- */
function Login({ onLogin }) {
    const [email, setEmail] = useState("admin@farm.local");
    const [password, setPassword] = useState("Admin@123");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null); // {type:'ok'|'err', text:string}
    const [shake, setShake] = useState(false);
  
    const showErr = (text) => {
      setMsg({ type: "err", text });
      setShake(true);
      setTimeout(() => setShake(false), 450);
    };
  
    const submit = async (e) => {
      e.preventDefault();
      if (busy) return;
      setBusy(true);
      setMsg(null);
  
      try {
        const body = new URLSearchParams({ username: email, password });
        const res = await fetch(`${API}/auth/login`, { method: "POST", body });
  
        if (!res.ok) {
          let detail = "Sign in failed.";
          try {
            const j = await res.json();
            if (j?.detail) detail = j.detail;
          } catch (_) {}
  
          if (res.status === 401) detail = "Incorrect email/username or password.";
          if (res.status === 403) detail = "Your account is disabled. Please contact the admin.";
          showErr(detail);
          setBusy(false);
          return;
        }
  
        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("email", data.email);
  
        setMsg({ type: "ok", text: "Signed in successfully. Redirecting…" });
  
        // brief pause so the success toast is visible
        setTimeout(() => onLogin({ role: data.role }), 800);
      } catch (err) {
        showErr("Network error. Please try again.");
        setBusy(false);
      }
    };
  
    return (
      <div className="auth">
        {/* animated gradient layers */}
        <div className="auth__bg" />
        <div className="auth__blob auth__blob--one" />
        <div className="auth__blob auth__blob--two" />
  
        {/* floating toast */}
        {msg && (
          <div className={cx("toast", msg.type === "ok" ? "toast--ok" : "toast--err")}>
            {msg.text}
          </div>
        )}
  
        <div className={cx("login-card", shake && "login-card--shake")}>
          <h1 className="login-title">Login</h1>
  
          <form onSubmit={submit} className="space-y-3">
            <input
              className="input input--fancy"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email or Username"
            />
            <input
              className="input input--fancy"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <button className={cx("btn-gradient login-btn", busy && "is-loading")} disabled={busy}>
              {busy ? <span className="dots" aria-hidden /> : <span className="btn-sheen">Sign in</span>}
            </button>
          </form>
        </div>
      </div>
    );
  }
  

const cx = (...a) => a.filter(Boolean).join(" ");

/* ---------- Calendar (confirm-before-save) ---------- */
function Calendar({ fid, year, month, editable }) {
  const { days } = useMonth(year, month);
  const [busy, setBusy] = useState(false);
  const [map, setMap] = useState({});               // key: YYYY-MM-DD -> {is_booked, note}
  const [pending, setPending] = useState(null);     // {key, date, next}

  useEffect(() => {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = `${year}-${String(month).padStart(2, "0")}-${String(
      new Date(year, month, 0).getDate()
    ).padStart(2, "0")}`;
    apiFetch(`/farmhouses/${fid}/status?start=${start}&end=${end}`).then((rows) => {
      const m = {};
      rows.forEach((r) => {
        m[r.day] = r;
      });
      setMap(m);
    });
  }, [fid, year, month]);

  // Build YYYY-MM-DD in local time (avoid UTC shift)
  const ymdLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr = ymdLocal(new Date());

  const toggleDay = (d) => {
    if (!editable) return;
    const key = ymdLocal(d);
    if (key < todayStr) return; // block past
    const prev = map[key]?.is_booked || false;
    setPending({ key, date: d, next: !prev });
  };

  const confirmChange = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const changes = [{ day: pending.key, is_booked: pending.next }];
      await apiFetch(`/farmhouses/${fid}/status`, {
        method: "PUT",
        body: JSON.stringify(changes),
      });
      setMap((m) => ({ ...m, [pending.key]: { day: pending.key, is_booked: pending.next } }));
      setPending(null);
    } finally {
      setBusy(false);
    }
  };
  const cancelChange = () => setPending(null);

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const pad = days[0].getDay();

  return (
    <div className="cal">
      <div className="cal__legend">
        <span className="chip chip--avail">Available (blue)</span>
        <span className="chip chip--booked">Booked (red)</span>
        <span className="chip chip--today">Today (yellow)</span>
        {!editable && <span className="chip">Read-only</span>}
      </div>

      {busy && <div className="cal__saving">Saving…</div>}

      <div className="cal__weekday">
        {weekdays.map((w) => (
          <div key={w} className="wk">{w}</div>
        ))}
      </div>

      <div className="cal__grid">
        {Array.from({ length: pad }).map((_, i) => <div key={`pad${i}`} />)}
        {days.map((d) => {
          const key = ymdLocal(d);
          const booked = map[key]?.is_booked || false;
          const isToday = key === todayStr;
          const isPast = key < todayStr;
          return (
            <button
              key={key}
              onClick={() => toggleDay(d)}
              disabled={!editable || isPast}
              className={cx(
                "day",
                booked ? "day--booked" : "day--avail",
                isToday && "day--today",
                (!editable || isPast) && "day--disabled"
              )}
              title={booked ? "Booked" : "Available"}
            >
              <div className="day__date">{d.getDate()}</div>
              <div className="day__status">{booked ? "Booked" : "Available"}</div>
            </button>
          );
        })}
      </div>

      {pending && (
        <div className="modal" onClick={cancelChange}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold" style={{marginTop:0}}>Confirm change</h2>
            <p style={{marginTop:8, marginBottom:16}}>
              Set <b>{pending.date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", year:"numeric", month:"short", day:"numeric" })}</b>{" "}
              to <b>{pending.next ? "Booked (red)" : "Available (blue)"}</b>?
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

/* ---------- Admin: Owners list (styled) ---------- */
function AdminOwnersPage(){
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState(null); // {id, username, pwd}

  const load = () => apiFetch("/admin/owners").then(setRows).catch(()=>setRows([]));
  useEffect(()=>{ load(); }, []);

  const setActive = async (id, active) => {
    setBusy(true);
    try{
      await apiFetch(`/admin/owners/${id}/set-active`, { method: "POST", body: JSON.stringify({ active }) });
      await load();
    } finally { setBusy(false); }
  };

  const openReset = (row) => setResetFor({ id: row.id, username: row.username, pwd: "" });
  const doReset = async () => {
    if(!resetFor?.pwd) return;
    setBusy(true);
    try{
      await apiFetch(`/admin/owners/${resetFor.id}/reset-password`, { method: "POST", body: JSON.stringify({ new_password: resetFor.pwd }) });
      setResetFor(null);
    } finally { setBusy(false); }
  };

  return (
    <div className="shell">
      <div className="card card--lg">
        <div className="hstack" style={{justifyContent:"space-between"}}>
          <h2 className="text-xl font-bold" style={{margin:0}}>Owners</h2>
          <div className="text-sm" style={{opacity:.75}}>{busy ? "Working…" : null}</div>
        </div>

        <div style={{marginTop:12, overflow:"hidden", borderRadius:12, border:"1px solid var(--border)"}}>
          <table className="table">
            <thead>
              <tr>
                <th>Owner ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Active</th>
                <th>Farmhouses</th>
                <th style={{width:220}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r)=>(
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.username}</td>
                  <td>{r.email || "—"}</td>
                  <td>{r.is_active ? "Yes":"No"}</td>
                  <td>{r.farmhouses?.length ? r.farmhouses.map(f=>`${f.name}${f.size?` (${f.size})`:''}${f.location?` @ ${f.location}`:''}`).join(", ") : "—"}</td>
                  <td>
                    <div className="actions">
                      <button className="btn" onClick={()=>setActive(r.id, !r.is_active)}>
                        {r.is_active ? "Disable" : "Enable"}
                      </button>
                      <button className="btn btn-primary" onClick={()=>openReset(r)}>Reset Password</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={6} style={{textAlign:"center", padding:"1rem"}}>No owners yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {resetFor && (
        <div className="modal" onClick={()=>setResetFor(null)}>
          <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-xl font-bold" style={{marginTop:0}}>Reset password — {resetFor.username}</h3>
            <input className="input" type="password" placeholder="New password"
                   value={resetFor.pwd} onChange={e=>setResetFor(s=>({...s, pwd:e.target.value}))}/>
            <div className="hstack" style={{justifyContent:"flex-end", marginTop:12}}>
              <button className="btn" onClick={()=>setResetFor(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doReset}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Admin: Create Owner (styled) ---------- */
function AdminCreateOwnerPage(){
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [farmhouseName, setFarmhouseName] = useState("");
    const [size, setSize] = useState("");
    const [location, setLocation] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);
  
    const submit = async (e) => {
      e.preventDefault();
      setMsg(null);
  
      const sizeNum = Number(size);
      if(!username || !password || !farmhouseName || !email || !location || !size){
        setMsg({type:"err", text:"Please fill all required fields (Username, Email, Password, Farmhouse name, Size, Location)."});
        return;
      }
      if(!/^\S+@\S+\.\S+$/.test(email)){
        setMsg({type:"err", text:"Enter a valid email address."});
        return;
      }
      if(!Number.isFinite(sizeNum) || sizeNum <= 0){
        setMsg({type:"err", text:"Size must be a positive number."});
        return;
      }
  
      setBusy(true);
      try{
        const body = {
          username,
          password,
          farmhouse_name: farmhouseName,
          email,
          size: sizeNum,
          location,
        };
        const fh = await apiFetch(`/admin/owners/create`, { method:"POST", body: JSON.stringify(body) });
        setMsg({type:"ok", text:`Created owner "${username}" and farmhouse "${fh.name}" (id ${fh.id}).`});
        setUsername(""); setPassword(""); setFarmhouseName(""); setSize(""); setLocation(""); setEmail("");
      } catch(e){
        setMsg({type:"err", text:e.message || "Failed to create owner."});
      } finally { setBusy(false); }
    };
  
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold">Create Owner &amp; Farmhouse</h1>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex" style={{gap:8, flexWrap:"wrap"}}>
            <label style={{flexBasis:"100%"}}><b>Username *</b></label>
            <input className="border p-2" required placeholder="e.g. owner1" value={username} onChange={e=>setUsername(e.target.value)} style={{flex:"1 1 320px"}}/>
  
            <label style={{flexBasis:"100%"}}><b>Email *</b></label>
            <input className="border p-2" required type="email" placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)} style={{flex:"1 1 420px"}}/>
  
            <label style={{flexBasis:"100%"}}><b>Password *</b></label>
            <input className="border p-2" required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={{flex:"1 1 320px"}}/>
  
            <label style={{flexBasis:"100%"}}><b>Farmhouse name *</b></label>
            <input className="border p-2" required placeholder="Farmhouse name" value={farmhouseName} onChange={e=>setFarmhouseName(e.target.value)} style={{flex:"1 1 420px"}}/>
  
            <label style={{flexBasis:"100%"}}><b>Size *</b></label>
            <input className="border p-2" required type="number" min={1} placeholder="e.g. 10" value={size} onChange={e=>setSize(e.target.value)} style={{flex:"1 1 200px"}}/>
  
            <label style={{flexBasis:"100%"}}><b>Location *</b></label>
            <input className="border p-2" required placeholder="City / Area" value={location} onChange={e=>setLocation(e.target.value)} style={{flex:"2 1 420px"}}/>
  
            <button className="btn btn-primary" disabled={busy} style={{minWidth:140, marginTop:8}}>
              {busy? "Creating…" : "Create"}
            </button>
          </div>
  
          {msg && (
            <div className="p-2" style={{
              borderRadius:8, border:"1px solid var(--border)",
              color: msg.type==="ok" ? "var(--ok-tint)" : "var(--bad-tint)",
              background: msg.type==="ok" ? "var(--ok-bg)" : "var(--bad-bg)"
            }}>
              {msg.text}
            </div>
          )}
        </form>
      </div>
    );
  }
  
/* ---------- Owner page ---------- */
function OwnerPage() {
  const [farms, setFarms] = useState([]);
  const [sel, setSel] = useState(null);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  useEffect(()=>{ apiFetch("/me/farmhouses").then(setFarms); }, []);
  useEffect(()=>{ if(farms.length) setSel(farms[0].id); }, [farms]);

  return (
    <div className="shell">
      <h1 className="text-xl font-bold">My Farmhouse Calendar</h1>
      <div className="hstack" style={{marginTop:8}}>
        <select className="select" value={sel||""} onChange={(e)=>setSel(Number(e.target.value))}>
          {farms.map(f=> <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <input className="input" style={{width:120}} type="number" value={year} onChange={e=>setYear(Number(e.target.value))}/>
        <input className="input" style={{width:90}} type="number" min={1} max={12} value={month} onChange={e=>setMonth(Number(e.target.value))}/>
      </div>
      <div style={{marginTop:12}}>
        {sel && <Calendar fid={sel} year={year} month={month} editable={true} />}
      </div>
    </div>
  );
}

/* ---------- Admin page with tabs (polished) ---------- */
/* ---------- Admin page with filters (calendar) ---------- */
function AdminPage() {
    const [tab, setTab] = useState("calendar");
    const [farms, setFarms] = useState([]);
    const [sel, setSel] = useState(null);
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
  
    // NEW: filters
    const [loc, setLoc] = useState("");       // exact match; "" = All
    const [sizeMin, setSizeMin] = useState(""); // numeric string
    const [sizeMax, setSizeMax] = useState(""); // numeric string
  
    useEffect(()=>{ apiFetch("/me/farmhouses").then(setFarms); }, []);
  
    // Distinct locations for dropdown
    const locations = useMemo(() => {
      const s = new Set();
      farms.forEach(f => { if (f.location) s.add(f.location); });
      return Array.from(s).sort((a,b)=>a.localeCompare(b));
    }, [farms]);
  
    // Apply filters
    const filtered = useMemo(() => {
      const min = sizeMin === "" ? -Infinity : Number(sizeMin);
      const max = sizeMax === "" ?  Infinity : Number(sizeMax);
      return farms.filter(f => {
        const sizeVal = Number(f.size ?? 0);
        const okLoc = !loc || f.location === loc;
        const okSize = sizeVal >= min && sizeVal <= max;
        return okLoc && okSize;
      });
    }, [farms, loc, sizeMin, sizeMax]);
  
    // Pick first visible farm if current one is filtered out
    useEffect(() => {
      if (filtered.length === 0) { setSel(null); return; }
      if (sel == null || !filtered.find(f => f.id === sel)) {
        setSel(filtered[0].id);
      }
    }, [filtered]);
  
    return (
      <>
        <div className="shell" style={{paddingTop:12, paddingBottom:0}}>
          <div className="tabs">
            <button className={cx("tab", tab==="calendar" && "is-active")} onClick={()=>setTab("calendar")}>Calendar</button>
            <button className={cx("tab", tab==="owners" && "is-active")} onClick={()=>setTab("owners")}>Owners</button>
            <button className={cx("tab", tab==="create" && "is-active")} onClick={()=>setTab("create")}>Create Owner</button>
          </div>
        </div>
  
        {tab==="calendar" && (
          <div className="shell">
            <h1 className="text-xl font-bold">Admin — All Farmhouses (view only)</h1>
  
            {/* Filters */}
            <div className="hstack" style={{gap:12, flexWrap:"wrap", marginTop:8, alignItems:"center"}}>
              <span className="text-sm" style={{opacity:.75}}>Filters:</span>
  
              <select className="select" value={loc} onChange={(e)=>setLoc(e.target.value)} title="Location">
                <option value="">All locations</option>
                {locations.map(L => <option key={L} value={L}>{L}</option>)}
              </select>
  
              <input className="input" style={{width:110}} type="number" min="0" placeholder="Min size"
                     value={sizeMin} onChange={e=>setSizeMin(e.target.value)} />
              <input className="input" style={{width:110}} type="number" min="0" placeholder="Max size"
                     value={sizeMax} onChange={e=>setSizeMax(e.target.value)} />
  
              <button className="btn" onClick={() => { setLoc(""); setSizeMin(""); setSizeMax(""); }}>
                Clear filters
              </button>
  
              <span className="text-sm" style={{opacity:.65}}>
                Showing {filtered.length} of {farms.length}
              </span>
            </div>
  
            {/* Calendar controls */}
            <div className="hstack" style={{marginTop:8}}>
              <select className="select" value={sel||""} onChange={(e)=>setSel(Number(e.target.value))}>
                {filtered.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}{f.size ? ` (${f.size})` : ""}{f.location ? ` @ ${f.location}` : ""} (owner {f.owner_id})
                  </option>
                ))}
              </select>
              <input className="input" style={{width:120}} type="number" value={year} onChange={e=>setYear(Number(e.target.value))}/>
              <input className="input" style={{width:90}} type="number" min={1} max={12} value={month} onChange={(e)=>setMonth(Number(e.target.value))}/>
              <span className="chip">Read-only</span>
            </div>
  
            <div style={{marginTop:12}}>
              {sel ? (
                <Calendar fid={sel} year={year} month={month} editable={false} />
              ) : (
                <div className="chip">No farmhouses match the filters.</div>
              )}
            </div>
          </div>
        )}
  
        {tab==="owners" && <AdminOwnersPage/>}
        {tab==="create" && <AdminCreateOwnerPage/>}
      </>
    );
  }
  
/* ---------- App ---------- */
export default function App() {
  const [role, setRole] = useState(localStorage.getItem("role"));
  const logout = () => { localStorage.clear(); setRole(null); };

  if (!role) {
    return (
      <>
        <header className="appbar">
          <div className="appbar__inner">
            <div className="brand">Farmhouse Booking</div>
          </div>
        </header>
        <Login onLogin={({ role }) => setRole(role)} />
      </>
    );
  }

  return (
    <>
      <header className="appbar">
        <div className="appbar__inner">
          <div className="brand">Farmhouse Booking</div>
          <div className="space-x-3">
            <span className="text-sm">{localStorage.getItem("email")} [{role}]</span>
            <button className="btn" onClick={logout}>Logout</button>
          </div>
        </div>
      </header>
      {role === "admin" ? <AdminPage /> : <OwnerPage />}
    </>
  );
}
