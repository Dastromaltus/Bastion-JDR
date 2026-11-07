import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Megaphone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moveSalonMob, moveWorldPlayer } from "@/lib/world.functions";
import { getSalonMap } from "@/lib/maps.functions";
import { useQuery } from "@tanstack/react-query";
import { PREBUILT_MAPS, DEFAULT_MAP_KEY, cellWalkable } from "@/lib/map-grid";
import { type WorldDirection } from "@/lib/world-map";
import { isZombie, isSlime, monsterSprite, participantActors, type WorldActor } from "@/lib/world-actors";
import { zoneLabel } from "@/lib/races";
import { salonTurn } from "@/lib/turn-order";
import type Phaser from "phaser";
import { motionDisabled } from "@/lib/motion";
import { mobMovementAllowed, worldMovementAllowed } from "@/lib/world-movement";
import { WORLD_DELTAS } from "@/lib/world-map";
import { worldKeyDirection } from "@/lib/world-keys";
import { combatAction } from "@/lib/combat.functions";
import { worldAttackAllowed } from "@/lib/world-attack";

export function SalonWorld({ d, zone, name, onChange }: { d: any; zone?: string; name?: string; onChange: () => unknown | Promise<unknown> }) {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState(false);
  const stepRef = useRef<(direction: WorldDirection) => void>(() => {});
  const [movingDirection, setMovingDirection] = useState<WorldDirection | null>(null);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState<WorldDirection | null>(null);
  const view = useRef<HTMLDivElement>(null);
  const previousZone = useRef<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const move = useServerFn(moveWorldPlayer);
  const moveMob = useServerFn(moveSalonMob);
  const attack = useServerFn(combatAction);
  const attacking = useRef(false);
  useEffect(() => {
    const clickEnemy = async (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== "string") return;
      const enemy = d.enemies.find((e: any) => e.id === event.detail);
      if (!worldAttackAllowed({ status: d.game.status, role: d.me.role, hp: d.me.hp, enemyVisible: !!enemy, enemyAlive: !!enemy && enemy.status !== "vaincu" && enemy.hp > 0, busy: attacking.current })) return;
      attacking.current = true;
      setMessage(`Attaque sur ${enemy.name}…`);
      try {
        await queue.current;
        const result = await attack({ data: { gameId: d.game.id, action: "attack", enemyId: enemy.id, revision: d.combat?.revision ?? 0 } });
        setMessage(`${enemy.name} : ${result.damage ?? 0} dégâts`);
        await onChange();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Attaque impossible.");
      } finally { attacking.current = false; }
    };
    window.addEventListener("bastion-select-mob", clickEnemy);
    return () => window.removeEventListener("bastion-select-mob", clickEnemy);
  }, [d, attack, onChange]);
  const [optimistic, setOptimistic] = useState<{ id: string; x: number; y: number } | null>(null);
  const optimisticRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);
  const turn = salonTurn(d.game, d.players, d.me.user_id);
  const followed = turn.active?.role === "adventurer" ? d.players.find((p: any) => p.id === turn.active?.id) : d.players.find((p: any) => p.role === "adventurer");
  const here = zone ?? (d.me.role === "narrator" ? followed?.current_zone : d.me.current_zone) ?? "entree";
  const canMove = d.game.status === "playing" && d.me.role === "adventurer" && d.me.hp > 0 && here === (d.me.current_zone ?? "entree");
  const enabled = worldMovementAllowed({ status: d.game.status, role: d.me.role, hp: d.me.hp, sameZone: here === (d.me.current_zone ?? "entree"), explorationTurn: turn.isMine, combat: d.combat });
  const fetchMap = useServerFn(getSalonMap);
  const mapQ = useQuery({ queryKey: ["salon-map", d.game.id, (d.events ?? []).filter((e: any) => e.kind === "carte").length], queryFn: () => fetchMap({ data: { gameId: d.game.id } }), staleTime: 30_000, placeholderData: (prev) => prev });
  const grid = mapQ.data ?? PREBUILT_MAPS[DEFAULT_MAP_KEY];
  const narrator = d.me.role === "narrator";
  // The narrator moves the selected mob, or the enemy whose combat turn it is.
  const turnMobId = d.controlledEnemyId ?? (d.combat?.active && d.combat.current?.kind === "enemy" ? d.combat.current.id : null);
  const mobRow = narrator && turnMobId ? d.enemies.find((e: any) => e.id === turnMobId && e.status !== "vaincu") : undefined;
  const mobEnabled = mobMovementAllowed({ status: d.game.status, role: d.me.role, controlledId: mobRow?.id, combat: d.combat });
  const controlsReady = (enabled || mobEnabled) && ready && mapQ.isSuccess;
  const controlLabel = narrator ? !mobRow ? "Vue narrateur · contrôle un mob pour le déplacer" : !mobEnabled ? `${mobRow.name} · indisponible` : focused ? `▶ ${mobRow.name} · Z Q S D` : `${mobRow.name} · clique sur la carte puis Z Q S D` : !ready || !mapQ.isSuccess ? "Chargement de la carte…" : !enabled ? d.me.hp <= 0 ? "Ton aventurier est hors de combat" : "Déplacement indisponible" : focused ? "▶ Contrôles actifs · Z Q S D" : "Clique sur la carte pour jouer";
  const participants = participantActors(d.players, here, d.me.id, grid);
  const activeId = d.combat?.current?.id ?? turn.active?.id;
  const baseActors: WorldActor[] = participants.map((actor) => ({ ...actor, name: `${actor.id === activeId ? "▶ " : ""}${actor.name}`, hp: d.players.find((p: any) => p.id === actor.id)?.hp }));
   d.enemies.filter((e: any) => e.zone === here && (e.status !== "vaincu" || isZombie(e.name) || isSlime(e.name))).forEach((e: any, i: number) => baseActors.push({ id: e.id, name: e.status === "vaincu" ? "" : `${e.id === d.controlledEnemyId ? '▶ ' : ''}${e.status === 'cache' && d.me.role === 'narrator' ? '? ' : ''}${e.name}`, x: e.tile_x ?? 16 + i % 4, y: e.tile_y ?? 9, frame: 12, hp: e.hp, maxHp: e.max_hp, ...(monsterSprite(e.name) ? { sprite: monsterSprite(e.name) } : {}), ...(e.status === "vaincu" ? { dead: true } : {}) }));
  if (d.me.role === "narrator") (d.treasures ?? []).filter((t: any) => t.status === "cache" && t.tile_x != null && t.zone === here).forEach((t: any) => baseActors.push({ id: t.id, name: `✦ ${t.name}`, x: t.tile_x, y: t.tile_y, frame: 0, sprite: "treasure" }));
  const actors: WorldActor[] = optimistic ? baseActors.map((a) => a.id === optimistic.id ? { ...a, x: optimistic.x, y: optimistic.y } : a) : baseActors;
  const movingId: string | undefined = narrator ? mobRow?.id : d.me.id;
  const baseMover = baseActors.find((a) => a.id === movingId);
  // Drop the local prediction once the server state has caught up and nothing is pending.
  useEffect(() => {
    if (optimistic && inFlight.current === 0 && baseMover && baseMover.x === optimistic.x && baseMover.y === optimistic.y) { optimisticRef.current = null; setOptimistic(null); }
  }, [optimistic, baseMover?.x, baseMover?.y]);
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
    if (ready) game.current?.scene.getScene("SalonWorld").events.emit("map", grid);
  }, [ready, grid]);
  const controlledMob = mobRow ? actors.find((a) => a.id === mobRow.id) : d.controlledEnemyId ? actors.find((a) => a.id === d.controlledEnemyId) : undefined;
  const focusActor = controlledMob ?? actors.find((p) => p.id === (d.me.role === "adventurer" ? d.me.id : followed?.id)) ?? actors[0];
  useEffect(() => {
    if (ready) game.current?.scene.getScene("SalonWorld").events.emit("focus", focusActor ?? grid.spawn);
  }, [ready, focusActor?.id, focusActor?.x, focusActor?.y, grid]);
  useEffect(() => {
    if (previousZone.current && previousZone.current !== here && !motionDisabled()) view.current?.animate(
      [{ opacity: 0.35, transform: "translateX(8px)" }, { opacity: 1, transform: "translateX(0)" }],
      { duration: 200, easing: "linear" },
    );
    previousZone.current = here;
  }, [here]);
  function step(direction: WorldDirection) {
    if (!controlsReady || !movingId) { setMessage(controlLabel); return; }
    const from = optimisticRef.current?.id === movingId ? optimisticRef.current : baseMover;
    if (!from) return;
    const [dx, dy] = WORLD_DELTAS[direction];
    const target = { id: movingId, x: from.x + dx, y: from.y + dy };
    if (!cellWalkable(grid, target.x, target.y)) { setMessage("Le passage est bloqué."); return; }
    // Show the step immediately; the server validates each step right after, in order.
    optimisticRef.current = target; setOptimistic(target); setMessage(""); setMovingDirection(direction);
    inFlight.current += 1;
    const mobId = narrator ? movingId : null;
    queue.current = queue.current.then(async () => {
      try {
        if (mobId) await moveMob({ data: { gameId: d.game.id, enemyId: mobId, direction } });
        else await move({ data: { gameId: d.game.id, direction } });
      } catch (e) {
        inFlight.current = 0; optimisticRef.current = null; setOptimistic(null); setMovingDirection(null);
        setMessage(e instanceof Error ? e.message : "Déplacement impossible.");
        void onChange(); return;
      }
      inFlight.current = Math.max(0, inFlight.current - 1);
      if (inFlight.current === 0) { setMovingDirection(null); void onChange(); }
    });
  }
  stepRef.current = step;
  useEffect(() => {
    if (controlsReady && (document.activeElement === document.body || !document.activeElement)) view.current?.focus({ preventScroll: true });
  }, [controlsReady]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target;
      const editing = target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]');
      const direction = worldKeyDirection(event.key, event.repeat, editing);
      if (!direction) return;
      event.preventDefault(); setPressed(direction);
      view.current?.focus({ preventScroll: true });
      void stepRef.current(direction);
    };
    const up = () => setPressed(null);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  return <section className="space-y-3" aria-label="Exploration en vue de dessus">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-pixel text-xl">{name ?? zoneLabel(here)}</h2><span className="text-xs text-muted-foreground">{grid.name} · 160 × 160 · {participants.length} participant(s)</span></div>
    <div ref={view} tabIndex={0} role="group" aria-label="Carte du salon, vue de dessus. Clique puis utilise Z, Q, S, D." onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onMouseDown={() => view.current?.focus()} className={`salon-world relative overflow-hidden border-2 bg-game outline-none ${focused ? "border-primary ring-4 ring-primary" : "border-foreground"}`}>
      <div ref={mount} className="salon-world-canvas" />
      <p aria-live="polite" className={`pointer-events-none absolute left-2 top-2 max-w-[calc(100%-1rem)] border-2 px-2 py-1 font-pixel text-[10px] uppercase ${focused && controlsReady ? "border-primary bg-primary text-primary-foreground" : "border-foreground bg-background text-foreground"}`}>{controlLabel}</p>
      {controlsReady && <div className="absolute bottom-2 right-2 grid grid-cols-3 gap-1">
        {([["up", "Z", "col-start-2"], ["left", "Q", "col-start-1 row-start-2"], ["down", "S", "col-start-2 row-start-2"], ["right", "D", "col-start-3 row-start-2"]] as const).map(([dir, k, cls]) => <button type="button" key={dir} aria-label={`Déplacer : ${k}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { setPressed(dir); view.current?.focus({ preventScroll: true }); step(dir); window.setTimeout(() => setPressed(null), 150); }} className={`flex h-10 w-10 cursor-pointer items-center justify-center border-2 font-pixel text-xs ${cls} items-center justify-center border-2 font-pixel text-xs ${cls} ${pressed === dir ? "anim-pop border-foreground bg-primary text-primary-foreground translate-y-0.5" : "border-foreground bg-background text-foreground hover:bg-accent"}`}>{k}</button>)}
      </div>}
      {!ready && <p role={failure ? "alert" : "status"} className="absolute inset-0 flex items-center justify-center bg-game">{failure ? "La carte n'a pas pu être affichée." : "Chargement de la carte…"}</p>}
    </div>
    <ul aria-label="Participants du salon" className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
      {d.players.map((p: any) => <li key={p.id} className="flex min-w-0 items-start gap-2 text-sm">
        {p.role === "narrator" ? <Megaphone className="mt-0.5 size-4 shrink-0 text-primary" /> : <User className="mt-0.5 size-4 shrink-0 text-primary" />}
        <div className="min-w-0"><p className="break-words font-bold">{p.display_name}{p.id === d.me.id ? " · toi" : ""}</p><p className="text-xs text-muted-foreground">{p.role === "narrator" ? "Narrateur · observe la carte" : `${p.race} · ${zoneLabel(p.current_zone ?? "entree")}${(p.current_zone ?? "entree") === here ? " · ici" : ""}`}</p></div>
      </li>)}
    </ul>
    {narrator && message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    {canMove && <div className="flex items-center justify-between gap-3"><p key={`${turn.active?.id}-${message}`} role="status" className="anim-enter min-w-0 text-sm text-muted-foreground">{!enabled ? "Déplacement indisponible" : message || "Déplace-toi librement avec Z Q S D"}</p><div className="grid shrink-0 grid-cols-3 grid-rows-3 gap-1 lg:hidden">
      {([["up", "Monter", ChevronUp, "col-start-2"], ["left", "Gauche", ChevronLeft, "col-start-1 row-start-2"], ["right", "Droite", ChevronRight, "col-start-3 row-start-2"], ["down", "Descendre", ChevronDown, "col-start-2 row-start-3"]] as const).map(([dir, label, Icon, cls]) => <Button key={dir} variant={movingDirection === dir ? "default" : "secondary"} size="icon" aria-label={label} title={label} disabled={!ready || !enabled} className={`h-11 w-11 ${cls} ${movingDirection === dir ? "anim-pop" : ""}`} onClick={() => step(dir)}><Icon /></Button>)}
    </div></div>}
  </section>;
}