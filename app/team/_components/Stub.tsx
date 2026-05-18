type Props = {
  title: string;
  phase: number;
  description?: string;
};

export function Stub({ title, phase, description }: Props) {
  return (
    <div className="max-w-[1280px] mx-auto px-6 py-16">
      <div className="text-xs uppercase tracking-wider text-brand mb-3">
        Phase {phase}
      </div>
      <h1 className="text-3xl sm:text-4xl font-medium mb-3">{title}</h1>
      <p className="text-gray-500 max-w-xl">
        {description ?? "Coming soon — this page is a placeholder."}
      </p>
    </div>
  );
}
