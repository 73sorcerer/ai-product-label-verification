"use client";
/* eslint-disable @next/next/no-img-element -- blob previews and local product images */
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, friendlyErrorMessage, type Inspection, type ProductSpec } from "@/lib/api";
import { SAMPLE_IMAGE, SAMPLE_SPEC, SPEC_THUMBNAIL, ensureSampleSpec, loadSampleImage, specSummary } from "@/lib/sample";
import { formatBytes, prepareImage } from "@/lib/image";
import InspectionDetail, { type Evidence } from "@/components/InspectionDetail";

async function cropToBbox(
  file: File,
  bbox: [number, number, number, number]
): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image."));
      el.src = url;
    });
    const [l, t, w, h] = bbox;
    const sx = Math.max(0, Math.floor(l - w * 0.3));
    const sy = Math.max(0, Math.floor(t - h * 0.5));
    const ex = Math.min(img.width, Math.ceil(l + w + w * 0.3));
    const ey = Math.min(img.height, Math.ceil(t + h + h * 0.5));
    const sw = ex - sx;
    const sh = ey - sy;
    if (sw <= 0 || sh <= 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const SAMPLE_IMAGE_NAME = SAMPLE_IMAGE.split("/").pop();

function InspectContent() {
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [specId, setSpecId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [compressNote, setCompressNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDetailsElement>(null);
  useEffect(()=>{let active=true;api.listSpecs().then(list=>{if(active){setSpecs(list);setSpecId((demo?list.find(s=>s.name===SAMPLE_SPEC.name):undefined)?.id??list[0]?.id??null);}}).catch(e=>{if(active)setError(friendlyErrorMessage(e));});return()=>{active=false;};},[demo]);
  // "Try a sample inspection": preload a real sample label; Verify Label runs a real inspection.
  useEffect(()=>{if(!demo)return;let active=true;loadSampleImage().then(f=>{if(active){setFile(f);setPreview(URL.createObjectURL(f));}}).catch(e=>{if(active)setError(friendlyErrorMessage(e));});return()=>{active=false;};},[demo]);
  useEffect(()=>()=>{if(preview?.startsWith("blob:"))URL.revokeObjectURL(preview);},[preview]);
  const selected = specs.find(s=>s.id===specId);
  function pickFile(f?: File) {
    if(!f)return;
    if(!/image\/(png|jpeg|webp|bmp|tiff)/.test(f.type)){setError("Choose a PNG, JPEG, WEBP, BMP or TIFF photo.");return;}
    setFile(f);setPreview(URL.createObjectURL(f));setInspection(null);setEvidence(null);setCompressNote("");setError("");
  }
  function removeFile(){setFile(null);setPreview(null);setInspection(null);setEvidence(null);setCompressNote("");if(inputRef.current)inputRef.current.value="";}
  async function submit(e: React.FormEvent) {
    e.preventDefault();setError("");
    if(!file){setError("Choose a label photo to upload.");return;}
    let targetId=specId;
    if(demo && file.name===SAMPLE_IMAGE_NAME && !specs.some(s=>s.name===SAMPLE_SPEC.name)){
      // The sample label needs its real spec; create it once if it was deleted.
      try{const spec=await ensureSampleSpec(specs);setSpecs([...specs,spec]);setSpecId(spec.id);targetId=spec.id;}catch(e){setError(friendlyErrorMessage(e));return;}
    }
    if(!targetId){setError("Pick a product specification first.");return;}
    setBusy(true);setInspection(null);setEvidence(null);setCompressNote("");
    try {
      const prepared=await prepareImage(file);
      if(prepared.compressed)setCompressNote(`Compressed ${formatBytes(prepared.originalBytes)} to ${formatBytes(prepared.finalBytes)} for upload.`);
      const result=await api.createInspection(targetId,prepared.file);setInspection(result);
      const flagged=result.results.find(r=>r.status==="incorrect")??result.results.find(r=>r.status==="uncertain");const line=result.ocr.lines.find(l=>l.text===flagged?.found);
      if(flagged&&line){const url=await cropToBbox(prepared.file,line.bbox);if(url)setEvidence({field:flagged.field,url});}
    } catch(e){setError(friendlyErrorMessage(e));} finally {setBusy(false);}
  }
  return <div className="inspect-page">
    <div className="page-heading"><div><h1>New inspection</h1><p>Select a product specification, upload a label photo, and get verification results.</p></div></div>
    {demo && <p className="demo-notice">Sample inspection: a real sample label (wrong net weight) is loaded for the “{SAMPLE_SPEC.name}” spec. Press Verify Label to run a real check.</p>}
    <div className="inspection-workspace">
      <section className="inspection-input-panel"><form onSubmit={submit}>
        <h2>1. Select product spec</h2>
        <details ref={pickerRef} className="spec-picker"><summary aria-label="Select product spec">{selected ? <><img src={SPEC_THUMBNAIL} alt="" /><span><strong>{selected.name}</strong><small>{specSummary(selected)}</small></span></> : <span>Choose a specification</span>}<span className="picker-arrow" aria-hidden="true">⌄</span></summary>
        <ul aria-label="Product specifications">{specs.map(s=>{return <li key={s.id}><button type="button" aria-pressed={s.id===specId} onClick={()=>{setSpecId(s.id);setInspection(null);setEvidence(null);if(!file)setPreview(null);if(pickerRef.current)pickerRef.current.open=false;}}><img src={SPEC_THUMBNAIL} alt="" /><span><strong>{s.name}</strong><small>{specSummary(s)}</small></span></button></li>;})}</ul></details>
        {!specs.length && <p className="form-hint">Create a specification on the <a href="/specs">Specs</a> page to begin.</p>}
        <div className="upload-step"><h2>2. Upload label photo</h2>
          <div className={`upload-dropzone ${dragging?"dragging":""}`} role="button" tabIndex={0} aria-label="Choose or drop a label photo" onClick={()=>inputRef.current?.click()} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();inputRef.current?.click();}}} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);pickFile(e.dataTransfer.files[0]);}}>
            <span className="upload-icon" aria-hidden="true">↥</span><strong>Drag &amp; drop a label photo here<br/>or click to choose</strong><p>PNG, JPEG, WEBP, BMP or TIFF<br/>(large photos are resized automatically)</p>
          </div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff" aria-label="Label photo file" className="sr-only" onChange={e=>pickFile(e.target.files?.[0])} />
          {preview && <div className="photo-preview"><img src={preview} alt="Uploaded label preview" /><button type="button" aria-label="Remove photo" onClick={removeFile}>×</button></div>}
          {preview && file && <p className="photo-filename">{file.name} <span>{formatBytes(file.size)}</span></p>}
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
        {compressNote && <p className="form-hint">{compressNote}</p>}
        <button className="primary-button verify-button" disabled={busy || !specId}>{busy?"Verifying…":<>Verify Label <span aria-hidden="true">→</span></>}</button>
        <p className="upload-note">Photos are automatically resized and compressed below 4.0 MB before upload.</p>
      </form></section>
      <div className="inspection-result-panel">{inspection ? <InspectionDetail inspection={inspection} evidence={evidence} /> : <section className="empty-results"><span aria-hidden="true">⌕</span><h2>{busy?"Verifying label…":"Your verification results will appear here"}</h2><p>Pick a specification, upload a label photo, and press Verify Label.</p><a href="/inspect?demo=1" className="outline-button">Try a sample inspection</a></section>}</div>
    </div>
  </div>;
}
export default function InspectPage(){return <Suspense fallback={<p>Loading inspection…</p>}><InspectContent /></Suspense>;}
