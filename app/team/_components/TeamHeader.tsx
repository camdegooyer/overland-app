import { Logo } from "@/app/_components/Logo";

type Props = {
  displayName: string | null;
  email: string;
};

export function TeamHeader({ displayName, email }: Props) {
  return (
    <header className="border-b border-gray-50 bg-background">
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        <Logo width={180} />
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
