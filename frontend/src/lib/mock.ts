// Temporary mock data used ONLY while the real /inspections endpoint is a 501
// stub. Fields match docs/api-contract.md exactly — nothing invented.
// Remove once Amzad's backend is live.

import type { Inspection } from "./api";

export const MOCK_INSPECTION: Inspection = {
  id: 0,
  spec_id: 1,
  image_filename: "granola_wrong_net_weight.png",
  status: "needs_review",
  ocr: {
    text: "Sunrise Farms\nGolden Harvest Granola\nNet Wt 10 oz (283 g)\nContains: Oats, Almonds, Milk",
    lines: [
      { text: "Sunrise Farms", confidence: 0.99, bbox: [40, 30, 300, 40] },
      {
        text: "Golden Harvest Granola",
        confidence: 0.98,
        bbox: [40, 80, 420, 44],
      },
      {
        text: "Net Wt 10 oz (283 g)",
        confidence: 0.97,
        bbox: [40, 140, 320, 40],
      },
      {
        text: "Contains: Oats, Almonds, Milk",
        confidence: 0.96,
        bbox: [40, 190, 380, 36],
      },
    ],
    mean_confidence: 0.975,
    engine: "rapidocr",
  },
  results: [
    {
      field: "brand",
      expected: "Sunrise Farms",
      found: "Sunrise Farms",
      status: "match",
      confidence: 0.99,
    },
    {
      field: "product_name",
      expected: "Golden Harvest Granola",
      found: "Golden Harvest Granola",
      status: "match",
      confidence: 0.98,
    },
    {
      field: "net_contents",
      expected: "Net Wt 12 oz (340 g)",
      found: "Net Wt 10 oz (283 g)",
      status: "incorrect",
      confidence: 0.97,
    },
    {
      field: "allergens",
      expected: "Contains: Oats, Almonds, Milk",
      found: "Contains: Oats, Almonds, Milk",
      status: "match",
      confidence: 0.96,
    },
  ],
  created_at: new Date().toISOString(),
};
