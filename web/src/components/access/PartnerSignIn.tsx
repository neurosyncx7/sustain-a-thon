"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ease = [0.16, 1, 0.3, 1] as const;

export function PartnerSignIn({ partner }: { partner: { org: string; expires_utc: string } | null }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true });
    const r = await fetch("/api/partner/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setKey(""); router.push("/ledger"); router.refresh(); }
    else setState({ error: j.error ?? `HTTP ${r.status}` });
  };
  const signOut = async () => { await fetch("/api/partner/session", { method: "DELETE" }); router.refresh(); };

  if (partner) return (
    <div className="mt-10 rounded-2xl bg-flame/[0.07] p-6 ring-1 ring-flame/30">
      <p className="text-[15px]">Signed in as <span className="font-medium">{partner.org}</span>.</p>
      <p className="mt-1 text-[13px] text-paper/60">Session ends {partner.expires_utc.slice(0, 16).replace("T", " ")} UTC. Each view of partner data is written to the audit log.</p>
      <div className="mt-5 flex gap-2">
        <a href="/ledger" className="rounded-full bg-paper px-4 py-2 text-[13px] font-medium text-ink transition hover:bg-white active:scale-[0.98]">Open the full inventory</a>
        <a href="/api/export" className="rounded-full px-4 py-2 text-[13px] ring-1 ring-paper/25 transition hover:bg-paper/10">Download full CSV</a>
        <button onClick={signOut} className="rounded-full px-4 py-2 text-[13px] text-paper/70 ring-1 ring-paper/15 transition hover:bg-paper/10 hover:text-paper">Sign out</button>
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-10 max-w-md">
      <label htmlFor="key" className="text-[13px] text-paper/70">Organisation access key</label>
      <input id="key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)}
        className="num mt-2 w-full rounded-xl bg-paper/[0.05] px-4 py-3 text-[14px] outline-none ring-1 ring-paper/15 transition focus:ring-flame/60" placeholder="issued to your organisation" />
      <button disabled={state.busy || key.length < 16}
        className="mt-4 rounded-full bg-paper px-5 py-2 text-[13px] font-medium text-ink transition hover:bg-white active:scale-[0.98] disabled:opacity-50">
        {state.busy ? "Checking…" : "Sign in"}
      </button>
      <AnimatePresence>
        {state.error && <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease }} className="mt-3 text-[13px] text-[#e39b82]">{state.error}</motion.p>}
      </AnimatePresence>
    </form>
  );
}
