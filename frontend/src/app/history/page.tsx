"use client";
/* eslint-disable @next/next/no-img-element -- local product thumbnails */
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, friendlyErrorMessage, type Inspection, type ProductSpec } from "@/lib/api";
import { SPEC_THUMBNAIL } from "@/lib/sample";
import { InspectionBadge } from "@/components/StatusBadge";
const PAGE_SIZE=6;
function formatDate(iso:string){const d=new Date(iso);return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"America/Los_Angeles"})+" "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Los_Angeles"});}
export default function HistoryPage(){
  const [inspections,setInspections]=useState<Inspection[]>([]);
  const [specs,setSpecs]=useState<ProductSpec[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");
  const [range,setRange]=useState("all");
  const [cutoff,setCutoff]=useState(0);
  const [page,setPage]=useState(0);
  useEffect(()=>{let active=true;Promise.all([api.listInspections(),api.listSpecs()]).then(([items,products])=>{if(active){setInspections(items);setSpecs(products);}}).catch(e=>{if(active)setError(friendlyErrorMessage(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  const product=(i:Inspection)=>specs.find(s=>s.id===i.spec_id);
  const filtered=inspections.filter(i=>{const spec=product(i);return new Date(i.created_at).getTime()>=cutoff && `${spec?.name??""} ${i.id} ${i.image_filename} ${i.status.replaceAll("_"," ")}`.toLowerCase().includes(query.toLowerCase());});
  const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const safePage=Math.min(page,pageCount-1);
  const pageRows=filtered.slice(safePage*PAGE_SIZE,(safePage+1)*PAGE_SIZE);
  const stats=[{label:"Total inspections",value:inspections.length,icon:"⊞",style:"total"},{label:"Pass",value:inspections.filter(i=>i.status==="pass").length,icon:"✓",style:"pass"},{label:"Needs review",value:inspections.filter(i=>i.status==="needs_review").length,icon:"!",style:"review"}];
  return <div className="history-page">
    <div className="page-heading history-heading"><div><h1>Inspection history</h1><p>View past inspections and their results.</p></div><div className="history-filters"><div className="search-control"><span aria-hidden="true">⌕</span><input aria-label="Search products or inspections" placeholder="Search products or inspections…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} /></div><select aria-label="Inspection date range" value={range} onChange={e=>{setRange(e.target.value);setCutoff(e.target.value==="all"?0:Date.now()-Number(e.target.value)*86400000);setPage(0);}}><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></div></div>
    {error && <div className="error-message" role="alert">{error}</div>}
    {loading ? <p className="loading-message">Loading inspections…</p> : <>
    <div className="history-stats">{stats.map(s=><article className={`history-stat ${s.style}`} key={s.label}><span className="stat-icon" aria-hidden="true">{s.icon}</span><div><strong>{s.value}</strong><p>{s.label}</p></div></article>)}</div>
    <div className="history-records"><div className="table-scroll history-table"><table><thead><tr><th>Date</th><th>Product</th><th>Label file</th><th>Result</th><th>Issues</th><th>Actions</th></tr></thead><tbody>{pageRows.map(i=>{const spec=product(i);const issues=i.results.filter(r=>r.status!=="match").length;return <tr key={i.id}><td className="history-date">{formatDate(i.created_at)}</td><td><span className="history-product"><img src={SPEC_THUMBNAIL} alt="" /><span>{spec?.name??`Specification #${i.spec_id}`}</span></span></td><td className="spec-version">{i.image_filename}</td><td><InspectionBadge status={i.status} /></td><td className={issues?"has-issues":""}>{issues}</td><td><div className="row-actions"><Link className="outline-button" href={`/history/${i.id}`}>View</Link><details className="more-menu"><summary aria-label={`Options for inspection ${i.id}`}>⋯</summary><div><Link href={`/history/${i.id}`}>View inspection</Link></div></details></div></td></tr>;})}{!pageRows.length&&<tr><td colSpan={6} className="empty-message">No inspections match your search or date filter.</td></tr>}</tbody></table></div>
    <div className="history-pagination"><p>Showing {filtered.length?safePage*PAGE_SIZE+1:0}–{Math.min((safePage+1)*PAGE_SIZE,filtered.length)} of {filtered.length} inspections</p><nav aria-label="Inspection history pages"><button aria-label="Previous page" disabled={safePage===0} onClick={()=>setPage(safePage-1)}>‹</button>{Array.from({length:pageCount},(_,i)=><button key={i} aria-label={`Page ${i+1}`} aria-current={safePage===i?"page":undefined} onClick={()=>setPage(i)}>{i+1}</button>)}<button aria-label="Next page" disabled={safePage===pageCount-1} onClick={()=>setPage(safePage+1)}>›</button></nav></div></div>
    </>}
  </div>;
}
