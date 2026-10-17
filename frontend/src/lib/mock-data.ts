import type { Inspection, ProductSpec } from "./api";

// Presentation metadata belongs to the frontend, not the API contract.
export type SpecPresentation = { status: "Approved" | "Draft"; version: number; updated: string; thumbnail: string; notes: Record<string, string> };
export const FIELD_ORDER = ["Product Name", "Net Weight", "Ingredients", "Allergens", "Brand", "Barcode"];
const notes = { "Product Name": "Exact text", "Net Weight": "Format: 12 oz (340 g)", Ingredients: "Exact text", Allergens: "Must include tree nuts", Brand: "Exact text", Barcode: "Numeric only" };
export const MOCK_SPECS: ProductSpec[] = [
  { id: 1, name: "Golden Harvest Granola", created_at: "2026-10-12T17:00:00Z", fields: { "Product Name": "Golden Harvest Granola", "Net Weight": "12 oz (340 g)", Ingredients: "Oats, Honey, Almonds, Sea Salt", Allergens: "Contains: Almonds", Brand: "Golden Harvest", Barcode: "0123456789012" } },
  { id: 2, name: "Original Hot Sauce", created_at: "2026-10-05T17:00:00Z", fields: { "Product Name": "Original Hot Sauce", "Net Weight": "12 oz (340 g)", Ingredients: "Red Peppers, Vinegar, Salt, Garlic", Allergens: "None", Brand: "Original", Barcode: "0123456789029" } },
  { id: 3, name: "Protein Bar", created_at: "2026-09-28T17:00:00Z", fields: { "Product Name": "Protein Bar", "Net Weight": "2.1 oz (60 g)", Ingredients: "Whey Protein, Almonds, Cocoa, Honey", Allergens: "Contains: Milk, Almonds", Brand: "Peak Protein", Barcode: "0123456789036" } },
  { id: 4, name: "Sparkling Water", created_at: "2026-09-15T17:00:00Z", fields: { "Product Name": "Sparkling Water", "Net Weight": "12 fl oz (355 mL)", Ingredients: "Carbonated Water, Natural Flavors", Allergens: "None", Brand: "Fresh Spark", Barcode: "0123456789043" } },
];
export const SPEC_PRESENTATION: Record<number, SpecPresentation> = Object.fromEntries(MOCK_SPECS.map((s, i) => [s.id, { status: i === 1 ? "Draft" : "Approved", version: [2, 1, 3, 1][i], updated: s.created_at, thumbnail: `/products/${["granola", "hot-sauce", "protein-bar", "sparkling-water"][i]}.png`, notes: { ...notes, "Net Weight": `Format: ${s.fields["Net Weight"]}`, Allergens: s.fields.Allergens.includes("Almonds") ? "Must include tree nuts" : "Exact text" } }]));
export function specPresentation(spec: ProductSpec): SpecPresentation {
  return MOCK_SPECS.some(s => s.id === spec.id && s.name === spec.name && s.created_at === spec.created_at) && SPEC_PRESENTATION[spec.id] ? SPEC_PRESENTATION[spec.id] : { status: "Draft", version: 1, updated: spec.created_at, thumbnail: "/products/granola.png", notes: {} };
}
export type InspectionRecord = Omit<Inspection, "status"> & { status: Inspection["status"] | "error"; sample?: boolean; error?: string };
export function sampleInspection(specId = 1, id = 1, date = "2026-10-12T17:24:00Z", status: InspectionRecord["status"] = "needs_review"): InspectionRecord {
  const spec = MOCK_SPECS.find(s => s.id === specId) ?? MOCK_SPECS[0];
  const results: Inspection["results"] = Object.entries(spec.fields).map(([field, expected], i) => ({ field, expected, found: status === "needs_review" && i === 1 ? "10 oz (283 g)" : status === "needs_review" && i === 5 ? null : expected, status: status === "needs_review" && i === 1 ? "incorrect" : status === "needs_review" && i === 5 ? "uncertain" : "match", confidence: status === "needs_review" && i === 5 ? .45 : [.99, .96, .98, .97, .99, .99][i] }));
  return { id, spec_id: spec.id, image_filename: "granola_label.jpg", created_at: date, status, sample: true, ...(status === "error" ? { error: "The sample photo could not be read. Upload a clearer label photo to try again." } : {}), results: status === "error" ? [] : results, ocr: { text: results.map(r => r.found ?? "").join("\n"), lines: results.filter(r => r.found).map(r => ({ text: r.found!, confidence: r.confidence, bbox: [0, 0, 0, 0] })), mean_confidence: .88, engine: "rapidocr" } };
}
const firstRows: [number, string, InspectionRecord["status"]][] = [
  [1, "2026-10-12T17:24:00Z", "needs_review"], [2, "2026-10-10T22:15:00Z", "pass"], [3, "2026-10-08T16:02:00Z", "pass"], [4, "2026-10-05T18:48:00Z", "pass"], [2, "2026-10-03T21:11:00Z", "error"], [1, "2026-10-01T20:20:00Z", "pass"],
];
export const MOCK_INSPECTIONS: InspectionRecord[] = [...firstRows.map(([spec, date, status], i) => sampleInspection(spec, i + 1, date, status)), ...Array.from({ length: 18 }, (_, i) => sampleInspection(i % 4 + 1, i + 7, `2026-09-${String(28 - i).padStart(2, "0")}T17:00:00Z`, i < 3 ? "needs_review" : i === 3 ? "error" : "pass"))];
export const MOCK_INSPECTION = MOCK_INSPECTIONS[0];

// Sample writes are in memory only and never reach the database.
export function fixtureRequest(path: string, init?: RequestInit): unknown {
  const url = new URL(path, "https://fixtures.local");
  if (url.pathname === "/specs" && init?.method === "POST") {
    const body = JSON.parse(String(init.body));
    const spec: ProductSpec = { id: Math.max(...MOCK_SPECS.map(s => s.id)) + 1, name: body.name, fields: body.fields, created_at: new Date().toISOString() };
    MOCK_SPECS.push(spec); return spec;
  }
  if (url.pathname === "/specs") return MOCK_SPECS;
  if (url.pathname.startsWith("/specs/")) return MOCK_SPECS.find(s => s.id === Number(url.pathname.split("/")[2]));
  if (url.pathname === "/inspections" && init?.method === "POST") {
    const form = init.body as FormData;
    return { ...sampleInspection(Number(form.get("spec_id"))), image_filename: (form.get("image") as File)?.name ?? "granola_label.jpg" };
  }
  if (url.pathname === "/inspections") return MOCK_INSPECTIONS.filter(i => !url.searchParams.has("spec_id") || i.spec_id === Number(url.searchParams.get("spec_id")));
  if (url.pathname.startsWith("/inspections/")) return MOCK_INSPECTIONS.find(i => i.id === Number(url.pathname.split("/")[2]));
  return undefined;
}
