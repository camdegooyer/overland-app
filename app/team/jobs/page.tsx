import { requireAdmin } from "@/lib/auth/guard";
import { getRosterProjects } from "@/lib/roster/queries";
import { JobsTable } from "./_components/JobsTable";

export default async function JobsAdmin() {
  await requireAdmin();
  const projects = await getRosterProjects();

  const visibleCount = projects.filter((p) => p.show_in_side_panel).length;

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-medium mb-2">Jobs</h1>
        <p className="text-gray-500 text-sm">
          {projects.length} projects · {visibleCount} ticked for roster side
          panel.
        </p>
      </div>

      <p className="text-sm text-gray-500 mb-6 max-w-2xl">
        Tick <span className="text-foreground">In roster</span> for any project
        you want available in the roster side panel. <span className="text-foreground">Display name</span>{" "}
        overrides the auto-generated label (job code + suburb) — leave blank to
        use the default shown as placeholder. <span className="text-foreground">Colour</span>{" "}
        sets the left border on roster cards.
      </p>

      <JobsTable projects={projects} />
    </div>
  );
}
