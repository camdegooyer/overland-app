import Link from "next/link";
import { Logo } from "@/app/_components/Logo";
import { sendMagicLink } from "./actions";

type SearchParams = Promise<{
  role?: string;
  redirect?: string;
  error?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const role = params.role === "team" ? "team" : "client";
  const headline = role === "team" ? "Team sign-in" : "Client sign-in";
  const blurb =
    role === "team"
      ? "Enter your Overland email to receive a sign-in link."
      : "Enter the email you use with Overland to receive a sign-in link.";

  return (
    <main className="flex-1 grid place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <Logo width={384} />
        </div>

        <h1 className="text-2xl font-medium mb-2">{headline}</h1>
        <p className="text-sm text-gray-500 mb-8">{blurb}</p>

        <form action={sendMagicLink} className="space-y-4">
          <input type="hidden" name="role" value={role} />
          <input
            type="hidden"
            name="redirect"
            value={params.redirect ?? "/dashboard"}
          />

          <label className="block">
            <span className="block text-sm font-medium mb-2">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-gray-100 bg-background px-4 py-3 text-base outline-none focus:border-foreground transition"
              placeholder="you@example.com"
            />
          </label>

          {params.error && (
            <p className="text-sm text-[var(--gray-700)]">{params.error}</p>
          )}

          <button
            type="submit"
            className="w-full rounded-pill bg-foreground text-background py-3 text-sm font-medium hover:bg-gray-700 transition"
          >
            Send sign-in link
          </button>
        </form>

        <p className="mt-6 text-xs text-gray-500">
          We&apos;ll email you a single-use link. No password needed.
        </p>

        <div className="mt-8">
          <Link
            href="/"
            className="text-sm text-foreground underline underline-offset-[3px] decoration-2 hover:no-underline"
          >
            ← Back
          </Link>
        </div>
      </div>
    </main>
  );
}
