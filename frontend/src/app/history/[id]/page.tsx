import InspectionDetailView from "./InspectionDetailView";

// The id comes from the URL at request time, so this route renders on
// every request instead of being prerendered.
export const instant = false;

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InspectionDetailView id={id} />;
}
