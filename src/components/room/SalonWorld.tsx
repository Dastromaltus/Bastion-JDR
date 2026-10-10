import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Megaphone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moveWorldPlayer } from "@/lib/world.functions";
import { type WorldDirection } from "@/lib/world-map";
import { participantActors, type WorldActor } from "@/lib/world-actors";
import { zoneLabel } from "@/lib/races";
import { salonTurn } from "@/lib/turn-order";
import type Phaser from "phaser";
import { motionDisabled } from "@/lib/motion";

export function SalonWorld({ d, zone, name, onChange }: { d: any; zone?: string; name?: string; onChange: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const view = useRef<HTMLDivElement>(null);
  const previousZone = useRef<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const move = useServerFn(moveWorldPlayer);
  const turn = salonTurn(d.game, d.players, d.me.user_id);
  const followed = turn.active?.role === "adventurer" ? d.players.find((p: any) => p.id === turn.active?.id) : d.players.find((p: any) => p.role === "adventurer");
  const here = zone ?? (d.me.role === "narrator" ? followed?.current_zone : d.me.current_zone) ?? "entree";
  const canMove = d.game.status === "playing" && d.me.role === "adventurer" && d.me.hp > 0 && here === (d.me.current_zone ?? "entree");
  const enabled = canMove && turn.isMine;
  const participants = participantActors(d.players, here, d.me.id);
  const actors: WorldActor[] = [...participants];
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
  useEffect(() => {
    if (previousZone.current && previousZone.current !== here && !motionDisabled()) view.current?.animate(
      [{ opacity: 0.35, transform: "translateX(8px)" }, { opacity: 1, transform: "translateX(0)" }],
      { duration: 200, easing: "linear" },
    );
    previousZone.current = here;
  }, [here]);
  async function step(direction: WorldDirection) {
    if (!enabled || lock.current || !ready) return;
    lock.current = true; setBusy(true);
    try { const result = await move({ data: { gameId: d.game.id, direction } }); setMessage(result.message); onChange(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Déplacement impossible."); onChange(); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="space-y-3" aria-label="Exploration en vue de dessus">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-pixel text-xl">{name ?? zoneLabel(here)}</h2><span className="text-xs text-muted-foreground">{participants.length} participant(s)</span></div>
    <div ref={view} tabIndex={0} role="group" aria-label="Carte du salon, vue de dessus" className="salon-world relative overflow-hidden border-2 border-foreground bg-game outline-none focus-visible:ring-2 focus-visible:ring-ring" onKeyDown={(event) => {
      const keys: Record<string, WorldDirection> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      const direction = keys[event.key];
      if (direction && enabled) { event.preventDefault(); void step(direction); }
    }}>
      <div ref={mount} className="salon-world-canvas" />
      {!ready && <p role={failure ? "alert" : "status"} className="absolute inset-0 flex items-center justify-center bg-game">{failure ? "La carte n'a pas pu être affichée." : "Chargement de la carte…"}</p>}
    </div>
    <ul aria-label="Participants du salon" className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
      {d.players.map((p: any) => <li key={p.id} className="flex min-w-0 items-start gap-2 text-sm">
        {p.role === "narrator" ? <Megaphone className="mt-0.5 size-4 shrink-0 text-primary" /> : <User className="mt-0.5 size-4 shrink-0 text-primary" />}
        <div className="min-w-0"><p className="break-words font-bold">{p.display_name}{p.id === d.me.id ? " · toi" : ""}</p><p className="text-xs text-muted-foreground">{p.role === "narrator" ? "Narrateur · observe la carte" : `${p.race} · ${zoneLabel(p.current_zone ?? "entree")}${(p.current_zone ?? "entree") === here ? " · ici" : ""}`}</p></div>
      </li>)}
    </ul>
    {canMove && <div className="flex items-center justify-between gap-3"><p role="status" className="min-w-0 text-sm text-muted-foreground">{!turn.isMine ? turn.message : message || (busy ? "Déplacement…" : "C’est à ton tour !")}</p><div className="grid shrink-0 grid-cols-3 grid-rows-3 gap-1">
      {([["up", "Monter", ChevronUp, "col-start-2"], ["left", "Gauche", ChevronLeft, "col-start-1 row-start-2"], ["right", "Droite", ChevronRight, "col-start-3 row-start-2"], ["down", "Descendre", ChevronDown, "col-start-2 row-start-3"]] as const).map(([dir, label, Icon, cls]) => <Button key={dir} variant="secondary" size="icon" aria-label={label} title={label} disabled={busy || !ready || !enabled} className={`h-11 w-11 ${cls}`} onClick={() => void step(dir)}><Icon /></Button>)}
    </div></div>}
  </section>;
}