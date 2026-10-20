// The "no fake data" gate for generated resumes. The model may only rephrase lines the user wrote;
// anything it adds — a number, a technology, a name — that its source doesn't contain is rejected and
// the user's original line is used instead. Pure functions, unit-tested.

/** Numeric facts: "60%", "20k+", "3.5x", "2023". Compared by their digits so "60 %" == "60%". */
export function numbersIn(text: string) {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", "."));
}

const words = (text: string) => text.match(/[A-Za-z][A-Za-z0-9+#.\-/]*[A-Za-z0-9+#]|[A-Za-z]/g) ?? [];

/**
 * Terms worth checking: anything with a capital letter after the first word, a digit or a code-ish symbol
 * (Kafka, AWS, Node.js, C++, GraphQL, K8s). Plain lowercase English words are allowed through.
 */
export function termsIn(text: string) {
  return words(text)
    .filter((w, i) => (i > 0 && /[A-Z]/.test(w)) || /[0-9+#./]/.test(w) || /[A-Z].*[A-Z]/.test(w))
    .map((w) => w.toLowerCase());
}

/** True when every number and every term in `text` also appears (as a whole word) in `corpus`. */
export function isGrounded(text: string, corpus: string) {
  const known = new Set(words(corpus).map((w) => w.toLowerCase()));
  const has = (t: string) => known.has(t) || known.has(t.replace(/s$/, "")) || known.has(`${t}s`); // API ↔ APIs
  const cNumbers = new Set(numbersIn(corpus));
  return numbersIn(text).every((n) => cNumbers.has(n)) && termsIn(text).every(has);
}

export type Bullet = { text: string; sourceLine: number };

/**
 * Ground one item's bullets against its own source lines.
 * Each bullet must cite a real line; if it adds facts that line (plus the allowed extras) lacks,
 * the original line is used verbatim. Returns final bullets and how many were replaced/dropped.
 */
export function groundBullets(bullets: Bullet[], lines: string[], extras: string, max: number) {
  const out: string[] = [];
  let replaced = 0;
  let dropped = 0;
  const usedLines = new Set<number>();
  for (const b of bullets) {
    const line = lines[b.sourceLine];
    if (line === undefined || usedLines.has(b.sourceLine)) { dropped++; continue; }
    usedLines.add(b.sourceLine);
    const text = b.text.trim();
    // Too long to be a bullet: use the user's own line whole rather than cutting the model's mid-sentence.
    if (text && text.length <= 300 && isGrounded(text, `${line}\n${extras}`)) out.push(text);
    else { out.push(line); replaced++; }
    if (out.length === max) break;
  }
  return { bullets: out, replaced, dropped };
}

/** Split a free-text description into the lines the model may cite: one per line, and one per sentence
 * when a line holds a whole paragraph — resume parsing often merges a role's bullets into one. */
export const sourceLines = (text: string) =>
  text.split(/\r?\n/)
    .flatMap((l) => l.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map((l) => l.replace(/^\s*[-*•·]\s*/, "").replace(/\s+([,.;:!?])/g, "$1").trim())
    .filter(Boolean);
