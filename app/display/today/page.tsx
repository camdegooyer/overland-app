type SearchParams = Promise<{ t?: string }>;

export default async function DisplayToday({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { t } = await searchParams;

  return (
    <main className="flex-1 grid place-items-center px-6 py-16 text-center">
      <div className="max-w-md">
        <div className="text-xs uppercase tracking-wider text-brand mb-3">
          Phase 7
        </div>
        <h1 className="text-2xl font-medium mb-3">Display — Today</h1>
        <p className="text-gray-500 text-sm">
          Read-only roster view. {t ? "Token detected." : "No token."} Coming in Phase 7.
        </p>
      </div>
    </main>
  );
}
