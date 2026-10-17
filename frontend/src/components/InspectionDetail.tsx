/* eslint-disable @next/next/no-img-element -- client-side evidence crops (data: URLs) */
import type { FieldResult, Inspection } from "@/lib/api";
import { FieldBadge, InspectionBadge } from "./StatusBadge";
export const LOW_CONFIDENCE_THRESHOLD = .9;
export function prettyField(key: string): string {return key.split("_").map(w=>w ? w[0].toUpperCase()+w.slice(1) : w).join(" ");}

/** A crop of the uploaded photo around one flagged field (only available right after upload). */
export type Evidence = { field: string; url: string };

const FLAG_ORDER: FieldResult["status"][] = ["incorrect", "missing", "uncertain"];

function flagCopy(r: FieldResult): { title: string; body: string } {
  const name = prettyField(r.field);
  if (r.status === "incorrect") return { title: `${name} does not match`, body: `Expected “${r.expected}” but detected “${r.found}”.` };
  if (r.status === "missing") return { title: `${name} is missing`, body: `Expected “${r.expected}” but nothing close to it was found on the label.` };
  return { title: `${name} couldn't be confirmed`, body: r.found ? `Read “${r.found}” with low confidence (${r.confidence.toFixed(2)}). Retake a clearer photo before deciding.` : "The text was too unclear to read. Retake a clearer photo before deciding." };
}

export default function InspectionDetail({ inspection, evidence }: {inspection: Inspection; evidence?: Evidence | null}) {
  const results=inspection.results;
  const counts={checked:results.length,mismatch:results.filter(r=>r.status==="incorrect").length,uncertain:results.filter(r=>r.status==="uncertain").length,missing:results.filter(r=>r.status==="missing").length};
  const flagged=FLAG_ORDER.flatMap(status=>results.filter(r=>r.status===status));
  const timestamp=new Date(inspection.created_at);
  const options={timeZone:"America/Los_Angeles"};
  return <div className="inspection-detail">
    <section className="result-summary"><h2>Inspection result</h2><div className="result-verdict"><InspectionBadge status={inspection.status} big /><time dateTime={inspection.created_at}>{timestamp.toLocaleDateString("en-US",{...options,month:"short",day:"numeric",year:"numeric"})}<br/>{timestamp.toLocaleTimeString("en-US",{...options,hour:"numeric",minute:"2-digit"})}</time></div>
    <div className="result-counts">{[[counts.checked,"Fields checked","checked"],[counts.mismatch,"Mismatch","mismatch"],[counts.uncertain,"Uncertain","uncertain"],[counts.missing,"Missing","missing"]].map(([value,label,style])=><div className={String(style)} key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <section className="field-comparison"><h2>Field comparison</h2><div className="table-scroll comparison-table"><table><thead><tr><th>Field</th><th>Expected value</th><th>Detected value</th><th>Status</th><th>Confidence</th></tr></thead><tbody>{results.map(r=><tr key={r.field}><td>{prettyField(r.field)}</td><td>{r.expected}</td><td className={r.status==="incorrect"?"mismatch-value":""}>{r.found??"—"}</td><td><FieldBadge status={r.status} /></td><td>{r.confidence.toFixed(2)}</td></tr>)}</tbody></table></div></section>
    {flagged.map(r=>{const copy=flagCopy(r);const crop=evidence?.field===r.field?evidence.url:null;return <aside className="mismatch-callout" key={r.field}><span className="callout-icon" aria-hidden="true">!</span><div><h3>{copy.title}</h3><p>{copy.body}<br/>Check the label before proceeding.</p></div>{crop && <a href={crop} target="_blank" rel="noreferrer" aria-label={`Enlarge the ${prettyField(r.field)} crop`}><img src={crop} alt={`Close-up of the ${prettyField(r.field)} region on the label`} /><span aria-hidden="true">⌕</span></a>}</aside>;})}
    <details className="ocr-details"><summary>Extracted text</summary><ul>{inspection.ocr.lines.map((line,i)=><li key={i} className={line.confidence<LOW_CONFIDENCE_THRESHOLD?"low-confidence":""}><span>{line.text}</span><span>{line.confidence.toFixed(2)}</span></li>)}</ul></details>
    </section>
  </div>;
}
