import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Brush, Eraser, Flag, OctagonX, PaintBucket, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapCanvas, SpriteSwatch } from "@/components/maps/MapCanvas";
import { CELLS, GRID, PREBUILT_MAPS, SPRITES, validateGrid, type GridMap } from "@/lib/map-grid";
import { deleteMyMap, listMyMaps, saveMyMap } from "@/lib/maps.functions";

export const Route = createFileRoute("/_authenticated/cartes")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Mes cartes — Bastion" },
      { name: "description", content: "Éditeur de cartes 40 × 40 du narrateur Bastion." },
      { property: "og:title", content: "Mes cartes — Bastion" },
      { property: "og:description", content: "Éditeur de cartes 40 × 40 du narrateur Bastion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapsPage,
});

type Tool = "brush" | "block" | "fill" | "erase" | "spawn";
type Draft = GridMap & { id?: string };

function blank(): Draft {
  const tiles = Array<number>(CELLS).fill(6);
  for (let i = 0; i < GRID; i++) { tiles[i] = 7; tiles[(GRID - 1) * GRID + i] = 7; tiles[i * GRID] = 7; tiles[i * GRID + GRID - 1] = 7; }
  return { name: "Nouvelle carte", tiles, spawn: { x: 20, y: 20 } };
}

function MapsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMyMaps);
  const save = useServerFn(saveMyMap);
  const remove = useServerFn(deleteMyMap);
  const maps = useQuery({ queryKey: ["my-maps"], queryFn: () => list() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tool, setTool] = useState<Tool>("brush");
  const [sprite, setSprite] = useState(6);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function paint(x: number, y: number, kind: "down" | "move") {
    if (!draft) return;
    if (tool === "spawn") { if (kind === "down") setDraft({ ...draft, spawn: { x, y } }); return; }
    if (tool === "fill") {
      if (kind !== "down") return;
      const tiles = [...draft.tiles], from = tiles[y * GRID + x], to = sprite;
      if (from === to) return;
      const stack = [[x, y]];
      while (stack.length) { const [cx, cy] = stack.pop()!; if (cx! < 0 || cy! < 0 || cx! >= GRID || cy! >= GRID || tiles[cy! * GRID + cx!] !== from) continue; tiles[cy! * GRID + cx!] = to; stack.push([cx! + 1, cy!], [cx! - 1, cy!], [cx!, cy! + 1], [cx!, cy! - 1]); }
      setDraft({ ...draft, tiles }); return;
    }
    const v = tool === "block" ? 0 : tool === "erase" ? 6 : sprite;
    if (draft.tiles[y * GRID + x] === v) return;
    setDraft((d) => d && { ...d, tiles: d.tiles.map((t, i) => (i === y * GRID + x ? v : t)) });
  }

  async function submit() {
    if (!draft) return;
    const err = validateGrid(draft.tiles, draft.spawn);
    if (err) { setMsg(err); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await save({ data: { id: draft.id, name: draft.name, tiles: draft.tiles, spawn: draft.spawn } });
      setDraft({ ...draft, id: r.id }); setMsg("Carte enregistrée.");
      await qc.invalidateQueries({ queryKey: ["my-maps"] });
    } catch (e) { setMsg(e instanceof Error ? e.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm("Supprimer cette carte ?")) return;
    await remove({ data: { id } });
    if (draft?.id === id) setDraft(null);
    await qc.invalidateQueries({ queryKey: ["my-maps"] });
  }

  const tools: [Tool, string, typeof Brush][] = [["brush", "Pinceau", Brush], ["block", "Barrière", OctagonX], ["fill", "Remplir", PaintBucket], ["erase", "Gomme", Eraser], ["spawn", "Départ", Flag]];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-10">
      <p className="section-label">Atelier du narrateur</p>
      <h1 data-motion-enter className="mt-2 font-display text-2xl uppercase">Mes cartes</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Toutes les cartes font 40 × 40 cases. Peins le décor case par case, place le point de départ, puis charge la carte dans un salon depuis l'onglet « Carte » du narrateur.</p>

      {!draft ? (
        <section className="mt-8 space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setDraft(blank())} className="min-h-11 rounded-none font-black uppercase"><Plus />Nouvelle carte</Button>
          </div>
          <div>
            <h2 className="font-display text-sm uppercase">Mes cartes</h2>
            {maps.isLoading && <p className="mt-2 anim-loading text-sm">Chargement…</p>}
            {maps.isError && <p role="alert" className="mt-2 text-sm font-bold text-primary">Impossible de charger tes cartes.</p>}
            {maps.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Aucune carte pour l'instant : crée-en une ou pars d'une carte préconstruite.</p>}
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {maps.data?.map((m) => <li key={m.id} className="border-2 border-foreground p-2">
                <MapCanvas tiles={m.tiles} spawn={m.spawn} label={`Aperçu de ${m.name}`} />
                <p className="mt-2 font-bold">{m.name}</p>
                <div className="mt-2 flex gap-2"><Button variant="secondary" className="min-h-11 flex-1 rounded-none" onClick={() => setDraft({ ...m })}>Modifier</Button><Button variant="outline" size="icon" aria-label="Supprimer" className="size-11 rounded-none" onClick={() => del(m.id)}><Trash2 /></Button></div>
              </li>)}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-sm uppercase">Partir d'une carte préconstruite</h2>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.values(PREBUILT_MAPS).map((m) => <li key={m.name} className="border-2 border-foreground p-2">
                <MapCanvas tiles={m.tiles} spawn={m.spawn} label={`Aperçu de ${m.name}`} />
                <p className="mt-2 font-bold">{m.name}</p>
                <Button variant="secondary" className="mt-2 min-h-11 w-full rounded-none" onClick={() => setDraft({ name: `${m.name} (copie)`, tiles: [...m.tiles], spawn: { ...m.spawn } })}>Dupliquer</Button>
              </li>)}
            </ul>
          </div>
        </section>
      ) : (
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0">
            <div className="mx-auto max-w-[min(100%,44rem)] border-2 border-foreground">
              <MapCanvas tiles={draft.tiles} spawn={draft.spawn} onCell={paint} label={`Éditeur de ${draft.name}, 40 × 40 cases`} className="cursor-crosshair" />
            </div>
          </div>
          <aside className="space-y-4">
            <label className="block text-xs font-black uppercase">Nom
              <Input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 h-11 rounded-none font-normal normal-case" />
            </label>
            <div role="radiogroup" aria-label="Outil" className="grid grid-cols-4 border-2 border-foreground">
              {tools.map(([k, l, Icon]) => <button key={k} role="radio" aria-checked={tool === k} onClick={() => setTool(k)} className={`flex min-h-11 flex-col items-center justify-center text-[10px] font-black uppercase ${tool === k ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}><Icon className="size-4" />{l}</button>)}
            </div>
            <div role="radiogroup" aria-label="Décor" className="grid grid-cols-2 gap-2">
              {SPRITES.map((s) => <button key={s.code} role="radio" aria-checked={sprite === s.code} onClick={() => { setSprite(s.code); if (tool === "erase" || tool === "spawn") setTool("brush"); }} className={`flex min-h-11 items-center gap-2 border-2 p-1 text-left text-xs ${sprite === s.code ? "border-primary bg-secondary" : "border-foreground/30"}`}>
                <SpriteSwatch code={s.code} /><span><b>{s.label}</b><br /><span className="opacity-70">{s.walk ? "Praticable" : "Bloquant"}</span></span>
              </button>)}
            </div>
            {msg && <p role="status" className="anim-enter text-sm font-bold">{msg}</p>}
            <Button onClick={submit} disabled={busy} className="h-11 w-full rounded-none font-black uppercase">{busy ? <span className="anim-loading">Enregistrement…</span> : "Enregistrer"}</Button>
            <Button variant="outline" onClick={() => { setDraft(null); setMsg(null); }} className="h-11 w-full rounded-none">Retour à mes cartes</Button>
            <p className="text-xs text-muted-foreground">Le carré blanc marque le point de départ des aventuriers. Les cases vides sont infranchissables.</p>
          </aside>
        </section>
      )}
    </main>
  );
}
