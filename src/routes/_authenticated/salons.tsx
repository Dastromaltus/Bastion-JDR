import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { createRoom, listMyRooms } from "@/lib/rooms.functions";
import { SCENARIOS, STATUS_LABEL, ROLE_LABEL, scenarioLabel } from "@/lib/races";
import { ReportButton } from "@/components/ReportButton";

export const Route = createFileRoute("/_authenticated/salons")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Mes salons — Bastion" },
      { name: "description", content: "Crée, rejoins et retrouve tes salons privés Bastion." },
      { property: "og:title", content: "Mes salons — Bastion" },
      { property: "og:description", content: "Crée, rejoins et retrouve tes salons privés Bastion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalonsPage,
});

const field = "h-11 rounded-none";

function SalonsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listMyRooms);
  const create = useServerFn(createRoom);
  const rooms = useQuery({ queryKey: ["my-rooms"], queryFn: () => list() });
  const [form, setForm] = useState({ name: "", maxPlayers: 4, password: "", scenario: "tresor", displayName: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const r = await create({ data: { ...form, password: form.password || undefined } });
      qc.invalidateQueries({ queryKey: ["my-rooms"] });
      toast.success(`Salon créé : ${r.code}`);
      navigate({ to: "/salon/$code", params: { code: r.code } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-6 md:px-10">
      <header className="flex items-center justify-between border-b-2 border-foreground pb-4">
        <Link to="/" className="font-display text-lg uppercase">Bastion<span className="text-primary">.</span></Link>
        <Button variant="outline" className="min-h-11 rounded-none" onClick={() => supabase.auth.signOut()}>Déconnexion</Button>
      </header>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase">Mes salons</h1>
        <Button asChild className="min-h-11 rounded-none font-black uppercase"><Link to="/operations">Catalogue d'Opérations · solo gratuit</Link></Button>
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={submit} className="space-y-3 border-2 border-foreground p-4">
          <h2 className="section-label">Créer un salon privé</h2>
          <Input className={field} required maxLength={60} placeholder="Nom du salon" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input className={field} required maxLength={40} placeholder="Ton nom de narrateur" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold uppercase">Joueurs max
              <select className="mt-1 h-11 w-full border border-input bg-background px-2" value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) })}>
                {[3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase">Scénario
              <select className="mt-1 h-11 w-full border border-input bg-background px-2" value={form.scenario} onChange={(e) => setForm({ ...form, scenario: e.target.value })}>
                {SCENARIOS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
          </div>
          <Input className={field} type="password" maxLength={64} placeholder="Mot de passe (optionnel)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {error && <p role="alert" className="text-sm font-bold text-primary">{error}</p>}
          <Button disabled={creating} className="min-h-11 w-full rounded-none font-black uppercase">{creating ? "Création…" : "Créer le salon"}</Button>
        </form>

        <form
          onSubmit={(e) => { e.preventDefault(); if (/^[A-Z0-9]{6}$/.test(code)) navigate({ to: "/rejoindre/$code", params: { code } }); }}
          className="space-y-3 border-2 border-primary p-4"
        >
          <h2 className="section-label">Rejoindre avec un code</h2>
          <Input className={`${field} font-pixel text-2xl uppercase tracking-[0.4em]`} maxLength={6} placeholder="ABC123" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
          <Button disabled={code.length !== 6} className="min-h-11 w-full rounded-none font-black uppercase">Continuer</Button>
          <p className="text-sm text-muted-foreground">Tu peux aussi ouvrir directement le lien d'invitation envoyé par le narrateur.</p>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="section-label">Salons créés et rejoints</h2>
        {rooms.isLoading && <p className="mt-4">Chargement…</p>}
        {rooms.error && <p role="alert" className="mt-4 font-bold text-primary">Impossible de charger tes salons. <button className="underline" onClick={() => rooms.refetch()}>Réessayer</button></p>}
        {rooms.data?.length === 0 && <p className="mt-4 text-muted-foreground">Aucun salon pour l'instant.</p>}
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {rooms.data?.map((r: any) => (
            <li key={r.id} className="border border-foreground/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg uppercase">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{scenarioLabel(r.scenario)} · code <span className="font-pixel">{r.code}</span>{r.isCreator ? " · créé par toi" : ""}</p>
                </div>
                <span className={`px-2 py-1 text-[10px] font-black uppercase ${r.role === "narrator" ? "bg-primary text-primary-foreground" : "border border-foreground"}`}>{ROLE_LABEL[r.role]}</span>
              </div>
              <p className="mt-2 text-xs font-bold uppercase">Statut : {STATUS_LABEL[r.status]}{r.result ? ` — ${r.result === "victoire" ? "victoire" : "défaite"}` : ""}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" className="min-h-11 rounded-none font-bold uppercase"><Link to="/salon/$code" params={{ code: r.code }}>Ouvrir</Link></Button>
                {r.status === "finished" && <ReportButton gameId={r.id} />}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
