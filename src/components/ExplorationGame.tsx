import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Download, Save, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Crosshair, DoorClosed, Radio, Skull, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import sectorMap from "@/data/sector-01.json";
import { getExplorationState, loadGame, moveExplorer, placeNarratorEntity, resolveCombatTurn, saveGame } from "@/lib/exploration.functions";

type Entity = { id: string; kind: string; label: string; tile_x: number; tile_y: number; hp: number | null; locked: boolean; active: boolean };
type Player = { id: string; client_key: string; name: string; race: string; tile_x: number; tile_y: number; hp: number };
type State = Awaited<ReturnType<typeof getExplorationState>>;
type Direction = "up" | "down" | "left" | "right";
type Race = "Humain" | "Insecte" | "Reptile" | "Crustacé" | "Oiseau";

const raceSpeed: Record<Race, number> = { Humain: 70, Insecte: 95, Reptile: 35, Crustacé: 20, Oiseau: 100 };

function getClientKey() {
  const stored = window.localStorage.getItem("bastion-client-key");
  if (stored) return stored;
  const key = crypto.randomUUID();
  window.localStorage.setItem("bastion-client-key", key);
  return key;
}

export function ExplorationGame() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ destroy: (removeCanvas: boolean) => void; scene: { getScene: (key: string) => { events: { emit: (event: string, payload: unknown) => void } } } } | null>(null);
  const clientKeyRef = useRef("");
  const getState = useServerFn(getExplorationState);
  const move = useServerFn(moveExplorer);
  const combatTurn = useServerFn(resolveCombatTurn);
  const placeEntity = useServerFn(placeNarratorEntity);
  const [state, setState] = useState<State | null>(null);
  const [race, setRace] = useState<Race>("Humain");
  const [message, setMessage] = useState("Ordres reçus. Explorez le secteur.");
  const [encounter, setEncounter] = useState<{ id: string; label: string; kind: string } | null>(null);
  const [enemyHp, setEnemyHp] = useState(12);
  const [narratorMode, setNarratorMode] = useState(false);
  const [placing, setPlacing] = useState<"enemy" | "trap" | "door" | "event">("enemy");
  const save = useServerFn(saveGame);
  const load = useServerFn(loadGame);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalFilter, setJournalFilter] = useState("all");
  const [sceneReady, setSceneReady] = useState(false);

  const refresh = async () => setState(await getState());

  const exportJournal = () => {
    if (!state) return;
    const events = [...state.events].reverse();
    const lines = [
      `# BASTION — Rapport de partie`,
      ``,
      `- Secteur : ${state.session.name}`,
      `- Objectif : ${state.session.objective}`,
      `- Statut : ${state.session.status}`,
      `- Exporté le : ${new Date().toLocaleString("fr-FR")}`,
      ``,
      `## Aventuriers`,
      ``,
      ...(state.players.length ? state.players.map((p) => `- ${p.name} (${p.race}) — PV ${p.hp}, position (${p.tile_x}, ${p.tile_y})`) : ["- Aucun aventurier enregistré."]),
      ``,
      `## Entités actives`,
      ``,
      ...(state.entities.length ? state.entities.map((e) => `- ${e.label} [${e.kind}] en (${e.tile_x}, ${e.tile_y})${e.hp != null ? ` — PV ${e.hp}` : ""}${e.locked ? " — verrouillé" : ""}`) : ["- Aucune entité active."]),
      ``,
      `## Journal chronologique`,
      ``,
      ...(events.length ? events.map((e) => `- [${new Date(e.created_at).toLocaleString("fr-FR")}] **${e.event_type.toUpperCase()}** — ${e.message}`) : ["- Aucun événement."]),
      ``,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bastion-journal-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    clientKeyRef.current = getClientKey();
    void refresh();
    const channel = supabase.channel("bastion-exploration").on("postgres_changes", { event: "*", schema: "public", table: "exploration_players" }, refresh).on("postgres_changes", { event: "*", schema: "public", table: "exploration_entities" }, refresh).on("postgres_changes", { event: "*", schema: "public", table: "exploration_events" }, refresh).on("postgres_changes", { event: "*", schema: "public", table: "exploration_saves" }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!mountRef.current || gameRef.current) return;
    let disposed = false;
    void import("phaser").then((module) => {
      if (disposed || !mountRef.current) return;
      const Phaser = module.default;
      class SectorScene extends Phaser.Scene {
        graphics!: Phaser.GameObjects.Graphics;
        create() {
          this.graphics = this.add.graphics();
          this.events.on("sync", (payload: { players: Player[]; entities: Entity[]; clientKey: string }) => this.draw(payload));
          window.dispatchEvent(new Event("bastion-scene-ready"));
          this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            const x = Math.floor(pointer.x / 32);
            const y = Math.floor(pointer.y / 32);
            window.dispatchEvent(new CustomEvent("bastion-map-click", { detail: { x, y } }));
          });
        }
        draw(payload: { players: Player[]; entities: Entity[]; clientKey: string }) {
          const g = this.graphics;
          g.clear();
          const data = sectorMap.layers[0]?.data ?? [];
          data.forEach((tile, index) => {
            const x = (index % sectorMap.width) * 32;
            const y = Math.floor(index / sectorMap.width) * 32;
            const colors: Record<number, number> = { 1: 0x333333, 2: 0x090909, 3: 0x161616, 4: 0x6f1313, 5: 0x515151, 6: 0x8b2525 };
            g.fillStyle(colors[tile] ?? 0x111111).fillRect(x, y, 32, 32);
            g.lineStyle(1, tile === 2 ? 0x222222 : 0x484848, 1).strokeRect(x, y, 32, 32);
            if (tile === 3) { g.lineStyle(2, 0xc51f2c).lineBetween(x + 4, y + 4, x + 28, y + 28).lineBetween(x + 28, y + 4, x + 4, y + 28); }
            if (tile === 4) { g.fillStyle(0xc51f2c).fillCircle(x + 10, y + 12, 3).fillCircle(x + 23, y + 22, 4); }
          });
          payload.entities.forEach((entity) => {
            const x = entity.tile_x * 32 + 16;
            const y = entity.tile_y * 32 + 16;
            const color = entity.kind === "objective" ? 0xd4d4d4 : entity.kind === "door" ? 0x777777 : 0xc51f2c;
            g.fillStyle(color);
            if (entity.kind === "enemy") g.fillTriangle(x, y - 11, x - 11, y + 10, x + 11, y + 10);
            else if (entity.kind === "trap") g.lineStyle(3, color).strokeCircle(x, y, 10);
            else if (entity.kind === "door") g.fillRect(x - 4, y - 15, 8, 30);
            else g.fillRect(x - 8, y - 8, 16, 16);
          });
          payload.players.forEach((player) => {
            const own = player.client_key === payload.clientKey;
            g.fillStyle(own ? 0xf1f1ed : 0x999999).fillRect(player.tile_x * 32 + 7, player.tile_y * 32 + 7, 18, 18);
            g.lineStyle(own ? 3 : 1, 0xc51f2c).strokeRect(player.tile_x * 32 + 5, player.tile_y * 32 + 5, 22, 22);
          });
        }
      }
      gameRef.current = new Phaser.Game({ type: Phaser.CANVAS, width: 608, height: 352, parent: mountRef.current, backgroundColor: "#090909", pixelArt: true, antialias: false, roundPixels: true, scene: SectorScene });
    });
    return () => { disposed = true; gameRef.current?.destroy(true); gameRef.current = null; };
  }, []);

  useEffect(() => {
    const ready = () => setSceneReady(true);
    window.addEventListener("bastion-scene-ready", ready);
    return () => window.removeEventListener("bastion-scene-ready", ready);
  }, []);

  useEffect(() => {
    if (!state || !gameRef.current || !sceneReady) return;
    const scene = gameRef.current.scene.getScene("SectorScene");
    scene?.events.emit("sync", { players: state.players, entities: state.entities, clientKey: clientKeyRef.current });
  }, [state, sceneReady]);

  useEffect(() => {
    const handleClick = (event: Event) => {
      if (!narratorMode) return;
      const { x, y } = (event as CustomEvent<{ x: number; y: number }>).detail;
      void placeEntity({ data: { kind: placing, x, y } }).then(() => { setMessage("Élément placé en direct."); void refresh(); }).catch(() => setMessage("Cette case refuse le placement."));
    };
    window.addEventListener("bastion-map-click", handleClick);
    return () => window.removeEventListener("bastion-map-click", handleClick);
  }, [narratorMode, placing]);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      const directions: Record<string, Direction> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      const direction = directions[event.key];
      if (direction && !encounter) { event.preventDefault(); void handleMove(direction); }
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  });

  async function handleMove(direction: Direction) {
    const result = await move({ data: { clientKey: clientKeyRef.current, race, direction } });
    setMessage(result.message);
    if (result.encounter) { setEncounter(result.encounter); setEnemyHp(result.encounter.kind === "enemy" ? 12 : 1); }
    await refresh();
  }

  async function handleCombat(action: "Attaquer" | "Compétence" | "Objet" | "Fuir") {
    if (!encounter) return;
    const result = await combatTurn({ data: { entityId: encounter.id, action, speed: raceSpeed[race] } });
    setMessage(`${result.text} Dés : ${result.rolls[0]} / ${result.rolls[1]}`);
    setEnemyHp(result.enemyHp);
    if (result.finished) setEncounter(null);
    await refresh();
  }

  return (
    <div className="relative grid border-2 border-primary bg-game lg:grid-cols-[minmax(0,1fr)_290px]">
      <div className="min-w-0 border-b-2 border-primary lg:border-b-0 lg:border-r-2">
        <div className="flex items-center justify-between border-b border-game-line bg-card px-4 py-3"><div><p className="font-pixel text-[10px] uppercase text-primary">Secteur 01</p><h3 className="mt-1 font-pixel text-sm uppercase">Porte Rouge</h3></div><div className="flex items-center gap-2 text-[10px] font-bold uppercase text-game-muted"><Radio size={14} className="text-primary" /> Direct</div></div>
        <div className="game-viewport"><div ref={mountRef} className="game-canvas" /></div>
        <div className="grid gap-3 border-t border-game-line p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="retro-dialog"><span className="text-primary">›</span> {message}</div>
          <div className="grid grid-cols-3 grid-rows-3 gap-1 justify-self-center">
            <Button aria-label="Monter" title="Monter" variant="game" size="gameIcon" className="col-start-2" onClick={() => void handleMove("up")}><ChevronUp /></Button>
            <Button aria-label="Gauche" title="Gauche" variant="game" size="gameIcon" className="col-start-1 row-start-2" onClick={() => void handleMove("left")}><ChevronLeft /></Button>
            <Button aria-label="Droite" title="Droite" variant="game" size="gameIcon" className="col-start-3 row-start-2" onClick={() => void handleMove("right")}><ChevronRight /></Button>
            <Button aria-label="Descendre" title="Descendre" variant="game" size="gameIcon" className="col-start-2 row-start-3" onClick={() => void handleMove("down")}><ChevronDown /></Button>
          </div>
        </div>
      </div>
      <aside className="flex flex-col bg-card">
        <div className="border-b border-game-line p-5"><p className="font-pixel text-[10px] text-primary">OBJECTIF</p><p className="mt-3 text-sm font-bold uppercase">{state?.session.objective ?? "Chargement…"}</p><p className="mt-2 text-[10px] font-bold uppercase text-primary">{state?.session.status === "objectif-atteint" ? "✔ Objectif atteint" : "En cours"}</p></div>
        <div className="border-b border-game-line p-5"><label htmlFor="explorer-race" className="font-pixel text-[10px] text-game-muted">PEUPLE</label><select id="explorer-race" value={race} onChange={(event) => setRace(event.target.value as Race)} className="mt-3 w-full border border-game-line bg-background p-3 text-xs font-bold uppercase outline-none focus:border-primary">{Object.keys(raceSpeed).map((name) => <option key={name}>{name}</option>)}</select><div className="mt-4"><div className="mb-2 flex justify-between text-[10px] font-bold"><span>PV</span><span>20/20</span></div><div className="h-3 border border-foreground p-0.5"><div className="h-full w-full bg-primary" /></div></div></div>
        <div className="border-b border-game-line p-5"><Button variant={narratorMode ? "default" : "outline"} className="w-full rounded-none font-pixel text-[9px]" onClick={() => setNarratorMode((value) => !value)}><Crosshair /> {narratorMode ? "Narrateur actif" : "Mode narrateur"}</Button>{narratorMode && <div className="mt-3 grid grid-cols-4 gap-1">{([['enemy', Skull], ['trap', TriangleAlert], ['door', DoorClosed], ['event', Sparkles]] as const).map(([kind, Icon]) => <Button key={kind} aria-label={`Placer ${kind}`} title={`Placer ${kind}`} variant={placing === kind ? "default" : "game"} size="gameIcon" onClick={() => setPlacing(kind)}><Icon /></Button>)}</div>}<p className="mt-3 text-[10px] leading-relaxed text-game-muted">{narratorMode ? "Choisissez un élément puis touchez une case." : "Les intentions sont validées avant chaque mouvement."}</p></div>
        <div className="border-b border-game-line p-5"><p className="font-pixel text-[10px] text-game-muted">SAUVEGARDES</p><Button variant="game" className="mt-3 w-full rounded-none font-pixel text-[9px]" onClick={() => void save({ data: { label: `Partie ${new Date().toLocaleString("fr-FR")}` } }).then(() => { setMessage("Partie enregistrée."); void refresh(); })}><Save /> Enregistrer</Button><div className="mt-3 space-y-1">{state?.saves.slice(0, 4).map((s) => <button key={s.id} className="block w-full border border-game-line p-2 text-left text-[10px] hover:border-primary" onClick={() => { if (window.confirm(`Reprendre « ${s.label} » ? L'état actuel sera remplacé.`)) void load({ data: { saveId: s.id } }).then(() => { setEncounter(null); setMessage("Partie reprise."); void refresh(); }); }}>↺ {s.label}</button>)}</div></div>
        <div className="flex-1 p-5"><div className="flex items-center justify-between"><p className="font-pixel text-[10px] text-game-muted">JOURNAL</p><Button variant="game" size="sm" className="rounded-none text-[10px]" onClick={() => setJournalOpen(true)}><BookOpen /> Tout voir</Button></div><div className="mt-4 space-y-3">{state?.events.slice(0, 4).map((event) => <p key={event.id} className="border-l-2 border-primary pl-3 text-[10px] leading-relaxed">{event.message}</p>)}</div></div>
      </aside>
      {journalOpen && <div className="absolute inset-0 z-50 flex items-center justify-center bg-game-overlay p-4"><div className="flex max-h-full w-full max-w-2xl flex-col border-4 border-foreground bg-background shadow-game"><div className="flex items-center justify-between border-b-2 border-game-line p-4"><p className="font-pixel text-xs text-primary">JOURNAL DE PARTIE</p><Button variant="game" size="sm" className="rounded-none" onClick={() => setJournalOpen(false)}>Fermer</Button></div><div className="flex flex-wrap gap-1 border-b border-game-line p-3">{([["all", "Tout"], ["move", "Déplacements"], ["combat", "Combats"], ["dice", "Dés"], ["narration", "Narrateur"], ["objective", "Objectif"], ["save", "Sauvegardes"]] as const).map(([key, label]) => <Button key={key} size="sm" variant={journalFilter === key ? "default" : "game"} className="rounded-none text-[10px]" onClick={() => setJournalFilter(key)}>{label}</Button>)}</div><ol className="flex-1 space-y-2 overflow-y-auto p-4">{[...(state?.events ?? [])].reverse().filter((e) => journalFilter === "all" || e.event_type === journalFilter || (journalFilter === "save" && e.event_type === "load") || (journalFilter === "narration" && e.event_type === "ability")).map((e) => <li key={e.id} className="grid grid-cols-[64px_80px_1fr] gap-2 border-l-2 border-primary pl-3 text-[11px]"><span className="text-game-muted">{new Date(e.created_at).toLocaleTimeString("fr-FR")}</span><span className="font-bold uppercase text-primary">{e.event_type}</span><span>{e.message}</span></li>)}</ol></div></div>}
      {encounter && <div className="absolute inset-0 z-40 flex items-center justify-center bg-game-overlay p-4"><div className="w-full max-w-xl border-4 border-foreground bg-background p-2 shadow-game"><div className="border-2 border-game-line p-5"><div className="flex items-start justify-between"><div><p className="font-pixel text-[10px] text-primary">COMBAT</p><h4 className="mt-3 font-pixel text-xl uppercase">{encounter.label}</h4></div><div className="w-32"><div className="flex justify-between text-[9px] font-bold"><span>PV</span><span>{enemyHp}</span></div><div className="mt-2 h-3 border border-foreground p-0.5"><div className="h-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, enemyHp / 12 * 100))}%` }} /></div></div></div><p className="my-7 border-y border-game-line py-4 text-sm">Initiative calculée par la Vitesse. Les dés sont lancés hors du plateau.</p><div className="grid grid-cols-2 gap-2">{(["Attaquer", "Compétence", "Objet", "Fuir"] as const).map((action) => <Button key={action} variant="game" className="rounded-none font-pixel text-[10px]" onClick={() => void handleCombat(action)}>{action}</Button>)}</div></div></div></div>}
    </div>
  );
}