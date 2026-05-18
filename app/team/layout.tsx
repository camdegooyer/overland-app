import { requireAdmin } from "@/lib/auth/guard";
import { TeamHeader } from "./_components/TeamHeader";
import { TeamSidebar } from "./_components/TeamSidebar";

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, displayName } = await requireAdmin();

  return (
    <div className="flex flex-col min-h-screen">
      <TeamHeader displayName={displayName} email={user.email!} />
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex md:w-56 lg:w-60 shrink-0 border-r border-gray-50 bg-background">
          <div className="w-full">
            <TeamSidebar />
          </div>
        </aside>
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
