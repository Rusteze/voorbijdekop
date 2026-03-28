import type { Metadata } from "next";
import Link from "next/link";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://voorbijdekop.nl";
const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

export const metadata: Metadata = {
  title: "Privacy & cookies | voorbijdekop",
  description: "Privacyverklaring en cookie-informatie voor voorbijdekop.",
  robots: { index: true, follow: true }
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <main className="mx-auto max-w-2xl px-4 py-10 md:px-5 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Juridisch</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-3xl">
          Privacy &amp; cookies
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          Laatst bijgewerkt: maart 2026. Deze tekst beschrijft hoe voorbijdekop met persoonsgegevens en cookies omgaat in
          lijn met de Algemene verordening gegevensbescherming (AVG) en de ePrivacy-richtlijn. Dit is{" "}
          <strong>geen juridisch advies</strong>; pas aan waar nodig voor jouw situatie en overleg bij twijfel met een
          specialist.
        </p>

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">1. Wie is verantwoordelijk?</h2>
          <p>
            Voor de verwerking van persoonsgegevens via deze website en de daaraan gekoppelde diensten (zoals de
            e-maildigest) is de <strong>exploitant</strong> van voorbijdekop verantwoordelijk in de zin van de AVG
            (verwerkingsverantwoordelijke).
            {CONTACT ? (
              <>
                {" "}
                Contact:{" "}
                <a className="text-red-900 underline underline-offset-2 dark:text-red-200" href={`mailto:${CONTACT}`}>
                  {CONTACT}
                </a>
                .
              </>
            ) : (
              <> Vul voor productie bij voorkeur <code className="text-xs">NEXT_PUBLIC_CONTACT_EMAIL</code> in.</>
            )}
          </p>
        </section>

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">2. Welke gegevens verwerken we?</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Website bezoeken:</strong> bij hosting via Cloudflare kunnen technische gegevens worden
              verwerkt, zoals IP-adres, tijdstip en gebruikte browser (ook voor beveiliging en beschikbaarheid).
            </li>
            <li>
              <strong>Dagelijkse digest:</strong> als je je aanmeldt, verwerken we je <strong>e-mailadres</strong>, eventueel
              door jou gekozen <strong>onderwerpen/topics</strong>, een <strong>bevestigingstoken</strong>, een
              afmeldtoken, tijdstippen (aanmelding, bevestiging, afmelding) en een <strong>hash van je IP-adres</strong>{" "}
              (niet het ruwe IP in leesbare vorm opgeslagen in onze eigen database) voor misbruikbeperking. De verwerker
              kan daarnaast serverlogs voeren; raadpleeg ook het privacybeleid van je hosting-/e-mailprovider.
            </li>
            <li>
              <strong>Feedback op verhalen:</strong> het verhaal (slug), het type feedback, tijdstip, en technische
              metadata zoals IP-hash en user-agent, om misbruik te beperken en de melding te kunnen beoordelen.
            </li>
            <li>
              <strong>E-mail (Resend):</strong> voor het versturen van bevestigings- en digestmails maken we gebruik van
              Resend als onderaannemer; verkeer loopt via beveiligde verbindingen. Raadpleeg het privacybeleid van Resend
              op{" "}
              <a href="https://resend.com/legal/privacy-policy" className="underline underline-offset-2" target="_blank" rel="noreferrer">
                resend.com
              </a>
              .
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">3. Doeleinden en grondslagen (AVG)</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Digest:</strong> het versturen van de nieuwsbrief na <strong>dubbele opt-in</strong> — grondslag{" "}
              <strong>toestemming</strong> (art. 6 lid 1 onder a AVG). Je kunt je toestemming intrekken door je af te
              melden (zie de link in elke digest-mail of de afmeldlink op basis van je token).
            </li>
            <li>
              <strong>Feedback:</strong> het verwerken van je melding om de dienst te verbeteren — grondslag{" "}
              <strong>gerechtvaardigd belang</strong> (art. 6 lid 1 onder f AVG), in combinatie met je verwachting bij het
              klikken op &quot;Verstuur feedback&quot;. Je kunt bezwaar maken; zie contact hieronder.
            </li>
            <li>
              <strong>Beveiliging en fraudebestrijding</strong> (o.a. rate limiting, IP-hash): gerechtvaardigd belang /
              beveiliging van de dienst.
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">4. Bewaartermijnen</h2>
          <p>
            We bewaren gegevens niet langer dan nodig voor het doel: digestgegevens tot je je afmeldt of wij het account
            opschonen; feedbackberichten voor verbetering van de dienst, daarna verwijdering of anonimisatie waar
            mogelijk (richttermijn bijvoorbeeld maximaal 24 maanden tenzij langer nodig voor juridische claims). Pas dit
            aan naar je interne beleid.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">5. Cookies en lokale opslag (browser)</h2>
          <p>
            We gebruiken <strong>geen</strong> reclame- of analysecookies van derden op deze statische site. Wel kan jouw
            browser gegevens lokaal opslaan:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Voorkeur thema</strong> (licht/donker) in <code className="text-xs">localStorage</code> — strikt
              functioneel, geen tracking over sites heen.
            </li>
            <li>
              <strong>Gevolgde topics</strong> en eventuele <strong>digest-/feedbackfallback</strong> als er geen server
              bereikbaar is — eveneens lokaal op jouw apparaat.
            </li>
          </ul>
          <p className="text-zinc-600 dark:text-zinc-400">
            Voor strikt noodzakelijke cookies/opslag is geen toestemmingsbanner vereist onder de gangbare uitleg van de
            ePrivacy-richtlijn; er worden geen niet-noodzakelijke trackingcookies ingezet.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">6. Verwerkers en doorgifte</h2>
          <p>
            Onder meer: <strong>Cloudflare</strong> (hosting, Workers, D1-database binnen de EU/EEA of onder passende
            waarborgen — controleer je Cloudflare-instellingen), <strong>Resend</strong> (e-mail). Bij doorgifte buiten de
            EER worden waar nodig passende waarborgen gebruikt (bijv. Standard Contractual Clauses).
          </p>
        </section>

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">7. Jouw rechten</h2>
          <p>
            Je hebt recht op inzage, rectificatie, verwijdering, beperking van de verwerking, dataportabiliteit waar van
            toepassing, en bezwaar tegen verwerking op basis van gerechtvaardigd belang. Ook kun je een klacht indienen
            bij de Autoriteit Persoonsgegevens (
            <a href="https://autoriteitpersoonsgegevens.nl" className="underline underline-offset-2" target="_blank" rel="noreferrer">
              autoriteitpersoonsgegevens.nl
            </a>
            ). Verzoeken kun je richten aan het contact hierboven.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">8. Wijzigingen</h2>
          <p>
            We kunnen deze pagina aanpassen. De datum bovenaan wordt bijgewerkt bij wezenlijke wijzigingen. De site is
            bereikbaar op{" "}
            <a href={SITE} className="underline underline-offset-2">
              {SITE.replace(/^https?:\/\//, "")}
            </a>
            .
          </p>
        </section>

        <p className="mt-12 text-sm">
          <Link href="/" className="font-medium text-red-900 underline underline-offset-2 dark:text-red-200">
            ← Terug naar de voorpagina
          </Link>
        </p>
      </main>
    </div>
  );
}
