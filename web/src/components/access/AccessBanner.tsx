import Link from "next/link";

// States the viewer's tier on every page that shows inventory data, so what is withheld is never a surprise.
export function AccessBanner({ partner, configured }: { partner: string | null; configured: boolean }) {
  return (
    <div className={`mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[13px] ring-1 ${partner ? "bg-flame/[0.07] ring-flame/30" : "bg-paper/[0.03] ring-paper/10"}`}>
      <p className="text-paper/75">
        {partner
          ? <>Partner view for <span className="text-paper">{partner}</span>: exact coordinates, plume stacks and orbit lists. Every view is logged.</>
          : <>Public view: locations rounded to about 25 km; plume images, orbit lists and exact coordinates go to verified partners. Entries are candidates for human review, not accusations.</>}
      </p>
      <div className="flex gap-2">
        <Link href="/responsible" className="rounded-full px-3 py-1 text-[12px] text-paper/70 ring-1 ring-paper/15 transition hover:bg-paper/10 hover:text-paper">How this is safeguarded</Link>
        {(partner || configured) && (
          <Link href="/partner" className="rounded-full px-3 py-1 text-[12px] text-paper/85 ring-1 ring-paper/25 transition hover:bg-paper/10">{partner ? "Partner session" : "Partner sign-in"}</Link>
        )}
      </div>
    </div>
  );
}
