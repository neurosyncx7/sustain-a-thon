import Link from "next/link";
import { getPartner, partnerTierConfigured } from "@/lib/access";
import { PartnerSignIn } from "@/components/access/PartnerSignIn";
import { SmoothScroll } from "@/components/SmoothScroll";

export const metadata = { title: "Partner access · Vāyu Lekha" };
export const dynamic = "force-dynamic";

export default async function PartnerPage() {
  const p = await getPartner();
  const configured = partnerTierConfigured();
  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl px-5 pb-24 pt-8 md:px-8">
      <SmoothScroll />
      <nav className="flex items-center justify-between text-[14px]">
        <Link href="/ledger" className="text-paper/70 transition hover:text-paper">← The ledger</Link>
        <Link href="/responsible" className="text-paper/70 transition hover:text-paper">How this is safeguarded</Link>
      </nav>
      <h1 className="mt-14 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">Partner access</h1>
      <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-paper/65">
        Pollution control boards, regulators and accredited researchers receive the full evidence package: exact coordinates,
        the wind-rotated plume stack for each site, every orbit used, and the complete CSV. Access keys are issued per organisation;
        the server keeps only their hashes, sessions last 12 hours, and every view is logged.
      </p>
      {configured
        ? <PartnerSignIn partner={p ? { org: p.org, expires_utc: new Date(p.exp * 1000).toISOString() } : null} />
        : <p className="mt-10 rounded-2xl bg-paper/[0.04] p-5 text-[14px] text-paper/65 ring-1 ring-paper/10">The partner tier is not enabled on this deployment yet, so only the public view is served. Nothing beyond the public view can be reached here.</p>}
    </main>
  );
}
