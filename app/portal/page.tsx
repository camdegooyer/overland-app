import { requireRole } from "@/lib/auth/guard";
import { SignedInHeader } from "@/app/_components/SignedInHeader";

const STUBS = [
  { title: "Your project", blurb: "Stage, key dates, who's involved." },
  { title: "Selections", blurb: "Decisions to make and approvals." },
  { title: "Documents", blurb: "Plans, specs and contracts." },
  { title: "Messages", blurb: "Conversation log with the Overland team." },
];

export default async function PortalHome() {
  const { user, displayName } = await requireRole("client");

  return (
    <>
      <SignedInHeader
        area="Client portal"
        displayName={displayName}
        email={user.email!}
      />
      <main className="flex-1 max-w-[1024px] w-full mx-auto px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-medium mb-3">
          Hi {displayName?.split(" ")[0] ?? "there"}.
        </h1>
        <p className="text-gray-500 mb-12 max-w-xl">
          Welcome to your project portal. We&apos;re still building this out
          — here&apos;s where everything will live.
        </p>

        <div className="grid sm:grid-cols-2 gap-px bg-gray-50">
          {STUBS.map((s) => (
            <div
              key={s.title}
              className="bg-background p-6 hover:bg-neutral transition cursor-default"
            >
              <div className="text-xs uppercase tracking-wider text-brand mb-3">
                Coming soon
              </div>
              <div className="text-xl font-medium mb-1">{s.title}</div>
              <div className="text-sm text-gray-500">{s.blurb}</div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
