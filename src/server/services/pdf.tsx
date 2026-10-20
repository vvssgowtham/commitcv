import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { fmtMonth } from "@/lib/profile";
import type { ResumeDoc } from "@/server/generate";

// ATS-safe PDF: one column, standard headings, real selectable text, built-in Helvetica, no images or tables.

const st = StyleSheet.create({
  page: { paddingVertical: 40, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.4, color: "#000" },
  name: { fontSize: 18, fontFamily: "Helvetica-Bold", textAlign: "center" },
  contact: { fontSize: 9, textAlign: "center", marginTop: 4 },
  section: { marginTop: 12 },
  heading: { fontSize: 10, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.8, borderBottomWidth: 0.75, borderBottomColor: "#000", paddingBottom: 2, marginBottom: 5 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  bold: { fontFamily: "Helvetica-Bold" },
  item: { marginTop: 5 },
  bullet: { flexDirection: "row", marginTop: 1.5, paddingLeft: 8 },
  dot: { width: 10 },
  bulletText: { flex: 1 },
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
      <Text style={st.bulletText}>{b}</Text>
    </View>
  ));
}

export function ResumePdf({ doc }: { doc: ResumeDoc }) {
  const h = doc.header;
  return (
    <Document title={`${h.name} — Resume`} author={h.name}>
      <Page size="LETTER" style={st.page}>
        <Text style={st.name}>{h.name}</Text>
        <Text style={st.contact}>{[h.location, h.phone, h.email, ...h.links].filter(Boolean).join("  |  ")}</Text>

        {doc.summary && <Section title="Summary"><Text>{doc.summary}</Text></Section>}

        {doc.skills.length > 0 && (
          <Section title="Skills">
            {doc.skills.map((g) => <Text key={g.category}><Text style={st.bold}>{g.category}: </Text>{g.items.join(", ")}</Text>)}
          </Section>
        )}

        {doc.experience.length > 0 && (
          <Section title="Experience">
            {doc.experience.map((e, i) => (
              <View key={i} style={st.item}>
                <View style={st.row}>
                  <Text style={st.bold}>{e.title}, {e.company}</Text>
                  <Text>{range(e.startDate, e.endDate)}</Text>
                </View>
                <Bullets items={e.bullets} />
              </View>
            ))}
          </Section>
        )}

        {doc.projects.length > 0 && (
          <Section title="Projects">
            {doc.projects.map((p, i) => (
              <View key={i} style={st.item}>
                <View style={st.row}>
                  <Text><Text style={st.bold}>{p.name}</Text>{p.tech.length ? ` | ${p.tech.join(", ")}` : ""}</Text>
                  <Text>{p.url.replace(/^https?:\/\//, "")}</Text>
                </View>
                <Bullets items={p.bullets} />
              </View>
            ))}
          </Section>
        )}

        {doc.education.length > 0 && (
          <Section title="Education">
            {doc.education.map((e, i) => (
              <View key={i} style={st.row}>
                <Text><Text style={st.bold}>{e.institution}</Text>{[e.degree, e.fieldOfStudy].filter(Boolean).length ? ` — ${[e.degree, e.fieldOfStudy].filter(Boolean).join(", ")}` : ""}{e.grade ? ` (${e.grade})` : ""}</Text>
                <Text>{range(e.startDate, e.endDate)}</Text>
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
