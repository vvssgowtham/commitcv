"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { resumeDownloadUrl } from "@/server/actions/generate";

export function DownloadButton({ generationId }: { generationId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    const res = await resumeDownloadUrl(generationId);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    window.location.assign(res.data.url); // 5-minute signed link to the stored PDF
  }
  return (
    <span className="flex items-center gap-3">
      {error && <span role="alert" className="text-sm text-[#a31b1b]">{error}</span>}
      <button onClick={download} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />} Download PDF
      </button>
    </span>
  );
}
