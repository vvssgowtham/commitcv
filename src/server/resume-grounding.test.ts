import { describe, expect, test } from "vitest";
import { groundBullets, isGrounded, numbersIn, sourceLines, termsIn } from "./resume-grounding";

describe("isGrounded", () => {
  const line = "Reduced p95 API latency from 900ms to 350ms with Redis caching";

  test("accepts a rephrase that keeps the facts", () => {
    expect(isGrounded("Cut p95 API latency from 900ms to 350ms using Redis caching", line)).toBe(true);
    expect(isGrounded("Improved APIs through caching", line)).toBe(true); // plural of a source term
  });

  test("rejects invented numbers", () => {
    expect(isGrounded("Cut API latency by 61% with Redis caching", line)).toBe(false);
    expect(isGrounded("Reduced latency for 2M users with Redis", line)).toBe(false);
  });

  test("rejects invented technologies and names, including ones hiding in common words", () => {
    expect(isGrounded("Reduced API latency with Redis and Kafka", line)).toBe(false);
    expect(isGrounded("Reduced latency at Stripe", line)).toBe(false);
    expect(isGrounded("Built good Go services", "Built good services")).toBe(false); // "Go" is not in "good"
  });

  test("first word may be capitalised without being a term", () => {
    expect(termsIn("Led migration of cron jobs")).toEqual([]);
    expect(termsIn("Led migration to AWS SQS and Node.js")).toEqual(["aws", "sqs", "node.js"]);
    expect(numbersIn("60% faster, 3.5x, 1,5 s")).toEqual(["60", "3.5", "1.5"]);
  });
});

describe("groundBullets", () => {
  const lines = ["Built analytics platform in Next.js serving 20k+ users", "Led migration of 40 cron jobs to AWS SQS"];

  test("keeps grounded rewrites, replaces embellished ones with the original line", () => {
    const r = groundBullets([
      { text: "Shipped a Next.js analytics platform used by 20k+ users", sourceLine: 0 },
      { text: "Migrated 45 cron jobs to Kafka", sourceLine: 1 },
    ], lines, "", 5);
    expect(r.bullets).toEqual(["Shipped a Next.js analytics platform used by 20k+ users", lines[1]]);
    expect(r.replaced).toBe(1);
  });

  test("drops bullets citing missing or repeated lines; respects max", () => {
    const r = groundBullets([
      { text: "x", sourceLine: 7 }, { text: "Built platform", sourceLine: 0 }, { text: "Built it again", sourceLine: 0 },
    ], lines, "", 5);
    expect(r).toMatchObject({ bullets: ["Built platform"], dropped: 2 });
    expect(groundBullets([{ text: "a", sourceLine: 0 }, { text: "b", sourceLine: 1 }], lines, "", 1).bullets).toHaveLength(1);
  });

  test("extras (e.g. the user's skills) can back a term", () => {
    expect(groundBullets([{ text: "Built platform in TypeScript", sourceLine: 0 }], lines, "TypeScript", 5).replaced).toBe(0);
  });
});

test("sourceLines strips bullet characters and blanks", () => {
  expect(sourceLines("• one\n\n- two\r\n* three")).toEqual(["one", "two", "three"]);
});

test("sourceLines splits a merged paragraph into sentences without breaking Node.js or 2,000+", () => {
  expect(sourceLines("Built X with Node.js , serving 2,000+ users at a 96%+ success rate . Refactored APIs into Kafka. Led migration to Java 17.")).toEqual([
    "Built X with Node.js, serving 2,000+ users at a 96%+ success rate.",
    "Refactored APIs into Kafka.",
    "Led migration to Java 17.",
  ]);
});

test("a bullet citing code keeps numbers only inside names copied from that code", () => {
  const code = "code deploy.sh:1-9: DB_ENC_KEY must be exactly 16 chars for AES-128; FROM node22";
  const g = (text: string) => groundBullets([{ text, sourceLine: 0 }], [code], "", 3, new Set([0]));
  expect(g("Enforced an AES-128 key length for DB_ENC_KEY").bullets).toHaveLength(1);
  expect(g("Deployed 10,000 instances with AES-128").bullets).toHaveLength(0); // bare figure: dropped, not replaced
  expect(g("Hardened a Kubernetes cluster").dropped).toBe(1); // name not in the code
});

test("groundBullets never cuts a long bullet mid-sentence — it falls back to the whole source line", () => {
  const line = "Built a service with Kafka.";
  const r = groundBullets([{ text: `Built a service with Kafka ${"and more ".repeat(40)}`, sourceLine: 0 }], [line], "", 5);
  expect(r.bullets).toEqual([line]);
});
