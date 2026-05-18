import Link from "next/link";
import { Logo } from "@/app/_components/Logo";

export default function Home() {
  return (
    <main className="flex-1 grid place-items-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <div className="mb-12 flex justify-center">
          <Logo width={384} priority />
        </div>

        <h1 className="text-3xl sm:text-4xl font-medium leading-tight mb-3">
          Welcome.
        </h1>
        <p className="text-base text-gray-500 mb-10">
          Sign in to your Overland Builders Workspace.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login?role=team"
            className="inline-flex items-center justify-center rounded-pill bg-foreground text-background px-6 py-3 text-sm font-medium hover:bg-gray-700 transition no-underline"
          >
            Team sign-in
          </Link>
          <Link
            href="/login?role=client"
            className="inline-flex items-center justify-center rounded-pill border border-foreground text-foreground px-6 py-3 text-sm font-medium hover:bg-neutral transition no-underline"
          >
            Client sign-in
          </Link>
        </div>

        <p className="mt-14 text-xs text-gray-500">
          app.overlandbuilders.com.au
        </p>
      </div>
    </main>
  );
}
