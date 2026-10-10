import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moveWorldPlayer } from "@/lib/world.functions";
import { worldPosition, type WorldDirection } from "@/lib/world-map";
import { zoneLabel } from "@/lib/races";
import type { WorldActor } from "./world-scene";
import type Phaser from "phaser";

const FRAMES: Record<string, number> = { Humain: 7, Insecte: 8, Reptile: 9, Crustacé: 10, Oiseau: 11 };
export function SalonWorld({ d, zone, name, onChange }: { d: any; zone?: string; name?: string; onChange: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  const move = useServerFn(moveWorldPlayer);
  const here = zone ?? d.me.current_zone ?? "entree";
  const enabled = d.game.status === "playing" && d.me.role === "adventurer" && d.me.hp > 0 && here === (d.me.current_zone ?? "entree");
  const actors: WorldActor[] = d.players.filter((p: any) => p.role === "adventurer" && (p.current_zone ?? "entree") === here).map((p: any) => ({ id: p.id, name: p.display_name + (p.id === d.me.id ? " · toi" : ""), ...worldPosition(p, here), frame: FRAMES[p.race] ?? 7 }));
  d.enemies.filter((e: any) => e.status === "revele" && e.zone === here).forEach((e: any, i: number) => actors.push({ id: e.id, name: e.name, x: 16 + i % 4, y: 9, frame: 12 }));
  useEffect(() => {
    let disposed = false;
    import("./world-scene").then(({ createWorldGame }) => {
      if (disposed || !mount.current) return;
      game.current = createWorldGame(mount.current, () => { if (!disposed) setReady(true); });
    }).catch(() => { if (!disposed) setFailure(true); });
    return () => { disposed = true; game.current?.destroy(true); game.current = null; };
  }, []);
  useEffect(() => {
    if (ready) game.current?.scene.getScene("SalonWorld").events.emit("actors", actors);
  }, [ready, JSON.stringify(actors)]);
  async function step(direction: WorldDirection) {
    if (!enabled || lock.current || !ready) return;
    lock.current = true; setBusy(true);
    try { const result = await move({ data: { gameId: d.game.id, direction } }); setMessage(result.message); onChange(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Déplacement impossible."); onChange(); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="space-y-3" aria-label="Exploration en vue de dessus">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-pixel text-xl">{name ?? zoneLabel(here)}</h2><span className="text-xs text-muted-foreground">{actors.filter((a) => a.frame < 12).length} aventurier(s)</span></div>
    <div tabIndex={0} role="group" aria-label="Carte du salon, vue de dessus" className="salon-world relative overflow-hidden border-2 border-foreground bg-game outline-none focus-visible:ring-2 focus-visible:ring-ring" onKeyDown={(event) => {
      const keys: Record<string, WorldDirection> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      const direction = keys[event.key];
      if (direction && enabled) { event.preventDefault(); void step(direction); }
    }}>
      <div ref={mount} className="salon-world-canvas" />
      {!ready && <p role={failure ? "alert" : "status"} className="absolute inset-0 flex items-center justify-center bg-game">{failure ? "La carte n'a pas pu être affichée." : "Chargement de la carte…"}</p>}
    </div>
    {enabled && <div className="flex items-center justify-between gap-3"><p role="status" className="min-w-0 text-sm text-muted-foreground">{message || (busy ? "Déplacement…" : "")}</p><div className="grid shrink-0 grid-cols-3 grid-rows-3 gap-1">
      {([["up", "Monter", ChevronUp, "col-start-2"], ["left", "Gauche", ChevronLeft, "col-start-1 row-start-2"], ["right", "Droite", ChevronRight, "col-start-3 row-start-2"], ["down", "Descendre", ChevronDown, "col-start-2 row-start-3"]] as const).map(([dir, label, Icon, cls]) => <Button key={dir} variant="secondary" size="icon" aria-label={label} title={label} disabled={busy || !ready} className={`h-11 w-11 ${cls}`} onClick={() => void step(dir)}><Icon /></Button>)}
    </div></div>}
  </section>;
}