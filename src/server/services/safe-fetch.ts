import https from "node:https";
import dns from "node:dns";
import type { LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";
import * as cheerio from "cheerio";

// Fetches a user-supplied URL (a pasted job posting link) safely. Native fetch/undici has no
// documented way to pin DNS resolution, and several real CVEs trace to exactly that gap
// (DNS rebinding, IPv4-mapped-IPv6 bypasses). We use the classic https.request API instead,
// whose `lookup` option is the officially documented hook, and our lookup is also the thing
// that actually resolves the address used to connect — so there is no check-then-connect gap.

export class UnsafeUrlError extends Error {}

const MAX_BYTES = 3_000_000; // 3 MB
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

/** Only plain public unicast addresses may be connected to. Everything else — private, loopback,
 * link-local (incl. the 169.254.169.254 cloud metadata address), multicast, reserved — is blocked.
 * `ipaddr.process` unwraps IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) to plain IPv4 first, closing
 * that bypass class before classification. */
export function isBlockedAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return true;
  return ipaddr.process(address).range() !== "unicast";
}

export const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { family: options.family, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const safe = addresses.filter((a) => !isBlockedAddress(a.address));
    if (!safe.length) return callback(new Error(`"${hostname}" does not resolve to a public address`), "", 0);
    // Node's happy-eyeballs (autoSelectFamily, default since v20) asks with `all: true` and expects an array.
    if (options.all) return callback(null, safe);
    callback(null, safe[0].address, safe[0].family);
  });
};

function get(url: URL): Promise<{ status: number; location?: string; body?: Buffer; contentType?: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: "GET", lookup: safeLookup, timeout: TIMEOUT_MS, headers: { "user-agent": "CommitCV/1.0 (+job posting fetch)" } },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: res.headers.location });
        }
        if (status !== 200) {
          res.resume();
          return resolve({ status });
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_BYTES) req.destroy(new Error("Response too large"));
          else chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, body: Buffer.concat(chunks), contentType: res.headers["content-type"] }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    req.end();
  });
}

/** Fetch a public https:// URL's raw body. Redirects are followed one hop at a time, re-validating
 * the new host on every hop, so a redirect can't be used to reach an internal address. */
export async function fetchPublicUrl(rawUrl: string): Promise<{ body: string; contentType: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid URL.");
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "https:") throw new UnsafeUrlError("Only https:// links are supported.");
    const result = await get(url);
    if (result.location) {
      url = new URL(result.location, url);
      continue;
    }
    if (result.status !== 200 || !result.body) throw new UnsafeUrlError(`The page returned an error (status ${result.status}).`);
    return { body: result.body.toString("utf8"), contentType: result.contentType ?? "" };
  }
  throw new UnsafeUrlError("Too many redirects.");
}

/** Strip an HTML page down to its visible text. */
export function extractReadableText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer, header, iframe, template").remove();
  const text = $("body").text() || $.root().text();
  return text.replace(/[ \t]+/g, " ").replace(/\n[ \t]*\n+/g, "\n\n").trim();
}
