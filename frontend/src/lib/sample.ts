// "Try a sample inspection" runs a REAL inspection: a real sample label from
// data/sample_labels/ against the matching real spec. Nothing here is mocked.
import { api, type ProductSpec } from "./api";

export const SAMPLE_IMAGE = "/samples/granola_wrong_net_weight.png";

// Copied from data/sample_labels/specs.json ("granola"). Keep in sync.
export const SAMPLE_SPEC = {
  name: "Golden Harvest Granola",
  fields: {
    brand: "Sunrise Farms",
    product_name: "Golden Harvest Granola",
    net_contents: "Net Wt 12 oz (340 g)",
    allergens: "Contains: Oats, Almonds, Milk",
    sku: "SKU: SF-GRN-12",
    best_by: "Best By: 03/15/2027",
    manufacturer: "Sunrise Farms Co., Portland, OR",
  },
};

export async function loadSampleImage(): Promise<File> {
  const res = await fetch(SAMPLE_IMAGE);
  if (!res.ok) throw new Error("Couldn't load the sample label.");
  const blob = await res.blob();
  return new File([blob], SAMPLE_IMAGE.split("/").pop()!, { type: blob.type || "image/png" });
}

/** The spec the sample label is printed from; created once if it doesn't exist yet. */
export async function ensureSampleSpec(specs: ProductSpec[]): Promise<ProductSpec> {
  const existing = specs.find(s => s.name === SAMPLE_SPEC.name);
  return existing ?? api.createSpec(SAMPLE_SPEC.name, SAMPLE_SPEC.fields);
}

/** Neutral thumbnail for every spec: we don't store product photos, so don't show a stand-in product. */
export const SPEC_THUMBNAIL = "/products/spec-placeholder.svg";

export function specSummary(spec: ProductSpec): string {
  const n = Object.keys(spec.fields).length;
  const created = new Date(spec.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
  return `${n} field${n === 1 ? "" : "s"} • Created ${created}`;
}
