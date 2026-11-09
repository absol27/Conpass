"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { api, useHydrated } from "@/lib/client";
import { dayLabel, dayOf, fmtTime, ms } from "@/lib/time";
import type { Connection } from "@/lib/types";
import { Button, Card } from "@/components/ui";
import { Tag } from "@/components/Tag";
import { NoteBox } from "@/components/NoteBox";

/** Everyone you met, with where and when and your own notes, so you can reach out after the conference. */
export default function People() {
  const hydrated = useHydrated();
  const userId = useStore((s) => s.profile.userId);
  const notes = useStore((s) => s.notes);
  const [list, setList] = useState<Connection[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    api<{ connections: Connection[] }>(`/api/connections?userId=${userId}`).then((r) => setList(r.connections)).catch(() => setList([]));
  }, [hydrated, userId]);

  if (!hydrated || !list) return null;

  // one row per person; prefer the contact exchange (it carries the card)
  const people = new Map<string, Connection>();
  for (const c of list) if (!people.has(c.other) || c.type === "contact") people.set(c.other, c);
  const byDay = new Map<string, Connection[]>();
  for (const c of [...people.values()].sort((a, b) => ms(b.at) - ms(a.at))) {
    const d = dayOf(ms(c.at));
    const key = d ? dayLabel(d) : "Before the conference";
    byDay.set(key, [...(byDay.get(key) ?? []), c]);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">People I met</h1>
        <p className="text-sm text-[var(--muted)]">Every scan is remembered with the talk or activity you were at, plus your own notes, so you know who&apos;s who.</p>
      </div>
      {people.size === 0 && (
        <Card className="flex items-center gap-4 text-sm">
          <Tag pose="look" size={72} />
          <span>No one yet. Open <Link href="/share" className="underline">Share</Link> and let someone scan your code.</span>
        </Card>
      )}
      {[...byDay.entries()].map(([label, items]) => (
        <section key={label}>
          <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">{label}</h2>
          <div className="space-y-2">
            {items.map((c) => {
              const note = notes[c.other]?.text.trim();
              return (
                <Card key={c.other}>
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gray-100 font-bold">{c.card.name.slice(0, 1)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{c.card.name}</div>
                      <div className="text-xs text-[var(--muted)]">{[c.card.role, c.card.company].filter(Boolean).join(" · ")}</div>
                      <div className="mt-0.5 text-xs">📍 {c.contextLabel} · {fmtTime(c.at)}</div>
                    </div>
                    {c.card.linkedin ? (
                      <a href={c.card.linkedin} target="_blank" rel="noreferrer"><Button variant="secondary">LinkedIn</Button></a>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">{c.type === "schedule" ? "Schedule shared" : "No LinkedIn"}</span>
                    )}
                  </div>

                  {editing === c.other ? (
                    <div className="mt-3">
                      <NoteBox userId={c.other} name={c.card.name} autoFocus onDone={() => setEditing(null)} />
                    </div>
                  ) : note ? (
                    <button
                      onClick={() => setEditing(c.other)}
                      className="mt-3 block min-h-11 w-full rounded-xl bg-[var(--lead)]/50 px-3 py-2 text-left text-sm whitespace-pre-wrap transition hover:bg-[var(--lead)]/70"
                      aria-label={`Edit your note about ${c.card.name}`}
                    >
                      📝 {note}
                      <span className="mt-1 block text-[11px] text-[var(--muted)]">Tap to edit</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditing(c.other)}
                      className="mt-3 min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--brand)] transition hover:bg-white/60"
                    >
                      + Add a note
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
