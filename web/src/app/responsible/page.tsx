import Link from "next/link";
import { readJson } from "@/lib/data";
import { latestPass } from "@/lib/live";
import { partnerTierConfigured } from "@/lib/access";
import { SmoothScroll } from "@/components/SmoothScroll";

export const metadata = { title: "Safeguards · Vāyu Lekha" };
export const revalidate = 300;

const pct = (x: number | null | undefined) => (x == null ? "not yet measured" : `${(x * 100).toFixed(0)}%`);
const median = (a: number[]) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-20 grid gap-6 md:grid-cols-[120px_1fr]">
      <p className="num text-[12px] text-paper/40">{n}</p>
      <div>
        <h2 className="text-2xl font-medium tracking-tight">{title}</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-paper/70">{children}</div>
      </div>
    </section>
  );
}

function Row({ k, v, tone = "" }: { k: string; v: React.ReactNode; tone?: string }) {
  return <div className="flex items-baseline justify-between gap-6 border-b border-paper/10 py-2.5 text-[14px]"><dt className="text-paper/65">{k}</dt><dd className={`num text-right ${tone}`}>{v}</dd></div>;
}

export default async function Responsible() {
  const inv = await readJson("inventory/inventory_public.json");
  const alg = await readJson("inventory/algorithms.json");
  const pass = await latestPass();
  const S = inv.sites as any[];
  const byReview = (st: string) => S.filter((s) => s.review.state === st).length;
  const fp = (k: string) => median(S.map((s) => s.corroboration?.[k]?.false_pass_rate));
  const passed = (k: string) => S.filter((s) => s.status !== "not detected" && s.corroboration?.[k]?.passed).length;
  const lit = S.filter((s) => s.status !== "not detected").length;
  const failedAlg = alg.algorithms.filter((a: any) => a.status === "failed");
  const integ = pass.ok ? pass.data.integrity : null;

  return (
    <main className="mx-auto min-h-[100dvh] max-w-5xl px-5 pb-28 pt-8 md:px-8">
      <SmoothScroll />
      <nav className="flex items-center justify-between text-[14px]">
        <Link href="/ledger" className="text-paper/70 transition hover:text-paper">← The ledger</Link>
        <Link href="/partner" className="text-paper/70 transition hover:text-paper">Partner access</Link>
      </nav>
      <h1 className="mt-14 max-w-3xl text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl">A ledger that points, and people who decide.</h1>
      <p className="mt-5 max-w-[64ch] text-[16px] leading-relaxed text-paper/70">
        Naming a methane source is consequential for the people who breathe near it and for whoever runs it. These are the safeguards
        built into the pipeline, each read live from the same files the inventory comes from.
      </p>

      <Section n="01" title="A human decides, every time">
        <p>The pipeline produces a ranked list of candidates with their evidence attached. It never acts on its own. An analyst or a regulatory
          partner reviews each entry and records a decision (reviewed, verified, rejected, or send for a field or high-resolution check).
          Decisions go into the repository by pull request, so each carries an author, a date and a history that cannot be quietly rewritten.</p>
        <dl>
          <Row k="Machine candidates awaiting review" v={byReview("machine_candidate")} />
          <Row k="Reviewed by an analyst" v={byReview("analyst_reviewed")} />
          <Row k="Verified by a regulatory partner" v={byReview("partner_verified")} tone="text-flame" />
          <Row k="Rejected on review" v={byReview("rejected")} />
        </dl>
      </Section>

      <Section n="02" title="Guarding against a false accusation">
        <p>{inv.fdr.statement} A site reaches the confirmed tier only if it also passes at least one check that could have failed on its own.
          Each check is run on the site's 24 pseudo-sites exactly as on the site, so its false-pass rate is measured on every run, not assumed.</p>
        <dl>
          <Row k="Re-detected in disjoint years (independent data)" v={`${passed("temporal")} of ${lit} · false pass ${pct(fp("temporal"))}`} />
          <Row k="Second estimator agrees (cross-sectional flux)" v={`${passed("second_method")} of ${lit} · false pass ${pct(fp("second_method"))}`} />
          <Row k="Co-emitted CO detected" v={`${passed("co")} of ${lit} · false pass ${pct(fp("co"))}`} />
          <Row k="Found by the blind national screen" v={`${passed("blind_screen")} of ${lit}`} />
        </dl>
        <p>We also say what we do not rely on. These were designed, tested on real data, and failed, so they carry no weight in any decision:</p>
        <ul className="space-y-2">
          {failedAlg.map((a: any) => <li key={a.code} className="border-l border-[#e39b82]/50 pl-3 text-[14px]"><span className="text-paper">{a.name}.</span> {a.result}</li>)}
        </ul>
        <p>Rates are 20 km cluster totals from 5.5 km pixels, not single facilities, and sources below about 10 t/h are detected less than half the time.
          The inventory says so beside every number.</p>
      </Section>

      <Section n="03" title="Dual use: who sees what">
        <p>Exact coordinates of a leaking facility help a regulator act, and could also help someone misuse them. So disclosure is tiered, the way
          software vulnerabilities are disclosed: the public sees the ranking, the rates and the scale of the problem with locations rounded to about
          25 km; verified partners see exact coordinates, plume images and orbit lists.</p>
        <dl>
          <Row k="Public location precision" v={`${inv.access.location_precision_deg}° (about 25 km)`} />
          <Row k="Withheld from the public" v={inv.access.withheld.join(", ")} />
          <Row k="Full package at rest" v="AES-256-GCM encrypted in the public repository" />
          <Row k="Partner tier on this deployment" v={partnerTierConfigured() ? "enabled" : "not enabled"} />
        </dl>
        <p>Disclosure sequence for a newly confirmed site: the partner regulator receives the full evidence first and decides on contact with the operator;
          the public entry appears at the coarse precision above. The satellite data and our code are open, so a determined party could rebuild the
          screen; the gate governs our curated, ranked evidence package, which is what would otherwise be amplified.</p>
      </Section>

      <Section n="04" title="Trusting the data, and the service">
        <p>Every satellite file is checked against the checksum the official Copernicus Data Space catalogue publishes for it. A mismatch is rejected
          before a single pixel is read; a file the catalogue cannot vouch for is accepted only if the mirror's own checksum matches, and is flagged.</p>
        <dl>
          <Row k="Newest pass: files verified against Copernicus" v={integ ? integ.verified : pass.ok ? "counted from the next 3-hourly pass" : "no live pass yet"} tone="text-flame" />
          <Row k="Accepted on mirror checksum only" v={integ ? integ.unverifiable : "–"} />
          <Row k="Rejected (checksum mismatch)" v={integ ? integ.mismatch : "–"} />
        </dl>
        <p>The data is public and holds no personal information. The service still gets the usual protections: partner sessions are signed,
          http-only and short-lived; access keys are stored only as hashes; sign-in attempts and pipeline runs are rate-limited; responses carry a strict
          content-security policy; and every number on the site traces to a file and a commit in the repository.</p>
      </Section>
    </main>
  );
}
