import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Brush, Eraser, Flag, OctagonX, PaintBucket, Plus, Skull, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapCanvas, SpriteSwatch } from "@/components/maps/MapCanvas";
import { CatalogArtwork } from "@/components/operations/CatalogArtwork";
import { blockedMapEnemies, placeMapEnemy } from "@/lib/map-enemies";
import { barrierTile, CELLS, GRID, PREBUILT_MAPS, SPRITES, validateGrid, type GridMap } from "@/lib/map-grid";
import { createPersonalMapEnemy, deleteMyMap, listMapEnemyCatalog, listMyMaps, saveMyMap, type MapEnemy } from "@/lib/maps.functions";

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

type Tool = "brush" | "block" | "fill" | "erase" | "spawn" | "enemy";
type Draft = GridMap & { id?: string; enemies?: MapEnemy[] };

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
  const catalogFn = useServerFn(listMapEnemyCatalog);
  const catalog = useQuery({ queryKey: ["map-enemy-catalog"], queryFn: () => catalogFn() });
  const [enemyId, setEnemyId] = useState("");
  const createEnemy = useServerFn(createPersonalMapEnemy);
  const [customForm, setCustomForm] = useState(false);
  const [custom, setCustom] = useState({ name: "", category: "créature" as "créature" | "robot" | "boss" | "humanoïde", icon: "☠", speed: 2, strength: 3, endurance: 3, ability: "" });
  const [creating, setCreating] = useState(false);
  async function saveEnemy() {
    setCreating(true); setMsg(null);
    try {
      const r = await createEnemy({ data: custom });
      await qc.invalidateQueries({ queryKey: ["map-enemy-catalog"] });
      setEnemyId(r.id); setCustomForm(false); setTool("enemy"); setMsg("Ennemi personnel créé.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Création impossible."); }
    finally { setCreating(false); }
  }
  const [position, setPosition] = useState({ x: 1, y: 1 });
  const icon = (id: string) => catalog.data?.find((c) => c.id === id)?.icon || "☠";
  const markers = (enemies: MapEnemy[] = []) => enemies.map((e) => ({ x: e.x, y: e.y, glyph: icon(e.catalogId), zombie: /zombie/i.test(catalog.data?.find((c) => c.id === e.catalogId)?.name ?? "") }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function paint(x: number, y: number, kind: "down" | "move") {
    if (!draft || x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    if (tool === "enemy") {
      if (kind !== "down") return;
      const list = draft.enemies ?? [];
      const here = list.findIndex((e) => e.x === x && e.y === y);
      if (here >= 0) { setDraft({ ...draft, enemies: list.filter((_, i) => i !== here) }); return; }
      addEnemy(x, y); return;
    }
    if (tool === "spawn") { if (kind === "down") setDraft({ ...draft, spawn: { x, y } }); return; }
    if (tool === "fill") {
      if (kind !== "down") return;
      const tiles = [...draft.tiles], from = tiles[y * GRID + x], to = sprite;
      if (from === to) return;
      const stack = [[x, y]];
      while (stack.length) { const point = stack.pop(); if (!point) continue; const [cx, cy] = point; if (cx === undefined || cy === undefined || cx < 0 || cy < 0 || cx >= GRID || cy >= GRID || tiles[cy * GRID + cx] !== from) continue; tiles[cy * GRID + cx] = to; stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]); }
      setDraft({ ...draft, tiles }); return;
    }
    const v = tool === "block" ? barrierTile(sprite) : tool === "erase" ? 6 : sprite;
    if (draft.tiles[y * GRID + x] === v) return;
    setDraft((d) => d && { ...d, tiles: d.tiles.map((t, i) => (i === y * GRID + x ? v : t)) });
  }

  function addEnemy(x: number, y: number) {
    if (!draft) return;
    const next = placeMapEnemy(draft, { catalogId: enemyId, x, y });
    if (typeof next === "string") { setMsg(next); return; }
    setDraft(next); setPosition({ x: x + 1, y: y + 1 }); setMsg(null);
  }

  async function submit() {
    if (!draft) return;
    const err = validateGrid(draft.tiles, draft.spawn);
    if (err) { setMsg(err); return; }
    if (blockedMapEnemies(draft).length) { setMsg("Un ennemi est sur une case bloquée : déplace-le ou remets du sol avant d'enregistrer."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await save({ data: { id: draft.id, name: draft.name, tiles: draft.tiles, spawn: draft.spawn, enemies: draft.enemies ?? [] } });
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

  const tools: [Tool, string, typeof Brush][] = [["brush", "Pinceau", Brush], ["block", "Barrière", OctagonX], ["fill", "Remplir", PaintBucket], ["erase", "Gomme", Eraser], ["spawn", "Départ", Flag], ["enemy", "Ennemi", Skull]];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-10">
      <p className="section-label">Atelier du narrateur</p>
      <h1 data-motion-enter className="mt-2 font-display text-xl uppercase sm:text-2xl">Mes cartes</h1>
      <p className="mt-2 text-sm text-muted-foreground">40 × 40 cases · Cartes personnelles</p>

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
                <MapCanvas tiles={m.tiles} spawn={m.spawn} markers={markers(m.enemies)} label={`Aperçu de ${m.name}`} />
                <p className="mt-2 font-bold">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.enemies.length} ennemi(s)</p>
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
                <Button variant="secondary" className="mt-2 min-h-11 w-full rounded-none" onClick={() => setDraft({ name: `${m.name} (copie)`, tiles: [...m.tiles], spawn: { ...m.spawn }, enemies: [] })}>Dupliquer</Button>
              </li>)}
            </ul>
          </div>
        </section>
      ) : (
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0">
            <div className="mx-auto max-w-[min(100%,44rem)] border-2 border-foreground">
              <MapCanvas tiles={draft.tiles} spawn={draft.spawn} onCell={paint} markers={markers(draft.enemies)} label={`Éditeur de ${draft.name}, 40 × 40 cases`} className="cursor-crosshair" />
            </div>
            <div className="mt-4 flex items-center justify-between border-b-2 border-foreground pb-2">
              <h2 className="font-display text-xs uppercase">Ennemis placés</h2><span className="text-sm">{draft.enemies?.length ?? 0}</span>
            </div>
            <ul className="mt-2 divide-y divide-border">
              {(draft.enemies ?? []).map((e, i) => <li key={`${e.x}:${e.y}`} className="flex min-h-11 items-center justify-between gap-2 text-sm">
                <span>{catalog.data?.find((c) => c.id === e.catalogId)?.name ?? "Ennemi"} · Col. {e.x + 1}, lig. {e.y + 1}</span>
                <Button variant="ghost" size="icon" aria-label={`Retirer l'ennemi ${i + 1}`} className="size-11 shrink-0" disabled={busy} onClick={() => setDraft({ ...draft, enemies: (draft.enemies ?? []).filter((_, n) => n !== i) })}><Trash2 /></Button>
              </li>)}
            </ul>
          </div>
          <aside className="space-y-4">
            <label className="block text-xs font-black uppercase">Nom
              <Input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 h-11 rounded-none font-normal normal-case" />
            </label>
            <div role="radiogroup" aria-label="Outil" className="grid grid-cols-3 border-2 border-foreground sm:grid-cols-6 lg:grid-cols-3">
              {tools.map(([k, l, Icon]) => <Button key={k} role="radio" aria-label={l} aria-checked={tool === k} variant={tool === k ? "default" : "ghost"} onClick={() => setTool(k)} className="h-auto min-h-11 flex-col gap-1 rounded-none px-0 text-[10px] font-black uppercase"><Icon className="size-4" />{l}</Button>)}
            </div>
            <Button variant={tool === "enemy" ? "default" : "outline"} onClick={() => setTool("enemy")} className="min-h-11 w-full rounded-none"><Skull />Ennemis · {draft.enemies?.length ?? 0}</Button>
            {tool === "enemy" && <div className="space-y-2 border-2 border-foreground p-2">
              <label className="block text-xs font-black uppercase">Ennemi à poser
                <select aria-label="Ennemi à poser" value={enemyId} onChange={(e) => setEnemyId(e.target.value)} className="mt-1 h-11 w-full border-2 border-foreground bg-background px-2 font-normal normal-case">
                  <option value="">Choisir…</option>
                  {catalog.data?.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}{c.owner_id ? " · Personnel" : ""}</option>)}
                </select>
              </label>
              <Button variant="outline" className="min-h-11 w-full whitespace-normal" onClick={() => setCustomForm(!customForm)}><Plus />Créer un ennemi personnalisé</Button>
              {customForm && <form className="space-y-3 border-y border-border py-3" onSubmit={(e) => { e.preventDefault(); void saveEnemy(); }}>
                <label className="block text-xs font-bold">Nom de l'ennemi<Input required maxLength={40} value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} className="mt-1 h-11" /></label>
                <label className="block text-xs font-bold">Apparence<select value={custom.category} onChange={(e) => setCustom({ ...custom, category: e.target.value as typeof custom.category })} className="mt-1 h-11 w-full border-2 border-foreground bg-background px-2">{["créature", "robot", "boss", "humanoïde"].map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                <CatalogArtwork kind="mob" item={{ name: custom.name || "Ennemi personnel", category: custom.category }} />
                <div className="grid grid-cols-3 gap-2">{(["speed", "strength", "endurance"] as const).map((key) => <label key={key} className="text-xs font-bold">{{ speed: "Vitesse", strength: "Force", endurance: "Endurance" }[key]}<Input type="number" required min={1} max={5} value={custom[key]} onChange={(e) => setCustom({ ...custom, [key]: Number(e.target.value) })} className="mt-1 h-11 px-1" /></label>)}</div>
                <label className="block text-xs font-bold">Capacité<Input maxLength={120} value={custom.ability} onChange={(e) => setCustom({ ...custom, ability: e.target.value })} className="mt-1 h-11" /></label>
                <Button type="submit" disabled={creating || !custom.name.trim()} className="min-h-11 w-full whitespace-normal">{creating ? "Création…" : "Enregistrer cet ennemi"}</Button>
              </form>}
              {catalog.isLoading && <p role="status" className="text-xs">Chargement des ennemis…</p>}
              {catalog.isError && <p role="alert" className="text-xs">Catalogue inaccessible.</p>}
              {catalog.data?.find((c) => c.id === enemyId) && <CatalogArtwork kind="mob" item={catalog.data.find((c) => c.id === enemyId) ?? { name: "Ennemi" }} />}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold">Colonne<Input type="number" min={1} max={40} value={position.x} onChange={(e) => setPosition({ ...position, x: Number(e.target.value) })} className="mt-1 h-11" /></label>
                <label className="text-xs font-bold">Ligne<Input type="number" min={1} max={40} value={position.y} onChange={(e) => setPosition({ ...position, y: Number(e.target.value) })} className="mt-1 h-11" /></label>
              </div>
              <Button variant="secondary" className="min-h-11 w-full rounded-none" disabled={!enemyId || busy} onClick={() => addEnemy(position.x - 1, position.y - 1)}><Plus />Placer l'ennemi</Button>
            </div>}
            <div role="radiogroup" aria-label="Décor" className="grid grid-cols-2 gap-2">
              {tool !== "enemy" && SPRITES.map((s) => <Button variant="outline" key={s.code} role="radio" aria-checked={sprite === s.code} onClick={() => { setSprite(s.code); if (tool !== "brush" && tool !== "fill" && tool !== "block") setTool("brush"); }} className={`h-auto min-h-11 justify-start gap-2 rounded-none border-2 p-1 text-left text-xs ${sprite === s.code ? "border-primary bg-secondary" : "border-foreground/30"}`}>
                <SpriteSwatch code={s.code} /><span><b>{s.label}</b><br /><span className="opacity-70">{tool === "block" ? "Barrière" : s.walk ? "Praticable" : "Bloquant"}</span></span>
              </Button>)}
            </div>
            {msg && <p role="status" className="anim-enter text-sm font-bold">{msg}</p>}
            <Button onClick={submit} disabled={busy} className="h-11 w-full rounded-none font-black uppercase">{busy ? <span className="anim-loading">Enregistrement…</span> : "Enregistrer"}</Button>
            <Button variant="outline" onClick={() => { setDraft(null); setMsg(null); }} className="h-11 w-full rounded-none">Retour à mes cartes</Button>
          </aside>
        </section>
      )}
    </main>
  );
}
