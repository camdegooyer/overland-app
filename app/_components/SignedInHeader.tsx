import { Logo } from "./Logo";

type Props = {
  area: "Team" | "Client portal";
  displayName: string | null;
  email: string;
};

export function SignedInHeader({ area, displayName, email }: Props) {
  return (
    <header className="border-b border-gray-50 bg-background">
      <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Logo width={150} />
          <span className="hidden sm:inline text-sm text-gray-500">
            / {area}
          </span>
        </div>

        <div className="flex items-center gap-5 text-sm">
          <span className="text-gray-500 hidden sm:inline">
            {displayName ?? email}
          </span>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="text-sm text-foreground underline underline-offset-[3px] decoration-2 hover:no-underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
