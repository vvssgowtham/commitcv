import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-jr-mint text-sm text-black">R</span>
      <span className="text-black">Resumate</span>
    </Link>
  );
}
