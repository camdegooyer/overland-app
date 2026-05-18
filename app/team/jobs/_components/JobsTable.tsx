"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { RosterProject } from "@/lib/roster/types";
import { upsertProjectRosterMeta } from "../_actions/jobs";

type Props = { projects: RosterProject[] };

const ARCHIVE_STAGES = new Set(["Archive", "Archived"]);

export function JobsTable({ projects }: Props) {
  const [search, setSearch] = useState("");
  const [hideArchived, setHideArchived] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (hideArchived && p.stage && ARCHIVE_STAGES.has(p.stage)) return false;
      if (!q) return true;
      const hay = [p.job_code, p.suburb, p.street_address, p.display_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [projects, search, hideArchived]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5 flex-1 min-w-[240px]">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Job code, suburb, address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="hideArchived"
            checked={hideArchived}
            onCheckedChange={setHideArchived}
          />
          <Label htmlFor="hideArchived" className="text-sm cursor-pointer">
            Hide archived
          </Label>
        </div>
        <div className="text-sm text-gray-500 pb-2">
          {filtered.length} / {projects.length}
        </div>
      </div>

      <div className="border border-gray-50 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral/40 hover:bg-neutral/40">
              <TableHead className="w-[140px]">Job code</TableHead>
              <TableHead>Display name</TableHead>
              <TableHead className="w-[120px]">Stage</TableHead>
              <TableHead className="w-[80px] text-center">Colour</TableHead>
              <TableHead className="w-[110px]">Start</TableHead>
              <TableHead className="w-[110px]">Finish</TableHead>
              <TableHead className="w-[110px] text-center">In roster</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <JobRow key={p.project_id} project={p} />
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                  No projects match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function JobRow({ project }: { project: RosterProject }) {
  const [displayName, setDisplayName] = useState(project.display_name ?? "");
  const [colour, setColour] = useState(project.colour);
  const [start, setStart] = useState(project.default_start_time?.slice(0, 5) ?? "");
  const [finish, setFinish] = useState(
    project.default_finish_time?.slice(0, 5) ?? "",
  );
  const [isPending, startTransition] = useTransition();

  function save(
    patch: Omit<Parameters<typeof upsertProjectRosterMeta>[0], "project_id">,
  ) {
    startTransition(async () => {
      const res = await upsertProjectRosterMeta({
        project_id: project.project_id,
        ...patch,
      });
      if (!res.ok) {
        toast.error(`Couldn't save: ${res.error}`);
      } else {
        toast.success("Saved", { duration: 1200 });
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">
        {project.job_code ?? "—"}
      </TableCell>
      <TableCell>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={() => {
            const v = displayName.trim() || null;
            if (v !== (project.display_name ?? null)) {
              save({ display_name: v });
            }
          }}
          placeholder={project.derived_label ?? ""}
          disabled={isPending}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        {project.stage ? (
          <Badge variant="outline" className="text-xs">
            {project.stage}
          </Badge>
        ) : (
          <span className="text-gray-500 text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <input
          type="color"
          value={colour}
          onChange={(e) => setColour(e.target.value)}
          onBlur={() => {
            if (colour !== project.colour) save({ colour });
          }}
          disabled={isPending}
          className="h-8 w-8 rounded border border-gray-50 cursor-pointer bg-transparent"
          title={colour}
        />
      </TableCell>
      <TableCell>
        <Input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          onBlur={() => {
            const v = start || null;
            const current = project.default_start_time?.slice(0, 5) ?? null;
            if (v !== current) save({ default_start_time: v });
          }}
          disabled={isPending}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          type="time"
          value={finish}
          onChange={(e) => setFinish(e.target.value)}
          onBlur={() => {
            const v = finish || null;
            const current = project.default_finish_time?.slice(0, 5) ?? null;
            if (v !== current) save({ default_finish_time: v });
          }}
          disabled={isPending}
          className="h-8"
        />
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={project.show_in_side_panel}
          onCheckedChange={(checked) =>
            save({ show_in_side_panel: checked })
          }
          disabled={isPending}
        />
      </TableCell>
    </TableRow>
  );
}
