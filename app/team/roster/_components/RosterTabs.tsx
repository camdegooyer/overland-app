import Link from "next/link";
import { cn } from "@/lib/utils";

type Active = "week" | "day" | "by-job" | "month" | "notes";

const TABS: { href: string; label: string; key: Active }[] = [
  { href: "/team/roster", label: "Week", key: "week" },
  { href: "/team/roster/day", label: "Day", key: "day" },
  { href: "/team/roster/by-job", label: "By Job", key: "by-job" },
  { href: "/team/roster/month", label: "Month", key: "month" },
  { href: "/team/roster/notes", label: "Notes", key: "notes" },
];

export function RosterTabs({ active }: { active: Active }) {
  return (
    <nav className="flex items-center gap-1 border-b border-gray-100 -mx-6 px-6">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "px-3 py-2 text-sm no-underline border-b-2 -mb-px transition",
            active === t.key
              ? "border-foreground text-foreground"
              : "border-transparent text-gray-500 hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
