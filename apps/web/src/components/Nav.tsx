"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tag } from "./Tag";

const LINKS = [
  { href: "/plan/1", match: "/plan", label: "Plan" },
  { href: "/live", match: "/live", label: "Live" },
  { href: "/share", match: "/share", label: "Share" },
  { href: "/people", match: "/people", label: "People" },
];

export function Nav() {
  const path = usePathname();
  // The welcome page is the conference picker: no header there, so Tag and the picker stand alone.
  if (path === "/") return null;
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2" title="Choose a conference">
            <Tag pose="wave" size={34} />
            <span className="text-xl font-extrabold tracking-[-0.04em] text-[var(--brand)]">
              C<span className="text-[var(--accent)]">o</span>npass
            </span>
          </Link>
          <Link href="/kubecon" className="hidden text-xs font-medium text-[var(--muted)] hover:text-[var(--brand)] sm:inline">
            KubeCon NA 2026
          </Link>
        </div>
        <nav className="ml-auto flex gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 ${path.startsWith(l.match) ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:bg-gray-100"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
