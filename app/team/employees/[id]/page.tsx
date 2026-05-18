import { Stub } from "../../_components/Stub";

export default async function EmployeeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Stub
      phase={3}
      title={`Employee — ${id}`}
      description="Per-employee roster settings. Coming in Phase 3."
    />
  );
}
