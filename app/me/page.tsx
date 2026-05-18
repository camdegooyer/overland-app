import Link from "next/link";
import { requireTeamMember } from "@/lib/auth/guard";
import { SignedInHeader } from "@/app/_components/SignedInHeader";

const CARDS = [
  {
    title: "My shifts",
    href: "/me/shifts",
    blurb: "Your published shifts for the next 8 days.",
  },
  {
    title: "Whole roster",
    href: "/me/roster",
    blurb: "Everyone's week, read-only.",
  },
];

export default async function MeHome() {
  const { user, displayName } = await requireTeamMember();

  return (
    <>
      <SignedInHeader
        area="Your roster"
        displayName={displayName}
        email={user.email!}
      />
      <main className="flex-1 max-w-[1024px] w-full mx-auto px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-medium mb-3">
          Hi {displayName?.split(" ")[0] ?? "there"}.
        </h1>
        <p className="text-gray-500 mb-12 max-w-xl">
          Welcome to your Overland Builders Workspace.
        </p>

        <div className="grid sm:grid-cols-2 gap-px bg-gray-100">
          {CARDS.map((c) => (
            <Link
              key={c.title}
              href={c.href}
              className="bg-background p-6 hover:bg-neutral transition no-underline"
            >
              <div className="text-xl font-medium mb-1">{c.title}</div>
              <div className="text-sm text-gray-500">{c.blurb}</div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
