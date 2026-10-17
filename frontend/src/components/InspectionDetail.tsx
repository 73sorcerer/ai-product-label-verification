/* eslint-disable @next/next/no-img-element -- local evidence images or client-side crops */
import Link from "next/link";
import type { InspectionRecord } from "@/lib/mock-data";
import { FieldBadge, InspectionBadge } from "./StatusBadge";
export const LOW_CONFIDENCE_THRESHOLD = .9;
export function prettyField(key: string): string {return key.split("_").map(w=>w ? w[0].toUpperCase()+w.slice(1) : w).join(" ");}
export default function InspectionDetail({ inspection, evidenceUrl }: {inspection: InspectionRecord; evidenceUrl?: string | null}) {
  const results=inspection.results;
  const counts={checked:results.filter(r=>r.status!=="uncertain").length,mismatch:results.filter(r=>r.status==="incorrect").length,uncertain:results.filter(r=>r.status==="uncertain").length,missing:results.filter(r=>r.status==="missing").length};
  const flagged=results.find(r=>r.status==="incorrect")??results.find(r=>r.status==="uncertain");
  const timestamp=new Date(inspection.created_at);
  const options={timeZone:"America/Los_Angeles"};
  const crop=evidenceUrl??(inspection.sample && flagged?"/products/net-weight-crop.png":null);
  return <div className="inspection-detail">
    <section className="result-summary"><h2>Inspection result</h2><div className="result-verdict"><InspectionBadge status={inspection.status} big /><time dateTime={inspection.created_at}>{timestamp.toLocaleDateString("en-US",{...options,month:"short",day:"numeric",year:"numeric"})}<br/>{timestamp.toLocaleTimeString("en-US",{...options,hour:"numeric",minute:"2-digit"})}</time></div>
    {inspection.status!=="error" && <div className="result-counts">{[[counts.checked,"Fields checked","checked"],[counts.mismatch,"Mismatch","mismatch"],[counts.uncertain,"Uncertain","uncertain"],[counts.missing,"Missing","missing"]].map(([value,label,style])=><div className={String(style)} key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>}</section>
    {inspection.status==="error" ? <div className="error-message"><h3>Label could not be read</h3><p>{inspection.error ?? "Try uploading a clearer photo of the printed label."}</p><Link className="outline-button" href="/inspect">New inspection</Link></div> : <>
    <section className="field-comparison"><h2>Field comparison</h2><div className="table-scroll comparison-table"><table><thead><tr><th>Field</th><th>Expected value</th><th>Detected value</th><th>Status</th><th>Confidence</th></tr></thead><tbody>{results.map(r=><tr key={r.field}><td>{prettyField(r.field)}</td><td>{r.expected}</td><td className={r.status==="incorrect"?"mismatch-value":""}>{r.found??"—"}</td><td><FieldBadge status={r.status} /></td><td>{r.confidence.toFixed(2)}</td></tr>)}</tbody></table></div></section>
    {flagged && <aside className="mismatch-callout"><span className="callout-icon" aria-hidden="true">!</span><div><h3>{prettyField(flagged.field)==="Net Weight"?"Net weight":prettyField(flagged.field)} {flagged.status==="incorrect"?"does not match":"needs a closer look"}</h3><p>Expected “{flagged.expected}” {flagged.found?<>but detected “{flagged.found}”.</>:"but nothing readable was detected."}<br/>Check the label before proceeding.</p></div>{crop && <a href={crop} target="_blank" rel="noreferrer" aria-label="Enlarge flagged label crop"><img src={crop} alt={`Close-up of the ${prettyField(flagged.field)} region on the label`} /><span aria-hidden="true">⌕</span></a>}</aside>}
    {!inspection.sample && <details className="ocr-details"><summary>Extracted text</summary><ul>{inspection.ocr.lines.map((line,i)=><li key={i} className={line.confidence<LOW_CONFIDENCE_THRESHOLD?"low-confidence":""}><span>{line.text}</span><span>{line.confidence.toFixed(2)}</span></li>)}</ul></details>}
    </>}
  </div>;
}
