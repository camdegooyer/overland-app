import { redirect } from "next/navigation";
import { Logo } from "@/app/_components/Logo";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/auth/role";

export default async function DashboardRouter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  const { role, displayName } = await resolveRole(user.email);

  if (role === "team") redirect("/team");
  if (role === "client") redirect("/portal");

  return (
    <main className="flex-1 grid place-items-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-10 flex justify-center">
          <Logo width={180} />
        </div>

        <h1 className="text-2xl font-medium mb-3">
          {displayName ? `Hi ${displayName.split(" ")[0]},` : "Hi,"} we
          couldn&apos;t match this email to an Overland record.
        </h1>
        <p className="text-sm text-gray-500 mb-2">
          Signed in as{" "}
          <span className="text-foreground font-medium">{user.email}</span>.
        </p>
        <p className="text-sm text-gray-500">
          If you&apos;re expecting access, contact{" "}
          <a
            className="text-foreground underline underline-offset-[3px] decoration-2 hover:no-underline"
            href="mailto:admin@overlandbuilders.com.au"
          >
            admin@overlandbuilders.com.au
          </a>
          .
        </p>

        <form action="/auth/sign-out" method="post" className="mt-10">
          <button
            type="submit"
            className="rounded-pill border border-foreground text-foreground px-6 py-2.5 text-sm font-medium hover:bg-neutral transition"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
