import Image from "next/image";
import Link from "next/link";

type Props = {
  href?: string;
  /** Rendered width in px. Height is derived from the file's true 5:1 ratio. */
  width?: number;
  className?: string;
  priority?: boolean;
};

export function Logo({
  href = "/",
  width = 180,
  className,
  priority = false,
}: Props) {
  // Source file is exactly 300×60 (verified from the WebP header).
  // Pass intrinsic dims to next/image, then lock display size via inline style
  // so Tailwind's preflight (img { height: auto }) can't override.
  const img = (
    <Image
      src="/overland-logo.webp"
      alt="Overland Builders"
      width={300}
      height={60}
      priority={priority}
      style={{
        width: `${width}px`,
        maxWidth: "100%",
        height: "auto",
        aspectRatio: "5 / 1",
      }}
      className={className}
    />
  );
  return href ? (
    <Link href={href} className="inline-block leading-none">
      {img}
    </Link>
  ) : (
    img
  );
}
