import { describe, expect, test } from "vitest";
import { extractReadableText, isBlockedAddress } from "./safe-fetch";

describe("isBlockedAddress", () => {
  test("allows ordinary public addresses", () => {
    expect(isBlockedAddress("93.184.216.34")).toBe(false); // example.com
    expect(isBlockedAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false); // example.com, IPv6
  });

  test("blocks loopback, private and link-local ranges", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("10.0.0.1")).toBe(true);
    expect(isBlockedAddress("192.168.1.1")).toBe(true);
    expect(isBlockedAddress("172.16.0.1")).toBe(true);
    expect(isBlockedAddress("169.254.169.254")).toBe(true); // cloud metadata endpoint
    expect(isBlockedAddress("::1")).toBe(true);
    expect(isBlockedAddress("fe80::1")).toBe(true);
    expect(isBlockedAddress("fc00::1")).toBe(true); // unique local, IPv6's "private"
  });

  test("blocks IPv4-mapped IPv6 addresses hiding a private address (a known SSRF bypass)", () => {
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::ffff:93.184.216.34")).toBe(false); // mapped but genuinely public
  });

  test("blocks malformed input instead of throwing", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });
});

describe("extractReadableText", () => {
  test("keeps visible text, drops script/style/nav/footer", () => {
    const html = `<html><body>
      <nav>Home | About</nav>
      <script>trackVisit()</script>
      <style>.x{color:red}</style>
      <h1>Backend Engineer</h1>
      <p>We build payment infrastructure.</p>
      <footer>© 2026</footer>
    </body></html>`;
    const text = extractReadableText(html);
    expect(text).toContain("Backend Engineer");
    expect(text).toContain("We build payment infrastructure.");
    expect(text).not.toContain("trackVisit");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("Home | About");
    expect(text).not.toContain("© 2026");
  });

  test("collapses excess whitespace", () => {
    expect(extractReadableText("<body>  a  \n\n\n\n  b  </body>")).toBe("a \n\n b");
  });
});
