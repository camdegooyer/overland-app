import { requireAdmin } from "@/lib/auth/guard";
import {
  getRosterDayDefaults,
  getRosterSettings,
} from "@/lib/roster/queries";
import { SettingsForm } from "./_components/SettingsForm";

export default async function RosterSettings() {
  await requireAdmin();
  const [settings, dayDefaults] = await Promise.all([
    getRosterSettings(),
    getRosterDayDefaults(),
  ]);

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-medium mb-2">
          Roster defaults
        </h1>
        <p className="text-gray-500 text-sm max-w-xl">
          Applied when a new employee-day card is created. Individual cards can
          still override times after creation.
        </p>
      </div>
      <SettingsForm initial={settings} dayDefaults={dayDefaults} />
    </div>
  );
}
