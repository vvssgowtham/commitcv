"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, Lock, Plus, RefreshCw } from "lucide-react";
import { reparsedResume, type Profile } from "@/lib/mock-data";
import { applyChanges, diffResume, type Change } from "@/lib/resume-merge";

// Re-upload a newer resume and review what changes before anything touches the profile.
// design/notion.md: utility button (8px, hairline), modal = feature-card chrome + elevated shadow, one blue action.

const sectionName: Record<string, string> = { experience: "Experience", education: "Education", projects: "Projects", certifications: "Certifications", awards: "Awards" };

export function ResumeReimport({ profile, onApply }: { profile: Profile; onApply: (next: Profile) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [changes, setChanges] = useState<Change[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function pick(f: File | undefined) {
    if (!f) return;
    setFileName(f.name);
    setParsing(true);
    // shortcut: simulated parse returning mock data; replace with upload + parse call.
    setTimeout(() => {
      const c = diffResume(profile, reparsedResume);
      setChanges(c);
      setPicked(new Set(c.filter((x) => x.kind !== "kept").map((x) => x.id)));
      setParsing(false);
      dialog.current?.showModal();
    }, 1200);
  }

  function apply() {
    onApply(applyChanges(profile, changes.filter((c) => picked.has(c.id)), () => crypto.randomUUID()));
    dialog.current?.close();
  }

  function toggle(id: string) {
    const next = new Set(picked);
    if (!next.delete(id)) next.add(id);
    setPicked(next);
  }

  const actionable = changes.filter((c) => c.kind !== "kept");
  const kept = changes.filter((c) => c.kind === "kept");

  return (
    <>
      <button onClick={() => input.current?.click()} disabled={parsing}
        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-no-hairline bg-white px-3.5 py-1.5 text-sm font-medium text-no-ink hover:bg-black/[0.03] disabled:opacity-60">
        {parsing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
        {parsing ? "Reading resume…" : "Update from resume"}
      </button>
      <input ref={input} type="file" accept=".pdf,.doc,.docx" className="sr-only" aria-label="Upload updated resume"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

      <dialog ref={dialog} aria-labelledby="reimport-h"
        className="m-auto w-[min(640px,calc(100vw-32px))] rounded-2xl border border-no-hairline bg-white p-0 text-no-ink shadow-[0_23px_52px_rgba(0,0,0,0.12)] backdrop:bg-black/30">
        <div className="max-h-[80dvh] overflow-y-auto p-6">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-no-ink-muted"><FileUp className="size-3.5" aria-hidden />{fileName}</p>
          <h2 id="reimport-h" className="mt-2 text-[22px] leading-tight font-bold tracking-[-0.25px]">Review changes</h2>
          <p className="mt-1 text-[15px] text-no-ink-muted">
            {actionable.length ? "Pick what to bring into your profile. Anything you added or edited yourself stays as it is." : "This resume matches your profile — nothing new to add."}
          </p>

          {actionable.length > 0 && (
            <ul className="mt-5 divide-y divide-no-hairline rounded-xl border border-no-hairline">
              {actionable.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer gap-3 p-4 hover:bg-black/[0.02]">
                    <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="mt-1 size-4 accent-no-blue" />
                    <span className="min-w-0 flex-1 text-[15px]">
                      <span className="flex items-center gap-2">
                        <Badge kind={c.kind} />
                        <span className="font-semibold">{c.kind === "summary" ? "Summary" : c.label}</span>
                        {"section" in c && <span className="text-sm text-no-ink-faint">{sectionName[c.section]}</span>}
                        {c.kind === "skill" && <span className="text-sm text-no-ink-faint">Skills</span>}
                      </span>
                      {c.kind === "summary" && (
                        <span className="mt-2 grid gap-2 text-sm">
                          <span className="rounded-md bg-no-canvas p-2 text-no-ink-muted line-through decoration-no-ink-faint">{c.before}</span>
                          <span className="rounded-md bg-no-canvas p-2">{c.after}</span>
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {kept.length > 0 && (
            <div className="mt-4 rounded-xl bg-no-canvas p-4 text-sm">
              <p className="flex items-center gap-1.5 font-semibold"><Lock className="size-3.5" aria-hidden /> Kept your edits</p>
              <ul className="mt-2 space-y-1 text-no-ink-muted">
                {kept.map((c) => <li key={c.id}>{c.label} <span className="text-no-ink-faint">· {sectionName[c.section]}</span></li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-no-hairline px-6 py-4">
          <button onClick={() => dialog.current?.close()} className="rounded-lg px-3.5 py-1.5 text-sm font-medium hover:bg-black/[0.04]">Cancel</button>
          {actionable.length > 0 && (
            <button onClick={apply} disabled={picked.size === 0} className="rounded-full bg-no-blue px-5 py-2 font-medium text-white active:bg-no-blue-active disabled:opacity-40">
              Apply {picked.size} {picked.size === 1 ? "change" : "changes"}
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}

function Badge({ kind }: { kind: Change["kind"] }) {
  const isUpdate = kind === "update" || kind === "summary";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${isUpdate ? "bg-no-purple/40 text-[#391c57]" : "bg-no-green/15 text-[#0f6b24]"}`}>
      {isUpdate ? <RefreshCw className="size-3" aria-hidden /> : <Plus className="size-3" aria-hidden />}
      {isUpdate ? "Update" : "New"}
    </span>
  );
}
