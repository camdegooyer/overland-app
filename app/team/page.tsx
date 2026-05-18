import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guard";

const SECTIONS = [
  {
    title: "Roster",
    href: "/team/roster",
    blurb: "Week planner — drag employees into days, jobs onto cards.",
  },
  {
    title: "Jobs",
    href: "/team/jobs",
    blurb: "Pick which projects show up in the roster side panel.",
  },
  {
    title: "Employees",
    href: "/team/employees",
    blurb: "Field crew — trade, sort order, roster visibility.",
  },
  {
    title: "Settings",
    href: "/team/settings/roster",
    blurb: "Default times, week start, display tokens.",
  },
];

export default async function TeamHome() {
  const { displayName } = await requireAdmin();

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-16">
      <h1 className="text-3xl sm:text-4xl font-medium mb-3">
        Hi {displayName?.split(" ")[0] ?? "there"}.
      </h1>
      <p className="text-gray-500 mb-12 max-w-xl">
        Your Overland Builders Workspace. Pick a section to get started.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-50">
        {SECTIONS.map((s) => (
          <Link
            key={s.title}
            href={s.href}
            className="bg-background p-6 hover:bg-neutral transition no-underline"
          >
            <div className="text-xs uppercase tracking-wider text-brand mb-3">
              Section
            </div>
            <div className="text-xl font-medium mb-1">{s.title}</div>
            <div className="text-sm text-gray-500">{s.blurb}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
