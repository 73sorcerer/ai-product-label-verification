"use client";
import { useSyncExternalStore } from "react";
import { subscribeSampleMode, isSampleMode } from "@/lib/api";
export default function SampleBanner() {
  const active = useSyncExternalStore(subscribeSampleMode, isSampleMode, () => false);
  return active ? <div role="status" className="sample-banner">Sample data — backend not connected</div> : null;
}
