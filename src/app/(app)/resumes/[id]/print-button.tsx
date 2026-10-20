"use client";

import { Download } from "lucide-react";

// shortcut: browser print-to-PDF; swap for the server-rendered PDF (pdf_file_key) when the backend lands.
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700">
      <Download className="size-4" aria-hidden /> Download PDF
    </button>
  );
}
