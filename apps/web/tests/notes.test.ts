import { describe, expect, it } from "vitest";
import { toAttendee, useStore } from "@/lib/store";

describe("notes about people you met", () => {
  it("saves, edits and deletes a note", () => {
    const { setNote } = useStore.getState();
    setNote("u-alex", "Works on eBPF at Acme");
    expect(useStore.getState().notes["u-alex"]?.text).toBe("Works on eBPF at Acme");
    setNote("u-alex", "Works on eBPF at Acme. Send them the Cilium talk");
    expect(useStore.getState().notes["u-alex"]?.text).toContain("Cilium");
    setNote("u-alex", "");
    expect(useStore.getState().notes["u-alex"]).toBeUndefined();
  });

  it("never sends notes to the server with your profile", () => {
    useStore.getState().setNote("u-sam", "Private: met at the security lunch");
    expect(JSON.stringify(toAttendee(useStore.getState()))).not.toContain("security lunch");
  });
});
