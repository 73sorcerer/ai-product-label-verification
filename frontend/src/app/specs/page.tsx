"use client";
/* eslint-disable @next/next/no-img-element -- local product thumbnails */
import { useEffect, useState } from "react";
import { api, friendlyErrorMessage, isSampleMode, type ProductSpec } from "@/lib/api";
import { specPresentation } from "@/lib/mock-data";

type FieldRow = { key: string; value: string };
const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
export default function SpecsPage() {
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Fields");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rows, setRows] = useState<FieldRow[]>([{ key: "", value: "" }]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    let active = true;
    api.listSpecs().then(data => { if(active) {setSpecs(data); setSelectedId(data[0]?.id ?? null); setShowForm(new URLSearchParams(window.location.search).get("new") === "1");} }).catch(e=>{if(active)setError(friendlyErrorMessage(e));}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  }, []);
  const selected = specs.find(s=>s.id===selectedId);
  const info = selected ? specPresentation(selected) : null;
  const filtered = specs.filter(s=>(s.name+" "+Object.values(s.fields).join(" ")).toLowerCase().includes(query.toLowerCase()));
  function newSpec(source?: ProductSpec) { setName(source?.name ?? ""); setRows(source ? Object.entries(source.fields).map(([key,value])=>({key,value})) : [{key:"",value:""}]); setSaveError(""); setShowForm(true); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const fields = Object.fromEntries(rows.filter(r=>r.key.trim()).map(r=>[r.key.trim(),r.value.trim()]));
    if(!name.trim() || !Object.keys(fields).length) {setSaveError("Enter a name and at least one field.");return;}
    setSaving(true);setSaveError("");
    try { const created=await api.createSpec(name.trim(),fields); setSpecs(await api.listSpecs());setSelectedId(created.id);setShowForm(false);setTab("Fields"); } catch(e) {setSaveError(friendlyErrorMessage(e));} finally {setSaving(false);}
  }
  return <div className="specs-page">
    <div className="page-heading"><div><h1>Product specifications</h1><p>Create and manage approved product specifications. Use these specs to verify printed labels.</p></div><button className="primary-button" onClick={()=>newSpec()}><span aria-hidden="true">＋</span> New spec</button></div>
    {error && <div role="alert" className="error-message">{error}</div>}
    {loading ? <p className="loading-message">Loading specifications…</p> : <div className="spec-workspace">
      <aside className="spec-list-pane" aria-label="Specifications">
        <div className="search-control"><span aria-hidden="true">⌕</span><input aria-label="Search specifications" placeholder="Search specifications…" value={query} onChange={e=>setQuery(e.target.value)} /></div>
        <ul className="spec-list">{filtered.map(s=>{const m=specPresentation(s);return <li key={s.id} className={s.id===selectedId ? "selected" : ""}>
          <button className="spec-select" aria-pressed={s.id===selectedId} onClick={()=>{setSelectedId(s.id);setTab("Fields");}}><img src={m.thumbnail} alt="" /><span><strong>{s.name}</strong><span className={`approval-badge ${m.status.toLowerCase()}`}>{m.status==="Approved"?"◈ ":""}{m.status}</span><small>v{m.version} • Updated {date(m.updated)}</small></span></button>
          <details className="more-menu"><summary aria-label={`Options for ${s.name}`}>⋯</summary><div><button onClick={()=>{setSelectedId(s.id);setTab("Details");}}>View details</button><button onClick={()=>newSpec(s)}>Duplicate specification</button></div></details>
        </li>;})}</ul>
        {!filtered.length && <p className="empty-message">No specifications match your search.</p>}
      </aside>
      <section className="spec-detail-pane" aria-label="Selected specification">{selected && info ? <>
        <header className="spec-detail-header"><img src={info.thumbnail} alt={selected.name} /><div><h2>{selected.name} <span className={`approval-badge ${info.status.toLowerCase()}`}>{info.status==="Approved"?"◈ ":""}{info.status}</span></h2><p>Version {info.version} • Updated {date(info.updated)}{isSampleMode()?" by Tray Branch":""}</p></div><details className="more-menu"><summary aria-label="Specification actions">⋯</summary><div><button onClick={()=>newSpec(selected)}>Duplicate specification</button><button onClick={()=>setTab("Details")}>View details</button></div></details></header>
        <div className="spec-tabs" role="tablist" aria-label="Specification sections">{["Fields","Details","History"].map(t=><button key={t} role="tab" aria-selected={tab===t} aria-controls="spec-tab-panel" id={`spec-tab-${t}`} onClick={()=>setTab(t)}>{t}</button>)}</div>
        <div role="tabpanel" id="spec-tab-panel" aria-labelledby={`spec-tab-${tab}`}>
        {tab==="Fields" ? <><div className="info-banner"><span aria-hidden="true">ⓘ</span><p>These fields are used to verify printed labels. Make sure the information matches your approved source (e.g., artwork, regulatory filing, or master data).</p></div>
        <div className="table-scroll spec-fields"><table><thead><tr><th>Field</th><th>Expected value</th><th>Notes</th></tr></thead><tbody>{Object.entries(selected.fields).map(([key,value])=><tr key={key}><td>{key}</td><td>{value}</td><td>{info.notes[key] ?? "Exact text"}</td></tr>)}</tbody></table></div>
        <button className="outline-button add-field" onClick={()=>{newSpec(selected);setRows([...Object.entries(selected.fields).map(([key,value])=>({key,value})),{key:"",value:""}]);}}>＋ Add field</button></> : tab==="Details" ? <div className="spec-tab-content"><h3>Specification details</h3><dl><dt>Product</dt><dd>{selected.name}</dd><dt>Status</dt><dd>{info.status}</dd><dt>Version</dt><dd>{info.version}</dd><dt>Updated</dt><dd>{date(info.updated)}</dd><dt>Fields</dt><dd>{Object.keys(selected.fields).length}</dd></dl></div> : <div className="spec-tab-content"><h3>Version history</h3><p>Version {info.version} • {info.status}</p><p>Updated {date(info.updated)}{isSampleMode()?" by Tray Branch":""}</p></div>}
        </div>
      </> : <p className="empty-message">Create a specification to get started.</p>}</section>
    </div>}
    {showForm && <div className="modal-backdrop" onClick={()=>setShowForm(false)}><section className="spec-form" role="dialog" aria-modal="true" aria-labelledby="create-spec-title" onClick={e=>e.stopPropagation()}><div className="page-heading"><h2 id="create-spec-title">Create a specification</h2><button aria-label="Close form" onClick={()=>setShowForm(false)}>×</button></div><p className="form-hint">Save as a new specification.{isSampleMode()?" Sample changes last until this page is reloaded.":""}</p><form onSubmit={save}><label>Spec name<input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder="Golden Harvest Granola" /></label><p>Fields</p>{rows.map((r,i)=><div className="field-form-row" key={i}><input aria-label={`Field ${i+1} name`} placeholder="Field name" value={r.key} onChange={e=>setRows(rows.map((v,j)=>j===i?{...v,key:e.target.value}:v))} /><input aria-label={`Field ${i+1} expected value`} placeholder="Expected value" value={r.value} onChange={e=>setRows(rows.map((v,j)=>j===i?{...v,value:e.target.value}:v))} /><button type="button" aria-label={`Remove field ${i+1}`} onClick={()=>setRows(rows.filter((_,j)=>j!==i))}>×</button></div>)}<button className="outline-button" type="button" onClick={()=>setRows([...rows,{key:"",value:""}])}>＋ Add field</button>{saveError && <p role="alert" className="error-message">{saveError}</p>}<div className="form-actions"><button className="primary-button" disabled={saving}>{saving?"Saving…":"Save spec"}</button><button className="outline-button" type="button" onClick={()=>setShowForm(false)}>Cancel</button></div></form></section></div>}
  </div>;
}
