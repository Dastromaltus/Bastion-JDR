import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MapCanvas, SpriteSwatch } from "@/components/maps/MapCanvas";
import { GRID, PREBUILT_MAPS, SPRITES } from "@/lib/map-grid";
import { readyMapStep } from "@/lib/ready-maps";
import { TRACKS } from "@/lib/ambience-tracks";
import { getMapSequence, goToSequenceMap, listMapEnemyCatalog, listMyMaps, saveScenario } from "@/lib/maps.functions";
import { MAX_STEPS, moveStep, paintTile, putMob, type ScenarioStep } from "@/lib/scenario-steps";

const SEL = "mt-1 h-11 w-full border-2 border-foreground bg-background px-2 font-normal normal-case";
type Section = "carte" | "mobs" | "decor" | "musique";
const SECTIONS: [Section, string][] = [["carte", "1. Carte"], ["mobs", "2. Mobs"], ["decor", "3. Décor"], ["musique", "4. Musique & texte"]];

export function ScenarioBuilder({ d }: { d: any }) {
  const gameId = d.game.id as string;
  const qc = useQueryClient();
  const getSeq = useServerFn(getMapSequence);
  const save = useServerFn(saveScenario);
  const goTo = useServerFn(goToSequenceMap);
  const listMine = useServerFn(listMyMaps);
  const listCat = useServerFn(listMapEnemyCatalog);
  const seq = useQuery({ queryKey: ["map-sequence", gameId], queryFn: () => getSeq({ data: { gameId } }) });
  const mine = useQuery({ queryKey: ["my-maps"], queryFn: () => listMine() });
  const cat = useQuery({ queryKey: ["map-enemy-catalog"], queryFn: () => listCat() });

  const [steps, setSteps] = useState<ScenarioStep[]>([]);
  const [sel, setSel] = useState(0);
  const [section, setSection] = useState<Section>("carte");
  const [busy, setBusy] = useState(false);
  const [mobId, setMobId] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [brush, setBrush] = useState<number | "spawn">(6);
  const [source, setSource] = useState("prebuilt:le-sas");
  useEffect(() => { if (seq.data) setSteps(seq.data.items); }, [seq.data]);
  useEffect(() => { if (!mobId && cat.data?.[0]) setMobId(cat.data[0].id); }, [cat.data, mobId]);
  useEffect(() => setPicked(null), [sel]);

  const options = useMemo(() => [
    ...Object.entries(PREBUILT_MAPS).map(([k, m]) => ({ key: `prebuilt:${k}`, label: m.name, step: readyMapStep(k) })),
    ...(mine.data ?? []).map((m) => ({ key: `custom:${m.id}`, label: `${m.name} (ma carte)`, step: { name: m.name, tiles: m.tiles, spawn: m.spawn, source: `custom:${m.id}`, enemies: m.enemies, track: null, intro: "" } as ScenarioStep })),
  ], [mine.data]);
  const fresh = (key: string): ScenarioStep => { const entry = options.find((o) => o.key === key) ?? options[0]; if (!entry) throw new Error("Aucune carte disponible."); return structuredClone(entry.step); };

  const step = steps[sel];
  const dirty = JSON.stringify(steps) !== JSON.stringify(seq.data?.items ?? []);
  const current = seq.data?.current ?? -1;
  const catName = (id: string) => cat.data?.find((c) => c.id === id)?.name ?? "Mob";
  const catIcon = (id: string) => cat.data?.find((c) => c.id === id)?.icon ?? "☠";
  const patch = (p: Partial<ScenarioStep> | ScenarioStep) => setSteps((s) => s.map((x, i) => (i === sel ? { ...x, ...p } : x)));

  function addStep() {
    if (steps.length >= MAX_STEPS) return;
    setSteps((s) => [...s, fresh(source)]); setSel(steps.length); setSection("carte");
  }
  function removeStep(i: number) {
    if (!confirm(`Supprimer l'étape ${i + 1} « ${steps[i]?.name} » ?`)) return;
    setSteps((s) => s.filter((_, j) => j !== i)); setSel((v) => Math.max(0, Math.min(v, steps.length - 2)));
  }
  function shift(dir: -1 | 1) { const j = sel + dir; if (j < 0 || j >= steps.length) return; setSteps((s) => moveStep(s, sel, dir)); setSel(j); }

  function onCell(x: number, y: number, kind: "down" | "move") {
    if (!step) return;
    if (section === "decor") {
      if (brush === "spawn") { if (kind === "down") patch({ spawn: { x, y } }); return; }
      if (x === step.spawn.x && y === step.spawn.y && !SPRITES.find((s) => s.code === brush)?.walk) return;
      patch(paintTile(step, x, y, brush)); return;
    }
    if (section !== "mobs" || kind !== "down") return;
    const here = step.enemies.findIndex((e) => e.x === x && e.y === y);
    if (here >= 0 && picked === null) { setPicked(here); return; }
    if (here >= 0 && here === picked) { setPicked(null); return; }
    const r = putMob(step, x, y, mobId, picked ?? undefined);
    if (typeof r === "string") { toast.error(r); return; }
    patch(r); setPicked(null);
  }
  function setCoord(i: number, axis: "x" | "y", v: number) {
    if (!step || Number.isNaN(v)) return;
    const e = step.enemies[i];
    if (!e) return;
    const r = putMob(step, axis === "x" ? v : e.x, axis === "y" ? v : e.y, null, i);
    if (typeof r === "string") toast.error(r); else patch(r);
  }

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    try { toast.success(await fn()); await qc.invalidateQueries({ queryKey: ["map-sequence", gameId] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Action impossible."); }
    finally { setBusy(false); }
  }
  const saveAll = () => run(async () => { const r = await save({ data: { gameId, steps } }); return `Parcours enregistré (${r.count} étape${r.count > 1 ? "s" : ""}).`; });
  const launch = (i: number) => run(async () => { const r = await goTo({ data: { gameId, index: i } }); return `Étape ${r.index + 1} « ${r.name} » lancée.`; });

  if (seq.isLoading) return <p className="text-sm">Chargement du parcours…</p>;

  const markers = step ? [...step.enemies.map((e, i) => ({ x: e.x, y: e.y, glyph: catIcon(e.catalogId), selected: i === picked, sprite: monsterSprite(catName(e.catalogId)) })), ...(step.treasures ?? []).map((t) => ({ x: t.x, y: t.y, glyph: "✦" }))] : [];

  return (
    <div className="space-y-4">
      <p className="text-sm">Construis le déroulement de ta partie : chaque étape est une carte 40 × 40, avec ses mobs, son décor et sa musique. Tu peux revenir sur n'importe quelle étape sans perdre les autres.</p>

      {/* Fil d'Ariane */}
      <nav aria-label="Étapes du parcours" className="border-2 border-foreground p-2">
        <ol className="flex flex-wrap items-center gap-1">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-1">
              <button onClick={() => setSel(i)} aria-current={i === sel ? "step" : undefined}
                className={`min-h-11 border-2 border-foreground px-2 text-xs font-black uppercase ${i === sel ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                {i + 1} · {s.name}{!dirty && i === current ? " ▶" : ""}
              </button>
              {i < steps.length - 1 && <span aria-hidden="true" className="font-black">›</span>}
            </li>
          ))}
          <li className="flex items-center gap-1">
            <select aria-label="Carte de la nouvelle étape" value={source} onChange={(e) => setSource(e.target.value)} className="h-11 border-2 border-foreground bg-background px-1 text-xs">
              {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <Button variant="outline" disabled={steps.length >= MAX_STEPS} onClick={addStep} className="min-h-11 rounded-none text-xs font-black uppercase">+ Étape</Button>
          </li>
        </ol>
        <p className="mt-1 text-xs text-muted-foreground">{steps.length}/{MAX_STEPS} étapes · ▶ = étape en cours de jeu</p>
      </nav>

      {!step ? <p className="text-sm">Ajoute une première étape avec « + Étape ».</p> : (
        <section className="space-y-3 border-2 border-foreground p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-display text-sm uppercase">Étape {sel + 1} · {step.name}</h4>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" aria-label="Avancer l'étape" disabled={sel === 0} onClick={() => shift(-1)} className="min-h-11 rounded-none">◀</Button>
              <Button size="sm" variant="outline" aria-label="Reculer l'étape" disabled={sel === steps.length - 1} onClick={() => shift(1)} className="min-h-11 rounded-none">▶</Button>
              <Button size="sm" variant="destructive" onClick={() => removeStep(sel)} className="min-h-11 rounded-none">Supprimer</Button>
            </div>
          </div>

          <div role="tablist" aria-label="Réglages de l'étape" className="grid grid-cols-2 border-2 border-foreground sm:grid-cols-4">
            {SECTIONS.map(([k, l]) => <button key={k} role="tab" aria-selected={section === k} onClick={() => { setSection(k); setPicked(null); }} className={`min-h-11 text-xs font-black uppercase ${section === k ? "bg-secondary" : "hover:bg-secondary/60"}`}>{l}</button>)}
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="border-2 border-foreground">
              <MapCanvas tiles={step.tiles} spawn={step.spawn} markers={markers} {...(section === "mobs" || section === "decor" ? { onCell } : {})}
                label={`Carte de l'étape ${sel + 1}, ${step.name}, 40 × 40 cases`} className={section === "mobs" || section === "decor" ? "cursor-crosshair" : ""} />
            </div>

            <div className="min-w-0 space-y-3 text-sm">
              {section === "carte" && <>
                <label className="block text-xs font-black uppercase">Nom de l'étape
                  <input maxLength={60} value={step.name} onChange={(e) => patch({ name: e.target.value })} className={SEL} />
                </label>
                <label className="block text-xs font-black uppercase">Changer de carte
                  <select value="" onChange={(e) => { if (!e.target.value) return; if (!confirm("Remplacer la carte, ses mobs, trésors, musique et texte ?")) return; const f = fresh(e.target.value); patch({ name: f.name, tiles: f.tiles, spawn: f.spawn, source: f.source, enemies: f.enemies, treasures: f.treasures ?? [], track: f.track, intro: f.intro }); }} className={SEL}>
                    <option value="">Choisir…</option>
                    {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </label>
                <p className="text-xs font-bold">{step.enemies.length} mobs · {step.treasures?.length ?? 0} trésors · {step.track ? TRACKS.find((t) => t.key === step.track)?.label : "Sans musique"}</p>
                <Link to="/operations" className="inline-flex min-h-11 items-center underline">Cartes prêtes à jouer</Link>
                <p className="text-xs text-muted-foreground">La carte est copiée dans l'étape : tes retouches ici ne modifient pas l'original.</p>
                <Link to="/cartes" className="inline-flex min-h-11 items-center underline">Créer une nouvelle carte</Link>
              </>}

              {section === "mobs" && <>
                <label className="block text-xs font-black uppercase">Mob à placer
                  <select value={mobId} onChange={(e) => setMobId(e.target.value)} className={SEL}>
                    {(cat.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </label>
                <p className="text-xs text-muted-foreground">{picked === null ? "Touche une case libre pour poser le mob. Touche un mob pour le sélectionner, puis une autre case pour le déplacer." : "Touche une case pour déplacer le mob sélectionné, ou touche-le à nouveau pour annuler."}</p>
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {step.enemies.length === 0 && <li className="text-muted-foreground">Aucun mob sur cette étape.</li>}
                  {step.enemies.map((e, i) => (
                    <li key={i} className={`flex items-center gap-1 border-2 px-1 py-1 ${i === picked ? "border-primary" : "border-foreground/40"}`}>
                      <button className="min-h-11 flex-1 truncate text-left" onClick={() => setPicked(i === picked ? null : i)}>{catIcon(e.catalogId)} {catName(e.catalogId)}</button>
                      <label className="text-xs">X<input type="number" min={0} max={GRID - 1} value={e.x} onChange={(v) => setCoord(i, "x", v.target.valueAsNumber)} className="ml-0.5 h-9 w-12 border border-input bg-background px-1" /></label>
                      <label className="text-xs">Y<input type="number" min={0} max={GRID - 1} value={e.y} onChange={(v) => setCoord(i, "y", v.target.valueAsNumber)} className="ml-0.5 h-9 w-12 border border-input bg-background px-1" /></label>
                      <Button size="sm" variant="ghost" aria-label={`Supprimer ${catName(e.catalogId)}`} onClick={() => { patch({ enemies: step.enemies.filter((_, j) => j !== i) }); setPicked(null); }}>✕</Button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs">Les mobs arrivent cachés au lancement de l'étape ; tu les révèles ensuite depuis l'onglet « Ennemis ».</p>
              </>}

              {section === "decor" && <>
                <p className="text-xs font-black uppercase">Pinceau</p>
                <div className="grid grid-cols-4 gap-1">
                  {SPRITES.map((s) => (
                    <button key={s.code} title={s.label} aria-label={s.label} aria-pressed={brush === s.code} onClick={() => setBrush(s.code)} className={`flex min-h-11 items-center justify-center border-2 ${brush === s.code ? "border-primary" : "border-transparent"}`}><SpriteSwatch code={s.code} /></button>
                  ))}
                  <button aria-pressed={brush === 0} onClick={() => setBrush(0)} className={`min-h-11 border-2 text-[10px] font-black uppercase ${brush === 0 ? "border-primary" : "border-foreground/40"}`}>Barrière</button>
                  <button aria-pressed={brush === "spawn"} onClick={() => setBrush("spawn")} className={`min-h-11 border-2 text-[10px] font-black uppercase ${brush === "spawn" ? "border-primary" : "border-foreground/40"}`}>Départ</button>
                </div>
                <p className="text-xs text-muted-foreground">Glisse sur la carte pour peindre. La grille reste toujours de 40 × 40 cases ; un mob recouvert par un mur est retiré.</p>
              </>}

              {section === "musique" && <>
                <label className="block text-xs font-black uppercase">Musique de cette carte
                  <select value={step.track ?? ""} onChange={(e) => patch({ track: e.target.value || null })} className={SEL}>
                    <option value="">Garder la musique en cours</option>
                    {TRACKS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-black uppercase">Texte affiché à l'arrivée
                  <textarea maxLength={1000} rows={5} value={step.intro} onChange={(e) => patch({ intro: e.target.value })} placeholder="Ce que les aventuriers découvrent en arrivant…" className="mt-1 w-full border-2 border-foreground bg-background p-2 font-normal normal-case" />
                </label>
              </>}
            </div>
          </div>
        </section>
      )}

      <div className="sticky bottom-0 z-10 space-y-2 border-2 border-foreground bg-background p-2">
        {dirty && <p className="text-xs font-bold" role="status">Modifications non enregistrées.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button disabled={busy || !dirty} onClick={saveAll} className="min-h-11 rounded-none font-black uppercase">{busy ? "…" : "Enregistrer le parcours"}</Button>
          {d.game.status === "playing" && step && (
            <Button variant="outline" disabled={busy || dirty} onClick={() => launch(current < steps.length - 1 && current >= 0 && sel === current ? current + 1 : sel)} className="min-h-11 rounded-none font-black uppercase">
              {sel === current && current < steps.length - 1 ? `Passer à l'étape ${current + 2}` : `Lancer l'étape ${sel + 1}`}
            </Button>
          )}
        </div>
        {d.game.status === "waiting" && <p className="text-xs text-muted-foreground">Une fois la partie lancée, tu pourras lancer chaque étape d'ici.</p>}
      </div>
    </div>
  );
}
