import { Stub } from "../../_components/Stub";

export default async function JobDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Stub
      phase={3}
      title={`Job — ${id}`}
      description="Per-project roster settings. Coming in Phase 3."
    />
  );
}
