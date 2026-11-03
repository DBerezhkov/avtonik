import type { Metadata } from "next";
import legal from "@/content/legal.json";
import { langFrom, languages, path, t as dict } from "@/lib/i18n";
import { LegalPage } from "@/components/LegalPage";

export async function generateMetadata({ params }: PageProps<"/[lang]/terms">): Promise<Metadata> {
  const lang = await langFrom(params);
  return {
    title: legal.terms[lang].title,
    description: dict(lang).legal.termsDescription,
    alternates: { canonical: path(lang, "/terms"), languages: languages("/terms") },
  };
}

/** Строки вида «Метка: текст» -> метка жирным; подряд идущие «- пункт» -> список. */
function Lines({ lines }: { lines: string[] }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) items.push(lines[i++].slice(2));
      i--;
      out.push(<ul key={i}>{items.map((x) => <li key={x}>{x}</li>)}</ul>);
      continue;
    }
    const m = /^([^:]{2,40}):\s*(.*)$/.exec(lines[i]);
    out.push(<p key={i}>{m ? <><strong className="text-fg">{m[1]}:</strong> {m[2]}</> : lines[i]}</p>);
  }
  return out;
}

export default async function TermsPage({ params }: PageProps<"/[lang]/terms">) {
  const lang = await langFrom(params);
  const t = legal.terms[lang];
  return (
    <LegalPage title={t.title} lang={lang}>
      {t.sections.map((s) => (
        <section key={s.heading} className="space-y-3">
          <h2>{s.heading}</h2>
          <Lines lines={s.lines} />
        </section>
      ))}
      {t.outro.map((x) => <p key={x}>{x}</p>)}
    </LegalPage>
  );
}
