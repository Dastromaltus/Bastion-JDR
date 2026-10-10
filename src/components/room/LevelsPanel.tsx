import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ZONES, zoneLabel } from "@/lib/races";
import { TRACKS } from "@/lib/ambience-tracks";
import { getLevels, saveLevels } from "@/lib/levels.functions";

const SEL = "h-11 w-full border border-input bg-background px-2";
type Lvl = { zone: string; track: string | null; introText: string };

export function LevelsPanel({ d, onPlaceMobs }: { d: any; onPlaceMobs: (zone: string) => void }) {
  const gameId = d.game.id;
  const editable = d.game.status === "waiting";
  const fetchLv = useServerFn(getLevels);
  const save = useServerFn(saveLevels);
  const q = useQuery({ queryKey: ["levels", gameId], queryFn: () => fetchLv({ data: { gameId } }) });
  const [levels, setLevels] = useState<Lvl[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.data) setLevels(q.data.map((l: any) => ({ zone: l.zone, track: l.track, introText: l.intro_text })));
  }, [q.data]);

  const unused = ZONES.filter((z) => !levels.some((l) => l.zone === z.key));
  const patch = (i: number, p: Partial<Lvl>) => setLevels(levels.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const move = (i: number, dir: -1 | 1) => {
    const n = [...levels]; const j = i + dir; if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j]!, n[i]!]; setLevels(n);
  };
  const submit = async () => {
    setBusy(true);
    try { await save({ data: { gameId, levels: levels as any } }); toast.success("Niveaux enregistrés"); await q.refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  };

  if (q.isLoading) return <p className="text-sm">Chargement des niveaux…</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Prépare le parcours de bout en bout : l'ordre des cartes, la musique et le texte affiché quand les aventuriers entrent dans chaque niveau.
        {!editable && " La partie est lancée : les niveaux ne sont plus modifiables."}
      </p>
      <fieldset disabled={!editable || busy} className="min-w-0 space-y-3">
        {levels.map((l, i) => {
          const mobs = d.enemies.filter((e: any) => e.zone === l.zone);
          return (
            <div key={l.zone} className="border-2 border-foreground p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm uppercase">Niveau {i + 1} · {zoneLabel(l.zone)}</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="min-h-11 rounded-none" aria-label="Monter" onClick={() => move(i, -1)}>▲</Button>
                  <Button size="sm" variant="outline" className="min-h-11 rounded-none" aria-label="Descendre" onClick={() => move(i, 1)}>▼</Button>
                  <Button size="sm" variant="destructive" className="min-h-11 rounded-none" onClick={() => setLevels(levels.filter((_, j) => j !== i))}>Retirer</Button>
                </div>
              </div>
              <label className="block text-xs font-bold uppercase">Musique
                <select className={SEL} value={l.track ?? ""} onChange={(e) => patch(i, { track: e.target.value || null })}>
                  <option value="">Garder la musique en cours</option>
                  {TRACKS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase">Texte d'entrée
                <textarea maxLength={1000} rows={3} className="mt-1 w-full border border-input bg-background p-2 text-sm normal-case" placeholder="Ce que les aventuriers découvrent en arrivant…" value={l.introText} onChange={(e) => patch(i, { introText: e.target.value })} />
              </label>
              <div className="text-sm">
                <p className="text-xs font-bold uppercase">Mobs ({mobs.length})</p>
                {mobs.length ? <ul className="mt-1">{mobs.map((m: any) => <li key={m.id}>{m.icon} {m.name} · menace {m.threat_cost}</li>)}</ul> : <p className="text-muted-foreground">Aucun mob.</p>}
                <Button size="sm" variant="outline" className="mt-2 min-h-11 rounded-none" onClick={() => onPlaceMobs(l.zone)}>Placer des mobs ici</Button>
              </div>
            </div>
          );
        })}
        {unused.length > 0 && (
          <label className="block text-xs font-bold uppercase">Ajouter une carte
            <select className={SEL} value="" onChange={(e) => e.target.value && setLevels([...levels, { zone: e.target.value, track: null, introText: "" }])}>
              <option value="">Choisir…</option>
              {unused.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}
            </select>
          </label>
        )}
        <Button className="min-h-11 w-full rounded-none font-black uppercase" onClick={submit}>{busy ? "Enregistrement…" : "Enregistrer les niveaux"}</Button>
      </fieldset>
    </div>
  );
}
