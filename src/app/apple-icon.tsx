import { ImageResponse } from "next/og";

// iOS home-screen icon — same mark, full-bleed (iOS applies its own corner mask, so no border-radius here).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#00f0a0", fontFamily: "sans-serif", fontSize: 110, fontWeight: 700, color: "#000",
        }}
      >
        C
      </div>
    ),
    size,
  );
}
