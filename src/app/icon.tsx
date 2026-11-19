import { ImageResponse } from "next/og";

// Browser tab icon — same mark as components/logo.tsx (mint square, black "C"), generated so it
// never drifts from the header logo. Next.js wires the <link rel="icon"> tag automatically.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#00f0a0", borderRadius: 7, fontFamily: "sans-serif", fontSize: 20, fontWeight: 700, color: "#000",
        }}
      >
        C
      </div>
    ),
    size,
  );
}
