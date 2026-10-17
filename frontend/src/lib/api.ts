// Types copied from docs/api-contract.md — keep in sync with the backend.
// The frontend and backend build against that file; if it changes,
// update these types first.

export type ProductSpec = {
  id: number;
  name: string;
  fields: Record<string, string>;
  created_at: string; // ISO 8601 UTC
};

export type OcrLine = {
  text: string;
  confidence: number; // 0-1
  bbox: [number, number, number, number]; // [left, top, width, height]
};

export type OcrResult = {
  text: string; // all lines joined with "\n", top to bottom
  lines: OcrLine[];
  mean_confidence: number; // 0-1
  engine: "rapidocr" | "tesseract";
};

export type FieldStatus = "match" | "missing" | "incorrect" | "uncertain";
export type InspectionStatus = "pass" | "needs_review";

export type FieldResult = {
  field: string; // key from spec.fields
  expected: string;
  found: string | null; // the OCR line it matched, or null
  status: FieldStatus;
  confidence: number; // 0-1
};

export type Inspection = {
  id: number;
  spec_id: number;
  image_filename: string;
  status: InspectionStatus;
  ocr: OcrResult;
  results: FieldResult[];
  created_at: string;
};

// Deployed: frontend and API share one origin, with the API under /api (vercel.json).
// Local dev: the API runs on :8000. NEXT_PUBLIC_API_URL overrides either.
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:8000");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Turn any fetch failure into a short, human-readable message. */
export function friendlyErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 501)
      return "This action is not available yet.";
    if (err.status === 404) return "Not found.";
    if (err.status === 413) return "That image is too large to upload. Try a smaller photo.";
    return err.message || `Request failed (HTTP ${err.status}).`;
  }
  if (err instanceof TypeError)
    return "Could not reach the backend. Is it running at " + API_BASE + "?";
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // non-JSON error body — fall through to status text
    }
    throw new ApiError(res.status, detail || res.statusText);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  /** OCR only, no comparison. */
  // Callers shrink large photos first with prepareImage() from ./image (Vercel's 4.5 MB limit).
  ocr: (image: File) => {
    const form = new FormData();
    form.append("image", image);
    return request<OcrResult>("/ocr", { method: "POST", body: form });
  },

  listSpecs: () => request<ProductSpec[]>("/specs"),

  getSpec: (id: number) => request<ProductSpec>(`/specs/${id}`),

  /** 409 if the spec already has inspections (they'd lose their reference). */
  deleteSpec: (id: number) => request<void>(`/specs/${id}`, { method: "DELETE" }),

  createSpec: (name: string, fields: Record<string, string>) =>
    request<ProductSpec>("/specs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, fields }),
    }),

  createInspection: (specId: number, image: File) => {
    const form = new FormData();
    form.append("spec_id", String(specId));
    form.append("image", image);
    return request<Inspection>("/inspections", { method: "POST", body: form });
  },

  listInspections: (specId?: number) =>
    request<Inspection[]>(
      specId != null ? `/inspections?spec_id=${specId}` : "/inspections",
    ),

  getInspection: (id: number) => request<Inspection>(`/inspections/${id}`),
};
