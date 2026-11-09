"use client";
import Link from "next/link";
import { conference } from "@/lib/data";
import { Tag } from "@/components/Tag";

/** Other conferences on the welcome screen. Only KubeCon has a real schedule in this demo. */
const COMING_SOON = [
  { name: "KubeCon + CloudNativeCon Europe 2027", topic: "Cloud native" },
  { name: "ElasticON", topic: "Search & observability" },
];

const soonCard = (c: (typeof COMING_SOON)[number]) => (
  <div key={c.name} aria-disabled className="glass cursor-not-allowed rounded-2xl p-5 text-left opacity-70">
    <span className="inline-block rounded-full bg-[var(--lead)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink)]">
      Coming soon
    </span>
    <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">{c.topic}</div>
    <div className="mt-1 font-bold leading-snug tracking-[-0.02em] text-[var(--brand)]">{c.name}</div>
  </div>
);

/** Welcome to Conpass: pick the conference you're attending. */
export default function Welcome() {
  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center py-12 text-center">
      <Tag pose="welcome" size={170} />
      <h1 className="mt-6 text-4xl tracking-[-0.05em] sm:text-5xl">
        Welcome to C<span className="text-[var(--accent)]">o</span>npass
      </h1>
      <p className="mt-2 text-lg font-medium text-[var(--muted)]">Conferences made simple.</p>

      <div className="mt-10 grid w-full max-w-4xl items-center gap-4 sm:grid-cols-3">
        {soonCard(COMING_SOON[0])}

        <Link
          href="/kubecon"
          className="group order-first flex flex-col items-start rounded-2xl bg-gradient-to-br from-[#0b2a5c] via-[#113e82] to-[#1d4f9c] p-6 text-left text-white shadow-lg ring-4 ring-[var(--lead)] transition hover:-translate-y-1 hover:shadow-xl sm:order-none sm:scale-105"
        >
          <span className="rounded-full bg-[var(--support)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink)]">
            Live schedule
          </span>
          <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-[var(--lead)]">
            {conference.city.split(",")[0]} · {conference.days[0].label} – {conference.days.at(-1)!.label}
          </div>
          <div className="mt-1 text-xl font-extrabold leading-tight tracking-[-0.03em]">{conference.name}</div>
          <span className="mt-5 inline-flex rounded-xl bg-[var(--lead)] px-4 py-2 text-sm font-bold text-[var(--ink)] transition group-hover:brightness-105">
            Open KubeCon →
          </span>
        </Link>

        {soonCard(COMING_SOON[1])}
      </div>
    </div>
  );
}
