import "server-only";
import { Document, Font, Link, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { contactItems, displayUrl, fmtMonth, toHref } from "@/lib/profile";
import type { ResumeDoc } from "@/server/generate";

// ATS-safe PDF: one column, standard headings, real selectable text, built-in Helvetica, no images or tables.

// react-pdf hyphenates by default ("github.com/vvssgowtham-" / "pre- venting"): wrong for names, URLs and parsers.
Font.registerHyphenationCallback((word) => [word]);

// The built-in Helvetica only has the Windows-1252 characters. Anything else is drawn as a wrong glyph or
// dropped — "→" printed as "’", and the model's non-breaking hyphen (U+2011) turned "multi‑tenant" into
// "multi tenant". Map the common ones to plain equivalents; drop the rest rather than print garbage.
const SUBSTITUTES: Record<string, string> = {
  "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2212": "-", "\u2192": "->", "\u27f6": "->", "\u21d2": "=>", "\u2794": "->", "\u279c": "->",
  "\u2190": "<-", "\u2194": "<->", "\u2265": ">=", "\u2264": "<=", "\u2260": "!=", "\u2248": "~", "\u2032": "'", "\u2033": '"',
  "\u00a0": " ", "\u202f": " ", "\u2009": " ", "\u200b": "", "\u2713": "", "\u2714": "", "\u2605": "*",
};
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export const pdfSafe = (s: string) =>
  [...s.normalize("NFC")].map((c) => SUBSTITUTES[c] ?? ((c.charCodeAt(0) < 0x100 || CP1252_EXTRA.includes(c)) ? c : "")).join("");

const st = StyleSheet.create({
  page: { paddingVertical: 32, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, lineHeight: 1.3, color: "#000" },
  name: { fontSize: 17, fontFamily: "Helvetica-Bold", textAlign: "center", lineHeight: 1.15 },
  // Contact details on one line, links on the next; each item is unbreakable and a line can only wrap
  // between items. Separators are spaced with margins: react-pdf trims spaces at the edge of a text run.
  contact: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 2, fontSize: 8.5 },
  contactItem: { flexDirection: "row" },
  sep: { marginHorizontal: 6 },
  section: { marginTop: 9 },
  heading: { fontSize: 9.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.8, borderBottomWidth: 0.75, borderBottomColor: "#000", paddingBottom: 2, marginBottom: 3 },
  // Left side wraps; the right side (dates, a URL) keeps its width, so the two can't overlap.
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowMain: { flex: 1, paddingRight: 10 },
  rowSide: { flexShrink: 0, textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  item: { marginTop: 4 },
  bullet: { flexDirection: "row", marginTop: 1, paddingLeft: 8 },
  dot: { width: 10 },
  bulletText: { flex: 1 },
  // Real link annotations, styled like the surrounding text so the page still prints and parses plainly.
  link: { color: "#000", textDecoration: "none" },
});

const range = (start: string, end: string) => (start ? `${fmtMonth(start)} – ${fmtMonth(end)}` : end ? fmtMonth(end) : "");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={st.section}>
      <Text style={st.heading}>{title}</Text>
      {children}
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return items.map((b, i) => (
    <View key={i} style={st.bullet} wrap={false}>
      <Text style={st.dot}>•</Text>
      <Text style={st.bulletText}>{pdfSafe(b)}</Text>
    </View>
  ));
}

/** An item's title line (left) and dates or URL (right). Never split from its first lines of content. */
function Row({ main, side }: { main: React.ReactNode; side: React.ReactNode }) {
  return (
    <View style={st.row} wrap={false} minPresenceAhead={28}>
      <Text style={st.rowMain}>{main}</Text>
      <Text style={st.rowSide}>{side}</Text>
    </View>
  );
}

export function ResumePdf({ doc }: { doc: ResumeDoc }) {
  const h = doc.header;
  return (
    <Document title={`${h.name} — Resume`} author={h.name}>
      <Page size="LETTER" style={st.page}>
        <Text style={st.name}>{pdfSafe(h.name)}</Text>
        {Object.values(Object.groupBy(contactItems(h), (c) => (c.href?.startsWith("http") ? "links" : "details"))).map((line, l) => (
          <View key={l} style={st.contact}>
            {line!.map((c, i) => (
              <View key={i} style={st.contactItem} wrap={false}>
                {i > 0 && <Text style={st.sep}>|</Text>}
                {c.href ? <Link src={c.href} style={st.link}>{pdfSafe(c.text)}</Link> : <Text>{pdfSafe(c.text)}</Text>}
              </View>
            ))}
          </View>
        ))}

        {doc.summary && <Section title="Summary"><Text>{pdfSafe(doc.summary)}</Text></Section>}

        {doc.skills.length > 0 && (
          <Section title="Skills">
            {doc.skills.map((g) => <Text key={g.category}><Text style={st.bold}>{pdfSafe(g.category)}: </Text>{pdfSafe(g.items.join(", "))}</Text>)}
          </Section>
        )}

        {doc.experience.length > 0 && (
          <Section title="Experience">
            {doc.experience.map((e, i) => (
              <View key={i} style={st.item}>
                <Row main={<Text style={st.bold}>{pdfSafe(`${e.title}, ${e.company}`)}</Text>} side={range(e.startDate, e.endDate)} />
                <Bullets items={e.bullets} />
              </View>
            ))}
          </Section>
        )}

        {doc.projects.length > 0 && (
          <Section title="Projects">
            {doc.projects.map((p, i) => (
              <View key={i} style={st.item}>
                <Row
                  main={<><Text style={st.bold}>{pdfSafe(p.name)}</Text>{p.tech.length ? pdfSafe(` | ${p.tech.join(", ")}`) : ""}</>}
                  side={p.url ? <Link src={toHref(p.url)} style={st.link}>{displayUrl(p.url)}</Link> : ""}
                />
                <Bullets items={p.bullets} />
              </View>
            ))}
          </Section>
        )}

        {doc.education.length > 0 && (
          <Section title="Education">
            {doc.education.map((e, i) => (
              <View key={i} style={st.item}>
                <Row
                  main={<><Text style={st.bold}>{pdfSafe(e.institution)}</Text>{pdfSafe(`${[e.degree, e.fieldOfStudy].filter(Boolean).length ? ` — ${[e.degree, e.fieldOfStudy].filter(Boolean).join(", ")}` : ""}${e.grade ? ` (${e.grade})` : ""}`)}</>}
                  side={range(e.startDate, e.endDate)}
                />
              </View>
            ))}
          </Section>
        )}

        {(doc.certifications.length > 0 || doc.awards.length > 0) && (
          <Section title="Certifications & Awards">
            <Bullets items={[
              ...doc.certifications.map((c) => [c.name, c.issuer, c.date && fmtMonth(c.date)].filter(Boolean).join(" — ")),
              ...doc.awards.map((a) => [a.name, a.issuer, a.date && fmtMonth(a.date)].filter(Boolean).join(" — ")),
            ]} />
          </Section>
        )}
      </Page>
    </Document>
  );
}

export async function renderResumePdf(doc: ResumeDoc) {
  return new Uint8Array(await renderToBuffer(<ResumePdf doc={doc} />));
}
