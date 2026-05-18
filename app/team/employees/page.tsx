import { requireAdmin } from "@/lib/auth/guard";
import { getRosterEmployees } from "@/lib/roster/queries";
import { EmployeesTable } from "./_components/EmployeesTable";

export default async function EmployeesAdmin() {
  await requireAdmin();
  const allEmployees = await getRosterEmployees();
  const employees = allEmployees.filter((e) => e.is_active);

  const rosterCount = employees.filter((e) => e.is_roster_employee).length;

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-medium mb-2">Employees</h1>
        <p className="text-gray-500 text-sm">
          {employees.length} currently employed · {rosterCount} ticked for
          roster.
        </p>
      </div>

      <p className="text-sm text-gray-500 mb-6 max-w-2xl">
        Tick <span className="text-foreground">In roster</span> to include an
        employee in the roster board.{" "}
        <span className="text-foreground">Notify</span> controls whether they
        receive shift notifications. Changes save on toggle.
      </p>

      <EmployeesTable employees={employees} />
    </div>
  );
}
