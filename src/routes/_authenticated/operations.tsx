import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listOperations, loadOperation, startSolo } from "@/lib/operations.functions";
import { DungeonMap } from "@/components/operations/DungeonMap";
import { mapIdentity } from "@/lib/map-identity";
import { trackLabel } from "@/lib/ambience-tracks";
import { RACE_NAMES } from "@/lib/races";

export const Route = createFileRoute("/_authenticated/operations")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Catalogue d'Opérations — Bastion" },
      { name: "description", content: "Donjons préconstruits Bastion à charger dans ton salon, ou à jouer en solo." },
      { property: "og:title", content: "Catalogue d'Opérations — Bastion" },
      { property: "og:description", content: "Donjons préconstruits Bastion à charger dans ton salon, ou à jouer en solo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OperationsPage,
});

const SEL = "h-11 w-full border-2 border-foreground bg-background px-2";
const DIFF: Record<string, string> = { initiation: "Initiation", moyenne: "Moyenne", difficile: "Difficile" };
const MAPT: Record<string, string> = { lineaire: "Linéaire", boucle: "Boucle", etoile: "Étoile" };

function OperationsPage() {
  const fetchOps = useServerFn(listOperations);
  const q = useQuery({ queryKey: ["operations"], queryFn: () => fetchOps() });
  const [dur, setDur] = useState("all");
  const [diff, setDiff] = useState("all");
  const ops = useMemo(() => (q.data?.operations ?? []).filter((o: any) => (dur === "all" || String(o.duration) === dur) && (diff === "all" || o.difficulty === diff)), [q.data, dur, diff]);

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-6 md:px-10">
      <header className="flex items-center justify-between border-b-2 border-foreground pb-4">
        <Link to="/" className="font-display text-lg uppercase">Bastion<span className="text-primary">.</span></Link>
        <Button asChild variant="outline" className="min-h-11 rounded-none"><Link to="/salons">Mes salons</Link></Button>
      </header>
      <Button asChild variant="secondary" className="mt-4 min-h-11"><Link to="/campagnes">Concevoir une campagne</Link></Button>
      <h1 className="mt-8 font-display text-3xl uppercase">Catalogue d'Opérations</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Des donjons préconstruits, prêts à charger dans ton salon. Ennemis, trésors et événements sont préplacés : tu peux tout ajuster avant de lancer.</p>

      <div data-motion-enter className="mt-6 grid max-w-xl grid-cols-2 gap-3">
        <label className="text-xs font-bold uppercase">Durée
          <select className={SEL + " mt-1"} value={dur} onChange={(e) => setDur(e.target.value)}>
            <option value="all">Toutes</option><option value="30">30 min</option><option value="60">60 min</option><option value="90">90 min</option>
          </select>
        </label>
        <label className="text-xs font-bold uppercase">Difficulté
          <select className={SEL + " mt-1"} value={diff} onChange={(e) => setDiff(e.target.value)}>
            <option value="all">Toutes</option><option value="initiation">Initiation</option><option value="moyenne">Moyenne</option><option value="difficile">Difficile</option>
          </select>
        </label>
      </div>

      {q.isLoading && <p className="mt-6">Chargement du catalogue…</p>}
      {q.error && <p role="alert" className="mt-6 font-bold text-primary">Catalogue indisponible. <button className="underline" onClick={() => q.refetch()}>Réessayer</button></p>}
      {q.data && ops.length === 0 && <p className="mt-6 text-muted-foreground">Aucune Opération ne correspond à ces filtres.</p>}

      <ul className="mt-6 grid gap-6 lg:grid-cols-2">
        {ops.map((o: any) => <OperationCard key={o.id} op={o} salons={q.data?.mySalons ?? []} />)}
      </ul>
    </main>
  );
}

function OperationCard({ op, salons }: { op: any; salons: any[] }) {
  const navigate = useNavigate();
  const load = useServerFn(loadOperation);
  const solo = useServerFn(startSolo);
  const [salon, setSalon] = useState(salons[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [soloForm, setSoloForm] = useState<{ name: string; race: string } | null>(null);

  async function doLoad() {
    const target = salons.find((s) => s.id === salon);
    if (!target) return;
    setBusy("load");
    try {
      const r = await load({ data: { gameId: target.id, templateId: op.id, reshuffle: false } });
      if (r.over) toast.warning(`Opération chargée, mais la menace dépasse le budget : ${r.used} / ${r.budget} points. Retire des ennemis ou remélange avant de lancer.`, { duration: 8000 });
      else toast.success(`Opération chargée — menace ${r.used} / ${r.budget}`);
      navigate({ to: "/salon/$code", params: { code: target.code } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible."); }
    finally { setBusy(null); }
  }
  async function doPdf() {
    setBusy("pdf");
    try { const { downloadOperationPdf } = await import("@/lib/operation-pdf"); await downloadOperationPdf(op); }
    catch { toast.error("PDF impossible à générer."); }
    finally { setBusy(null); }
  }
  async function doSolo(e: React.FormEvent) {
    e.preventDefault();
    if (!soloForm) return;
    setBusy("solo");
    try { const r = await solo({ data: { displayName: soloForm.name, race: soloForm.race as any } }); navigate({ to: "/salon/$code", params: { code: r.code } }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Partie solo impossible."); setBusy(null); }
  }

  return (
    <li className="border-2 border-foreground bg-card p-4 shadow-game">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">Opération {op.position}</p>
          <h2 className="mt-1 font-display text-xl uppercase">{op.name}</h2>
        </div>
        {op.solo && <span className="border-2 border-foreground bg-secondary px-2 py-1 text-[10px] font-black uppercase">Solo gratuit</span>}
      </div>
      <p className="mt-2 text-sm">{op.summary}</p><p className="mt-2 text-sm text-muted-foreground">{mapIdentity[op.slug]} · {trackLabel(op.default_track)}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="border border-foreground p-2"><dt className="uppercase text-muted-foreground">Durée</dt><dd className="font-bold">{op.duration} min</dd></div>
        <div className="border border-foreground p-2"><dt className="uppercase text-muted-foreground">Difficulté</dt><dd className="font-bold">{op.difficulty_label || DIFF[op.difficulty]}</dd></div>
        <div className="border border-foreground p-2"><dt className="uppercase text-muted-foreground">Salles</dt><dd className="font-bold">{op.rooms.length} · {MAPT[op.map_type]}</dd></div>
        <div className="border border-foreground p-2"><dt className="uppercase text-muted-foreground">Menace</dt><dd className="font-bold">{op.threat} pts</dd></div>
      </dl>
      <p className="mt-3 text-sm"><b>Objectif :</b> {op.objective_text}</p>
      <div className="mt-3 border-2 border-foreground bg-background p-2"><DungeonMap rooms={op.rooms} current={op.rooms[0]?.key} label={`Aperçu de la carte de ${op.name}`} /></div>

      <div className="mt-4 space-y-2">
        {salons.length ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor={`salon-${op.id}`}>Salon</label>
            <select id={`salon-${op.id}`} className={SEL} value={salon} onChange={(e) => setSalon(e.target.value)}>
              {salons.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
            <Button disabled={!!busy || !salon} className="min-h-11 shrink-0 rounded-none font-black uppercase" onClick={doLoad}>{busy === "load" ? "Chargement…" : "Charger dans mon salon"}</Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Pour charger une Opération, crée d'abord un salon en attente dont tu es narrateur. <Link to="/salons" className="font-bold underline">Mes salons</Link></p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!!busy} className="min-h-11 rounded-none" onClick={doPdf}>{busy === "pdf" ? "Génération…" : "Télécharger l'Opération en PDF"}</Button>
          {op.solo && !soloForm && <Button variant="secondary" className="min-h-11 rounded-none font-bold uppercase" onClick={() => setSoloForm({ name: "", race: "Humain" })}>Jouer en solo</Button>}
        </div>
        {soloForm && (
          <form data-motion-enter onSubmit={doSolo} className="grid gap-2 border-2 border-primary p-3 sm:grid-cols-3">
            <Input required maxLength={40} className="h-11 rounded-none" placeholder="Ton nom" value={soloForm.name} onChange={(e) => setSoloForm({ ...soloForm, name: e.target.value })} />
            <select aria-label="Race" className={SEL} value={soloForm.race} onChange={(e) => setSoloForm({ ...soloForm, race: e.target.value })}>
              {RACE_NAMES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <Button disabled={busy === "solo"} className="min-h-11 rounded-none font-black uppercase">{busy === "solo" ? "Lancement…" : "Lancer le solo"}</Button>
          </form>
        )}
      </div>
    </li>
  );
}
