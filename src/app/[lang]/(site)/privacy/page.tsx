import type { Metadata } from "next";
import legal from "@/content/legal.json";
import { langFrom, languages, path, t as dict } from "@/lib/i18n";
import { LegalPage } from "@/components/LegalPage";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const lang = await langFrom(params);
  return {
    title: legal.privacy[lang].title,
    description: dict(lang).legal.privacyDescription,
    alternates: { canonical: path(lang, "/privacy"), languages: languages("/privacy") },
  };
}

type Block = { kind: string; text?: string; items?: string[]; address?: string };

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const lang = await langFrom(params);
  const p = legal.privacy[lang];
  return (
    <LegalPage title={p.title} updated={p.updated} lang={lang}>
      <p>{p.intro}</p>
      {p.sections.map((s) => (
        <section key={s.heading} className="space-y-3">
          <h2>{s.heading}</h2>
          {(s.blocks as Block[]).map((b, i) =>
            b.kind === "ul" ? <ul key={i}>{b.items!.map((x) => <li key={x}>{x}</li>)}</ul>
            : b.kind === "email" ? <p key={i}><a href={`mailto:${b.address}`} className="font-semibold text-brand hover:text-brand-dark">{b.address}</a></p>
            : <p key={i}>{b.text}</p>,
          )}
        </section>
      ))}
    </LegalPage>
  );
}
