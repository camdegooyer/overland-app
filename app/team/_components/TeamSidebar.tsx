"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Briefcase,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match the start of the pathname so nested routes still highlight. */
  matchPrefix?: string;
};

const NAV: NavItem[] = [
  { href: "/team", label: "Dashboard", icon: LayoutDashboard },
  { href: "/team/roster", label: "Roster", icon: CalendarDays, matchPrefix: "/team/roster" },
  { href: "/team/jobs", label: "Jobs", icon: Briefcase, matchPrefix: "/team/jobs" },
  { href: "/team/employees", label: "Employees", icon: Users, matchPrefix: "/team/employees" },
  { href: "/team/settings/roster", label: "Settings", icon: Settings, matchPrefix: "/team/settings" },
];

export function TeamSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const isActive = item.matchPrefix
          ? pathname.startsWith(item.matchPrefix)
          : pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition no-underline",
              isActive
                ? "bg-neutral text-foreground font-medium"
                : "text-gray-500 hover:bg-neutral/60 hover:text-foreground",
            )}
          >
            <Icon
              className={cn("h-4 w-4", isActive ? "text-brand" : "text-gray-300")}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
