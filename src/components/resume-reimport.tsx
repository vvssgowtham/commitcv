"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, Lock, Plus, RefreshCw } from "lucide-react";
import type { Profile } from "@/lib/profile";
import type { Change } from "@/lib/resume-merge";
import { applyResume, uploadResume } from "@/server/actions/profile";

// Re-upload a newer resume and review what changes before anything touches the profile.
// design/notion.md: utility button (8px, hairline), modal = feature-card chrome + elevated shadow, one blue action.

const sectionName: Record<string, string> = { experience: "Experience", education: "Education", projects: "Projects", certifications: "Certifications", awards: "Awards" };

// `disabled` while the editor has unsaved edits: applying works on the saved profile, so it would discard them.
export function ResumeReimport({ disabled, onApplied }: { disabled: boolean; onApplied: (saved: Profile) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [changes, setChanges] = useState<Change[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [resumeId, setResumeId] = useState("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  async function pick(f: File | undefined) {
    if (!f) return;
    setFileName(f.name);
    setError("");
    setParsing(true);
    const form = new FormData();
    form.set("file", f);
    const res = await uploadResume(form);
    setParsing(false);
    if (!res.ok) return setError(res.error);
    setResumeId(res.data.resumeId);
    setChanges(res.data.changes);
    setPicked(new Set(res.data.changes.filter((x) => x.kind !== "kept").map((x) => x.id)));
    dialog.current?.showModal();
  }

  async function apply() {
    setApplying(true);
    const res = await applyResume(resumeId, [...picked]);
    setApplying(false);
    if (!res.ok) return setError(res.error);
    onApplied(res.data);
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
      <div className="flex max-w-xs flex-col items-end gap-2 text-right">
        <button onClick={() => input.current?.click()} disabled={parsing || disabled} title={disabled ? "Save your changes first" : undefined}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-no-hairline bg-white px-3.5 py-1.5 text-sm font-medium text-no-ink hover:bg-black/[0.03] disabled:opacity-60">
          {parsing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
          {parsing ? "Reading resume…" : "Update from resume"}
        </button>
        {error && !parsing && <p role="alert" className="text-sm text-[#793400]">{error}</p>}
      </div>
      <input ref={input} type="file" accept=".pdf,.docx" className="sr-only" aria-label="Upload updated resume"
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
          {error && applying === false && resumeId && <p role="alert" className="mr-auto text-sm text-[#793400]">{error}</p>}
          <button onClick={() => dialog.current?.close()} className="rounded-lg px-3.5 py-1.5 text-sm font-medium hover:bg-black/[0.04]">Cancel</button>
          {actionable.length > 0 && (
            <button onClick={apply} disabled={picked.size === 0 || applying} className="rounded-full bg-no-blue px-5 py-2 font-medium text-white active:bg-no-blue-active disabled:opacity-40">
              {applying ? "Applying…" : `Apply ${picked.size} ${picked.size === 1 ? "change" : "changes"}`}
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
