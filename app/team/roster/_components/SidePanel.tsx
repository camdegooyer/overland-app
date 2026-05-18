"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type {
  RosterEmployee,
  RosterOtherItem,
  RosterProject,
} from "@/lib/roster/types";
import { EmployeeSourceCard } from "./EmployeeSourceCard";
import { JobSourceCard } from "./JobSourceCard";
import { OtherSourceCard } from "./OtherSourceCard";

type Props = {
  employees: RosterEmployee[];
  projects: RosterProject[];
  otherItems: RosterOtherItem[];
};

export function SidePanel({ employees, projects, otherItems }: Props) {
  const [empQ, setEmpQ] = useState("");
  const [jobQ, setJobQ] = useState("");
  const [otherQ, setOtherQ] = useState("");

  const filteredEmployees = employees.filter((e) => {
    const q = empQ.trim().toLowerCase();
    if (!q) return true;
    const hay = [e.display_first_name, e.last_name, e.trade]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const filteredProjects = projects.filter((p) => {
    const q = jobQ.trim().toLowerCase();
    if (!q) return true;
    const hay = [p.job_code, p.suburb, p.display_name, p.derived_label]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const filteredOtherItems = otherItems.filter((o) => {
    const q = otherQ.trim().toLowerCase();
    if (!q) return true;
    return o.label.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="employees" className="flex flex-col h-full">
        <div className="px-3 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="employees" className="flex-1">
              Employees
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex-1">
              Jobs
            </TabsTrigger>
            <TabsTrigger value="other" className="flex-1">
              Other
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="employees" className="flex-1 min-h-0 flex flex-col p-3 pt-2">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
            <Input
              value={empQ}
              onChange={(e) => setEmpQ(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-8"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {filteredEmployees.map((e) => (
              <EmployeeSourceCard key={e.id} employee={e} />
            ))}
            {filteredEmployees.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">
                {employees.length === 0
                  ? "No employees ticked for roster yet. See /team/employees."
                  : "No matches."}
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="flex-1 min-h-0 flex flex-col p-3 pt-2">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
            <Input
              value={jobQ}
              onChange={(e) => setJobQ(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-8"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {filteredProjects.map((p) => (
              <JobSourceCard key={p.project_id} project={p} />
            ))}
            {filteredProjects.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">
                {projects.length === 0
                  ? "No projects ticked for roster yet. See /team/jobs."
                  : "No matches."}
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="other" className="flex-1 min-h-0 flex flex-col p-3 pt-2">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
            <Input
              value={otherQ}
              onChange={(e) => setOtherQ(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-8"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {filteredOtherItems.map((o) => (
              <OtherSourceCard key={o.id} item={o} />
            ))}
            {filteredOtherItems.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">
                {otherItems.length === 0
                  ? "No items yet."
                  : "No matches."}
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
