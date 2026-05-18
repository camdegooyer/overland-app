import Link from "next/link";
import { Logo } from "@/app/_components/Logo";

type SearchParams = Promise<{ email?: string; role?: string }>;

export default async function SentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { email, role } = await searchParams;

  return (
    <main className="flex-1 grid place-items-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <div className="mb-10 flex justify-center">
          <Logo width={384} />
        </div>

        <h1 className="text-2xl font-medium mb-3">Check your inbox</h1>
        <p className="text-sm text-gray-500">
          We sent a sign-in link to{" "}
          <span className="text-foreground font-medium">
            {email ?? "your email"}
          </span>
          . Open it on this device to continue.
        </p>

        <div className="mt-8">
          <Link
            href={`/login?role=${role ?? "client"}`}
            className="text-sm text-foreground underline underline-offset-[3px] decoration-2 hover:no-underline"
          >
            Use a different email
          </Link>
        </div>
      </div>
    </main>
  );
}
