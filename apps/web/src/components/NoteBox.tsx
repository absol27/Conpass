"use client";
import { useId } from "react";
import { useStore } from "@/lib/store";
import { Button } from "./ui";

/**
 * Your private note about someone you met: what you talked about, what to follow up on.
 * Saves as you type, to this device only.
 */
export function NoteBox({ userId, name, autoFocus = false, onDone }: { userId: string; name: string; autoFocus?: boolean; onDone?: () => void }) {
  const id = useId();
  const text = useStore((s) => s.notes[userId]?.text ?? "");
  const setNote = useStore((s) => s.setNote);
  const firstName = name.split(" ")[0];

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-[var(--brand)]">
        📝 Note about {firstName}
      </label>
      <textarea
        id={id}
        rows={3}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setNote(userId, e.target.value)}
        placeholder={`What did you talk about? Anything to follow up on with ${firstName}?`}
        className="mt-1 w-full resize-y rounded-xl border border-[var(--line)] bg-white/70 p-3 text-sm outline-none focus:border-[var(--brand)]"
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--muted)]">🔒 Only you can see this. It&apos;s saved on this device as you type.</span>
        {onDone && (
          <Button variant="secondary" onClick={onDone} className="min-h-11">
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
