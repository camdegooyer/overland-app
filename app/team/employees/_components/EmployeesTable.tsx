"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import type { RosterEmployee } from "@/lib/roster/types";
import { updateEmployee } from "../_actions/employees";

type Props = { employees: RosterEmployee[] };

export function EmployeesTable({ employees }: Props) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-neutral/40 hover:bg-neutral/40">
            <TableHead>Name</TableHead>
            <TableHead className="w-[120px] text-center">In roster</TableHead>
            <TableHead className="w-[110px] text-center">Notify</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((e) => (
            <EmployeeRow key={e.id} employee={e} />
          ))}
          {employees.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                No current employees.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function EmployeeRow({ employee }: { employee: RosterEmployee }) {
  const [isPending, startTransition] = useTransition();

  const name =
    [employee.display_first_name, employee.last_name]
      .filter(Boolean)
      .join(" ") || "(no name)";

  function save(patch: Omit<Parameters<typeof updateEmployee>[0], "employee_id">) {
    startTransition(async () => {
      const res = await updateEmployee({
        employee_id: employee.id,
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
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell className="text-center">
        <Switch
          checked={employee.is_roster_employee}
          onCheckedChange={(checked) =>
            save({ is_roster_employee: checked })
          }
          disabled={isPending}
        />
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={employee.notify_enabled}
          onCheckedChange={(checked) => save({ notify_enabled: checked })}
          disabled={isPending}
          aria-label="Send shift notifications"
        />
      </TableCell>
    </TableRow>
  );
}
