import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, KeyRound, Search, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createRoom, listMyRooms, deleteRoom } from "@/lib/rooms.functions";
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
  const remove = useServerFn(deleteRoom);
  const onDelete = async (r: any) => {
    if (!window.confirm(`Supprimer définitivement le salon « ${r.name} » ? Tout son contenu sera effacé.`)) return;
    try { await remove({ data: { gameId: r.id } }); await qc.invalidateQueries({ queryKey: ["my-rooms"] }); }
    catch (e) { setError(e instanceof Error ? e.message : "Suppression impossible."); }
  };
  const rooms = useQuery({ queryKey: ["my-rooms"], queryFn: () => list() });
  const [form, setForm] = useState({ name: "", maxPlayers: 4, password: "", scenario: "tresor", displayName: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [dialog, setDialog] = useState<"create" | "join" | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const visibleRooms = (rooms.data ?? []).filter((r: any) =>
    `${r.name} ${r.code}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")) &&
    (filter === "all" || r.status === filter),
  );

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
    <main className="mx-auto min-h-screen max-w-7xl bg-background px-4 pb-16 pt-8 md:px-10">
      <p className="section-label">Ta table de jeu</p>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <h1 className="font-display text-xl uppercase leading-relaxed sm:text-3xl">Mes salons</h1>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="min-h-11 rounded-none" onClick={() => setDialog("join")}><KeyRound />Rejoindre</Button>
          <Button className="min-h-11 rounded-none" onClick={() => { setError(null); setDialog("create"); }}><Plus />Créer un salon</Button>
        </div>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-none border-2 border-foreground sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="pr-6 font-display text-base leading-relaxed">{dialog === "create" ? "Créer un salon privé" : "Rejoindre un salon"}</DialogTitle>
            <DialogDescription>{dialog === "create" ? "Tu seras le narrateur de cette partie." : "Saisis le code à six caractères de ton invitation."}</DialogDescription>
          </DialogHeader>
        {dialog === "create" ? <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-bold">Nom du salon<Input className={`${field} mt-1`} required maxLength={60} placeholder="Nom du salon" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="block text-sm font-bold">Ton nom de narrateur<Input className={`${field} mt-1`} required maxLength={40} placeholder="Ton nom de narrateur" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
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
          <label className="block text-sm font-bold">Mot de passe (optionnel)<Input className={`${field} mt-1`} type="password" maxLength={64} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          {error && <p role="alert" className="text-sm font-bold text-primary">{error}</p>}
          <Button disabled={creating} className="min-h-11 w-full rounded-none font-black uppercase">{creating ? "Création…" : "Créer le salon"}</Button>
        </form> : <form
          onSubmit={(e) => { e.preventDefault(); if (/^[A-Z0-9]{6}$/.test(code)) navigate({ to: "/rejoindre/$code", params: { code } }); }}
          className="space-y-3"
        >
          <label className="block text-sm font-bold">Code d'invitation<Input className={`${field} mt-1 font-pixel text-2xl uppercase`} maxLength={6} placeholder="ABC123" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></label>
          <Button disabled={code.length !== 6} className="min-h-11 w-full rounded-none font-black uppercase">Continuer</Button>
          <p className="text-sm text-muted-foreground">Tu peux aussi ouvrir directement le lien d'invitation envoyé par le narrateur.</p>
        </form>}
        </DialogContent>
      </Dialog>

      <section className="mt-8 border-t border-border pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="section-label">Salons créés et rejoints {rooms.data ? `· ${rooms.data.length}` : ""}</h2>
          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-64"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-5 text-muted-foreground" /><Input aria-label="Rechercher un salon" placeholder="Nom ou code du salon" className="h-11 rounded-none pl-10" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <select aria-label="Filtrer les salons par statut" className="h-11 border border-input bg-background px-3" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Tous les statuts</option>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
        </div>
        {rooms.isLoading && <p className="mt-4">Chargement…</p>}
        {rooms.error && <p role="alert" className="mt-4 font-bold text-primary">Impossible de charger tes salons. <Button variant="link" className="min-h-11" onClick={() => rooms.refetch()}>Réessayer</Button></p>}
        {error && dialog !== "create" && <p role="alert" className="mt-4 text-primary">{error}</p>}
        <p className="mt-2 text-xs text-muted-foreground">Un salon sans activité pendant plus de 2 mois est supprimé automatiquement.</p>
        {rooms.data?.length === 0 && <div className="flex flex-col items-start gap-3 py-10"><Users className="size-8 text-primary" /><p className="font-bold">Aucun salon pour l'instant.</p><Button variant="outline" className="min-h-11" onClick={() => setDialog("create")}><Plus />Créer mon premier salon</Button></div>}
        {!!rooms.data?.length && visibleRooms.length === 0 && <p className="py-8 text-muted-foreground">Aucun salon ne correspond à ta recherche.</p>}
        <ul data-motion-stagger className="mt-4 grid gap-4 md:grid-cols-2">
          {visibleRooms.map((r: any) => (
            <li key={r.id} className="border border-foreground/40 p-4">
              <div className="flex items-start justify-between gap-3">
                 <div className="min-w-0">
                   <p className="break-words font-display text-base uppercase leading-relaxed">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{scenarioLabel(r.scenario)} · code <span className="font-pixel">{r.code}</span>{r.isCreator ? " · créé par toi" : ""}</p>
                </div>
                 <span className={`shrink-0 px-2 py-1 text-[10px] font-black uppercase ${r.role === "narrator" ? "bg-primary text-primary-foreground" : "border border-foreground"}`}>{ROLE_LABEL[r.role]}</span>
              </div>
              <p className="mt-2 text-xs font-bold uppercase">Statut : {STATUS_LABEL[r.status]}{r.result ? ` — ${r.result === "victoire" ? "victoire" : "défaite"}` : ""}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" className="min-h-11 rounded-none font-bold uppercase"><Link to="/salon/$code" params={{ code: r.code }}>Ouvrir</Link></Button>
                {r.status === "finished" && <ReportButton gameId={r.id} />}
                {r.isCreator && <Button variant="destructive" className="min-h-11 rounded-none font-bold uppercase" onClick={() => onDelete(r)}>Supprimer</Button>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
