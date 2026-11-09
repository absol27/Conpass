"use client";
import Link from "next/link";
import { conference } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/client";
import { Tag, type TagPose } from "@/components/Tag";
import { TopicBubbles } from "@/components/TopicBubbles";

/** KubeCon overview (opened from the Conpass welcome page): what the conference is about and its main topic areas. */
export default function KubeConHome() {
  const hydrated = useHydrated();
  const onboarded = useStore((s) => s.onboarded);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b2a5c] via-[#113e82] to-[#1d4f9c] p-8 text-white sm:p-12">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--accent)]/25 blur-2xl" />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center">
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--lead)]">
              {conference.city} · {conference.days[0].label} – {conference.days.at(-1)!.label}
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl leading-tight text-white sm:text-5xl">{conference.name}</h1>
            <p className="mt-4 max-w-2xl text-white/85">{conference.tagline}</p>
            <p className="mt-2 max-w-2xl text-sm text-white/70">{conference.about}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/onboarding" className="rounded-xl bg-[var(--lead)] px-5 py-3 font-bold text-[var(--ink)] hover:brightness-105">
                {hydrated && onboarded ? "Edit my interests" : "Plan my KubeCon →"}
              </Link>
              {hydrated && onboarded && (
                <Link href="/plan/1" className="rounded-xl border border-white/40 px-5 py-3 font-semibold hover:bg-white/10">
                  Continue my schedule
                </Link>
              )}
            </div>
          </div>
          <div className="hidden flex-col items-center sm:flex">
            <Tag pose="wave" size={190} />
            <p className="mt-1 text-sm font-semibold text-white/85">Hi, I&apos;m Tag. I&apos;ll keep your day simple.</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[var(--brand)]">What&apos;s on</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Ten tracks across three days, plus the expo, project pavilion and lots of hallway track.</p>
        <div className="mt-6">
          <TopicBubbles />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        {(
          [
            ["point", "Talks that fit", "Suggestions account for walking time between rooms."],
            ["look", "See every option", "Even clashing talks: swap one in and backtrack only as far as you choose."],
            ["walk", "Live re-plans", "Missed a talk or room full? Get options that fit the gap."],
            ["wink", "Hallway track", "Scan someone to find shared talks, meetups and themed lunches."],
          ] as [TagPose, string, string][]
        ).map(([pose, title, text]) => (
          <div key={title} className="glass rounded-2xl p-4 text-sm">
            <Tag pose={pose} size={56} />
            <div className="mt-2 font-semibold text-[var(--brand)]">{title}</div>
            <div className="text-[var(--muted)]">{text}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
