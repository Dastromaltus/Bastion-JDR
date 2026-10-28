import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Backpack, BookOpen, MessageSquare, Settings, User, Dices, Copy, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  getRoom, narratorAction, leaveRoom, updateCharacter, rollCheck, inventoryAction, narratorAddItem, sendSignal,
} from "@/lib/rooms.functions";
import { RACE_NAMES, SCENARIOS, ROLE_LABEL, STATUS_LABEL, scenarioLabel } from "@/lib/races";
import { ReportButton } from "@/components/ReportButton";
import { useSettings, vibrate, type GameSettings } from "@/components/room/useSettings";
import { useAmbience, SoundGate, PersonalAmbience } from "@/components/room/Ambience";
import { AmbiencePanel, EnemyPanel, TreasurePanel, ExplorePanel } from "@/components/room/NarratorTools";
import { EncounterPanel } from "@/components/room/EncounterPanel";
import { ScenarioBuilder } from "@/components/room/ScenarioBuilder";
import { RoomPassword } from "@/components/room/RoomPassword";
import { OperationSection } from "@/components/operations/OperationPanel";
import { getSalonDungeon } from "@/lib/operations.functions";
import { SalonWorld } from "@/components/room/SalonWorld";
import { MobControl } from "@/components/room/MobControl";
import { TurnBanner } from "@/components/room/TurnBanner";
import { salonTurn } from "@/lib/turn-order";
import { AnimatedCount, DiceResult, HealthFill, RollingDice } from "@/components/room/MotionBits";
import { motionFeedback } from "@/lib/motion";
import { useMotionItems } from "@/hooks/use-motion-items";

export const Route = createFileRoute("/_authenticated/salon/$code")({
  staticData: { sitemap: false },
  head: ({ params }) => ({
    meta: [
      { title: `Salon ${params.code} — Bastion` },
      { name: "description", content: "Table de jeu privée Bastion : aventuriers et narrateur." },
      { property: "og:title", content: `Salon ${params.code} — Bastion` },
      { property: "og:description", content: "Table de jeu privée Bastion : aventuriers et narrateur." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

type Panel = "inventaire" | "fiche" | "journal" | "chat" | "parametres" | null;
const REACTIONS = ["Attention", "Besoin d'aide", "OK", "Attendre"] as const;
const CAT_LABEL = { arme: "Armes", consommable: "Consommables", cle: "Clés et quêtes" } as const;
const RARITY_LABEL: Record<string, string> = { commun: "Commun", rare: "Rare", epique: "Épique", legendaire: "Légendaire" };

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Action impossible, réessaie.";
}

/** Wraps a server call with loading + readable error toast. */
function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    try {
      await fn();
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      toast.error(errMsg(e));
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const fetchRoom = useServerFn(getRoom);
  const room = useQuery({ queryKey: ["room", code], queryFn: () => fetchRoom({ data: { code } }), refetchInterval: 2500 });
  const [userId, setUserId] = useState<string>();
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id)); }, []);
  const { settings, update, saving, error: settingsError } = useSettings(userId);
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [wheel, setWheel] = useState(false);
  const [dmTo, setDmTo] = useState<string | null>(null);
  const { busy, run } = useAction();

  const sNarr = useServerFn(narratorAction);
  const sLeave = useServerFn(leaveRoom);
  const sSignal = useServerFn(sendSignal);

  const gameId = room.data?.game.id as string | undefined;
  const fetchDg = useServerFn(getSalonDungeon);
  const dungeonQ = useQuery({ queryKey: ["dungeon", gameId], queryFn: () => { if (!gameId) throw new Error("Salon indisponible."); return fetchDg({ data: { gameId } }); }, enabled: !!gameId });
  const amb = useAmbience(gameId, (room.data as any)?.ambience ?? null, settings);
  const [loot, setLoot] = useState<string | null>(null);

  // Realtime: refresh on any change scoped to this salon (RLS filters what we receive).
  useEffect(() => {
    if (!gameId) return;
    const refetch = () => room.refetch();
    const ch = supabase.channel(`salon-${gameId}`);
    for (const table of ["game_events", "game_messages", "game_players", "game_inventory", "game_enemies", "game_treasures"]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `game_id=eq.${gameId}` }, (payload: any) => {
        refetch();
        if (table === "game_events" && payload.new?.kind === "ping" && payload.new?.payload?.target === userId) {
          toast(payload.new.message);
          vibrate(settings, 120);
        }
        const ev = table === "game_events" ? payload.new : null;
        if (ev?.kind === "menace") { toast(ev.message, { duration: 3000 }); vibrate(settings, 200); motionFeedback("alarm"); }
        if (ev?.kind === "declencheur") { toast.warning(ev.message); motionFeedback("alarm"); }
        if (ev?.kind === "tresor" && ev.actor_id === userId) { setLoot(ev.payload?.treasure ?? "Trésor"); setTimeout(() => setLoot(null), 2600); }
      });
    }
    ch.on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, refetch);
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, userId]);

  if (room.isLoading) return <Shell><p className="anim-loading p-6">Chargement du salon…</p></Shell>;
  if (room.error) return <Shell><p role="alert" className="p-6 font-bold text-primary">Impossible de charger le salon. <button className="underline" onClick={() => room.refetch()}>Réessayer</button></p></Shell>;
  const d = room.data;
  if (!d || !d.me) {
    return (
      <Shell>
        <div className="p-6">
          <p className="font-bold text-primary">Tu n'es pas (ou plus) membre de ce salon.</p>
          <Button asChild className="mt-4 min-h-11 rounded-none"><Link to="/rejoindre/$code" params={{ code }}>Demander à rejoindre</Link></Button>
        </div>
      </Shell>
    );
  }

  const { game, players, me } = d;
  const isNarr = me.role === "narrator";
  const turn = d.combat ? { ...salonTurn(game, players, me.user_id), isMine: !!d.combat.isMine } : salonTurn(game, players, me.user_id);
  // Preview/editor origins require Lovable workspace access; invitations always target the public site.
  const inviteOrigin = typeof window === "undefined" ? "" : /(^|\.)lovable(project)?\.(app|dev)$/.test(window.location.hostname) && /preview|lovableproject|-dev\./.test(window.location.hostname) ? "https://bastion-roleplay.lovable.app" : window.location.origin;
  const inviteUrl = inviteOrigin ? `${inviteOrigin}/rejoindre/${game.code}` : "";
  const textClass = settings.textSize === "grand" ? "text-[17px]" : settings.textSize === "tres-grand" ? "text-[19px]" : "text-base";
  const narr = (action: any, extra: Record<string, unknown> = {}, ok?: string) =>
    run(action + String(extra["targetUserId"] ?? ""), () => sNarr({ data: { gameId: game.id, action, ...extra } as any }), ok);

  return (
    <div
      className={`min-h-screen bg-background pb-28 ${textClass} ${settings.highContrast ? "room-contrast" : ""} ${settings.colorblind ? "room-colorblind" : ""} ${settings.reducedMotion ? "room-reduced-motion" : ""}`}
    >
      <header className="flex items-center justify-between gap-3 border-b-2 border-foreground px-4 py-3">
        <Link to="/salons" className="font-display text-base uppercase">Bastion<span className="text-primary">.</span></Link>
        <div className="text-right">
          <p className="font-display text-sm uppercase leading-none">{game.name}</p>
          <p className="text-[11px] uppercase text-muted-foreground">{STATUS_LABEL[game.status]} · {scenarioLabel(game.scenario)} · <span className="font-pixel">{game.code}</span></p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <TurnBanner d={d} onChange={() => room.refetch()} />
        {game.status === "playing" && <SoundGate unlocked={amb.unlocked} onUnlock={() => amb.unlock().catch(() => toast.error("Impossible d'activer le son sur ce navigateur."))} />}
        {game.status !== "waiting" && <PersonalAmbience row={amb.row} settings={settings} update={update} />}
        {game.status === "finished" && (
          <section className="border-4 border-primary p-5 text-center">
            <p className="section-label">Fin de partie</p>
            <h1 className="mt-2 font-display text-3xl uppercase">{(game.result === "victoire" ? "Victoire" : "Défaite").split("").map((letter, i) => <span key={i} className="anim-enter inline-block" style={{ "--anim-delay": `${i * 40}ms` } as React.CSSProperties}>{letter}</span>)}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Le journal complet est disponible au format PDF.</p>
            <ReportButton gameId={game.id} className="mt-4" />
          </section>
        )}

        {game.created_by === me.user_id && <RoomPassword gameId={game.id} />}
        {game.status === "waiting" && (
          <section className="border-2 border-foreground p-4">
            <p className="section-label">Salle d'attente — <AnimatedCount value={players.filter((p: any) => p.role === "adventurer").length} />/{game.max_players} joueurs</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-11 rounded-none" onClick={() => { navigator.clipboard.writeText(inviteUrl).then(() => toast.success("Lien d'invitation copié"), () => toast.error("Copie impossible")); }}>
                <Copy /> Copier le lien d'invitation
              </Button>
              <span className="flex min-h-11 items-center border border-foreground px-3 font-pixel text-xl tracking-[0.3em]">{game.code}</span>
            </div>
          </section>
        )}

        <section>
          <p className="section-label">Aventuriers</p>
          <p className="text-sm text-muted-foreground">Narrateur : {players.find((p: any) => p.role === "narrator")?.display_name ?? "aucun"}{isNarr ? " · toi" : ""}</p>
          <ul data-motion-players="true" className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
            {players.filter((p: any) => p.role === "adventurer").map((p: any) => (
              <li key={p.id} className={game.status === "playing" && p.id === turn.active?.id ? "anim-active" : undefined}>
                <button
                  onClick={() => p.user_id !== me.user_id && setSelectedPlayer(p)}
                  className={`w-full min-h-11 border-2 p-3 text-left transition-colors ${p.role === "narrator" ? "border-primary" : "border-foreground/50"} ${p.user_id === me.user_id ? "bg-secondary" : "hover:border-primary"}`}
                >
                  <p className="truncate font-bold">{p.display_name}{p.user_id === me.user_id ? " (toi)" : ""}</p>
                  <p className="text-[11px] uppercase text-muted-foreground">{ROLE_LABEL[p.role]} · {p.race}</p>
                  {p.role !== "narrator" && (
                    <div className="mt-2 h-2 w-full bg-muted" aria-label={`PV ${p.hp}/${p.max_hp}`}>
                      <HealthFill hp={p.hp} maxHp={p.max_hp} className="hp-bar bg-primary" />
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <MobControl d={d} onChange={() => room.refetch()} />
        <OperationSection d={d} onChange={() => room.refetch()} />
        {game.status === "playing" && !dungeonQ.isPending && !dungeonQ.data && <SalonWorld d={d} onChange={() => room.refetch()} />}
        {game.status === "playing" && !isNarr && !dungeonQ.data && !game.solo && <ExplorePanel d={d} />}

        {isNarr && (
          <NarratorPanel d={d} narr={narr} busy={busy} refetch={() => room.refetch()} />
        )}

        <section>
          <p className="section-label">Derniers événements</p>
          <ol className="mt-3 space-y-1 border-l-2 border-primary pl-3 text-sm">
            {d.events.slice(-6).map((e: any) => <li key={e.id}><span className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span> {e.message}</li>)}
          </ol>
        </section>
      </main>

      {loot && (
        <div role="status" className="loot-pop pointer-events-none fixed inset-x-0 top-1/3 z-50 mx-auto w-fit border-4 border-primary bg-background px-8 py-6 text-center shadow-game">
          <p className="section-label">Trésor découvert</p>
          <p className="mt-1 font-display text-xl uppercase">✦ {loot}</p>
          <p className="text-xs text-muted-foreground">Ajouté à ton inventaire</p>
        </div>
      )}

      {/* Reaction wheel */}
      <div className={`fixed bottom-24 z-40 ${settings.leftHanded ? "left-4" : "right-4"}`}>
        {wheel && (
          <div className="mb-2 grid grid-cols-2 gap-2 border-2 border-foreground bg-background p-2">
            {REACTIONS.map((r) => (
              <Button key={r} variant="outline" disabled={busy === "r" + r} className="min-h-11 rounded-none text-xs font-bold uppercase"
                onClick={async () => { vibrate(settings); if (await run("r" + r, () => sSignal({ data: { gameId: game.id, kind: "reaction", value: r } }))) setWheel(false); }}>
                {busy === "r" + r ? "…" : r}
              </Button>
            ))}
          </div>
        )}
        <Button aria-label="Réactions rapides" onClick={() => setWheel(!wheel)} className="h-14 w-14 rounded-full border-2 border-foreground"><Megaphone /></Button>
      </div>

      {/* Command bar */}
      <nav aria-label="Commandes" className={`fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-foreground bg-background ${settings.leftHanded ? "flex-row-reverse" : ""}`}>
        {([
          ["inventaire", "Inventaire", Backpack],
          ["fiche", "Fiche", User],
          ["journal", "Journal", BookOpen],
          ["chat", "Chat", MessageSquare],
          ["parametres", "Paramètres", Settings],
        ] as const).filter(([key]) => !isNarr || key !== "fiche").map(([key, label, Icon]) => (
          <button key={key} onClick={() => { vibrate(settings); setPanel(key); }}
            className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-black uppercase ${panel === key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
            <Icon size={22} /> {label}
          </button>
        ))}
      </nav>

      <Sheet open={panel !== null} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-none border-t-2 border-foreground">
          <SheetHeader><SheetTitle className="font-display text-xl uppercase">{panel === "parametres" ? "Paramètres" : panel ? panel.charAt(0).toUpperCase() + panel.slice(1) : ""}</SheetTitle></SheetHeader>
          <div className="px-4 pb-6">
            {panel === "inventaire" && <InventoryPanel d={d} settings={settings} />}
            {panel === "fiche" && !isNarr && <SheetPanel d={d} />}
            {panel === "journal" && <JournalPanel d={d} />}
            {panel === "chat" && <ChatPanel d={d} dmTo={dmTo} setDmTo={setDmTo} />}
            {panel === "parametres" && (
              <SettingsPanel settings={settings} update={update} saving={saving} error={settingsError} game={game} players={players} me={me}
                onLeave={() => run("leave", async () => { await sLeave({ data: { gameId: game.id } }); navigate({ to: "/salons" }); }, "Tu as quitté le salon")} busy={busy} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Player interactions */}
      <Sheet open={!!selectedPlayer} onOpenChange={(o) => !o && setSelectedPlayer(null)}>
        <SheetContent side="bottom" className="rounded-none border-t-2 border-foreground">
          <SheetHeader><SheetTitle className="font-display text-lg uppercase">{selectedPlayer?.display_name}</SheetTitle></SheetHeader>
          <div className="grid gap-2 px-4 pb-6">
            <Button variant="outline" className="min-h-11 rounded-none font-bold uppercase" onClick={() => { setSelectedPlayer(null); setPanel("inventaire"); toast("Choisis un objet puis « Donner »."); }}>Donner un objet</Button>
            <Button variant="outline" disabled={busy === "ping"} className="min-h-11 rounded-none font-bold uppercase"
              onClick={() => run("ping", () => sSignal({ data: { gameId: game.id, kind: "ping", value: "Ping", targetUserId: selectedPlayer.user_id } }), "Ping envoyé").then((ok) => ok && setSelectedPlayer(null))}>
              {busy === "ping" ? "Envoi…" : "Ping"}
            </Button>
            <Button variant="outline" className="min-h-11 rounded-none font-bold uppercase" onClick={() => { setDmTo(selectedPlayer.user_id); setSelectedPlayer(null); setPanel("chat"); }}>Message</Button>
            {isNarr && (
              <>
                <Button variant="outline" disabled={!!busy} className="min-h-11 rounded-none font-bold uppercase" onClick={() => narr("transfer", { targetUserId: selectedPlayer.user_id }, "Rôle de narrateur transmis").then(() => setSelectedPlayer(null))}>Transférer le rôle de narrateur</Button>
                <Button variant="destructive" disabled={!!busy} className="min-h-11 rounded-none font-bold uppercase" onClick={() => narr("kick", { targetUserId: selectedPlayer.user_id }, "Joueur expulsé").then(() => setSelectedPlayer(null))}>Expulser</Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}

function DicePanel({ gameId, enabled }: { gameId: string; enabled: boolean }) {
  const roll = useServerFn(rollCheck);
  const [stat, setStat] = useState<"vitesse" | "force" | "endurance">("force");
  const [dice, setDice] = useState(2);
  const [difficulty, setDifficulty] = useState(8);
  const [last, setLast] = useState<any>(null);
  const { busy, run } = useAction();
  return (
    <section className="border-2 border-foreground p-4">
      <p className="section-label">Jet de dés</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <select className="h-11 border border-input bg-background px-2" value={stat} onChange={(e) => setStat(e.target.value as any)}>
          <option value="vitesse">Vitesse</option><option value="force">Force</option><option value="endurance">Endurance</option>
        </select>
        <select className="h-11 border border-input bg-background px-2" value={dice} onChange={(e) => setDice(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}d6</option>)}
        </select>
        <Input type="number" min={1} max={60} className="h-11 rounded-none" aria-label="Difficulté" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} />
      </div>
      <Button disabled={busy === "roll" || !enabled} className="mt-3 min-h-11 w-full rounded-none font-black uppercase"
        onClick={() => { setLast(null); void run("roll", async () => setLast(await roll({ data: { gameId, stat, dice, difficulty } }))); }}>
        <RollingDice rolling={busy === "roll"} /> {busy === "roll" ? "Lancer…" : "Lancer"}
      </Button>
      {last && <DiceResult result={last} />}
    </section>
  );
}

function NarratorPanel({ d, narr, busy, refetch }: { d: any; narr: any; busy: string | null; refetch: () => void }) {
  const { game } = d;
  const [note, setNote] = useState("");
  const { busy: b2, run } = useAction();
  return (
    <section className="space-y-4 border-2 border-primary p-4">
      <p className="section-label">Commandes du narrateur</p>
      {game.status === "waiting" && <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-bold">Scénario<select aria-label="Scénario du salon" className="mt-1 h-11 w-full border border-input bg-background px-2" value={game.scenario} disabled={!!busy} onChange={(e) => narr("scenario", { scenario: e.target.value }, "Scénario enregistré")}><option value="a-definir" disabled>À définir</option>{SCENARIOS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label><Button asChild variant="outline" className="min-h-11"><Link to="/campagnes">Concevoir une campagne</Link></Button></div>}

      <div className="flex flex-wrap gap-2">
        {game.status === "waiting" && (
          <>
            <Button variant="outline" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => narr(game.locked ? "unlock" : "lock", {}, game.locked ? "Salon déverrouillé" : "Salon verrouillé")}>{game.locked ? "Déverrouiller" : "Verrouiller"} le salon</Button>
            <Button disabled={!!busy} className="min-h-11 rounded-none font-black uppercase" onClick={() => narr("start", {}, "Partie lancée")}>{busy === "start" ? "Lancement…" : "Lancer la partie"}</Button>
          </>
        )}
        {game.status === "playing" && (
          <>
            <Button disabled={!!busy} className="min-h-11 rounded-none" onClick={() => narr("finish", { result: "victoire" }, "Partie terminée")}>Terminer : victoire</Button>
            <Button variant="destructive" disabled={!!busy} className="min-h-11 rounded-none" onClick={() => narr("finish", { result: "defaite" }, "Partie terminée")}>Terminer : défaite</Button>
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase">Notes privées (visibles par toi seul)</p>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; run("note", async () => { const { error } = await supabase.from("narrator_notes").insert({ game_id: game.id, author_id: d.me.user_id, body: note.trim() }); if (error) throw new Error("Note non enregistrée."); setNote(""); refetch(); }); }}>
            <Input className="h-11 rounded-none" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Le trésor est piégé…" />
            <Button disabled={b2 === "note"} className="min-h-11 rounded-none">{b2 === "note" ? "…" : "Ajouter"}</Button>
          </form>
          <ul className="mt-2 space-y-1 text-sm">{d.notes.map((n: any) => <li key={n.id} className="border-l-2 border-primary pl-2">{n.body}</li>)}</ul>
        </div>
      </div>

      <NarratorTabs d={d} />
    </section>
  );
}

function NarratorTabs({ d }: { d: any }) {
  const [tab, setTab] = useState<"parcours" | "ambiance" | "ennemis" | "tresors" | "rencontre">(d.game.status === "waiting" ? "parcours" : "ambiance");
  const mobZone = undefined;
  const canAct = d.me.role === "narrator" || d.game.status !== "playing" || (d.combat ? d.combat.isMine : salonTurn(d.game, d.players, d.me.user_id).isMine);
  const tabs = [["parcours", "Parcours"], ["ambiance", "Ambiance"], ["ennemis", "Ennemis"], ["tresors", "Trésors"], ["rencontre", "Rencontre IA"]] as const;
  return (
    <div className="border-t border-foreground/30 pt-4">
      <div role="tablist" aria-label="Outils du narrateur" className="grid grid-cols-3 border-2 border-foreground sm:grid-cols-5">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-11 text-xs font-black uppercase ${tab === k ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>{l}</button>
        ))}
      </div>
      <div key={tab} role="tabpanel" className="mt-4">
        {tab === "parcours" && <ScenarioBuilder d={d} />}
        {tab === "ambiance" && <AmbiencePanel gameId={d.game.id} row={d.ambience} />}
        {tab === "rencontre" && <EncounterPanel d={d} />}
        {tab === "ennemis" && <fieldset disabled={!canAct} className="min-w-0"><EnemyPanel key={mobZone} d={d} initialZone={mobZone} /></fieldset>}
        {tab === "tresors" && <fieldset disabled={!canAct} className="min-w-0"><TreasurePanel d={d} /></fieldset>}
      </div>
    </div>
  );
}

function useLongPress(onLong: () => void, onTap: () => void) {
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fired = useRef(false);
  return {
    onPointerDown: () => { fired.current = false; t.current = setTimeout(() => { fired.current = true; onLong(); }, 500); },
    onPointerUp: () => { clearTimeout(t.current); if (!fired.current) onTap(); },
    onPointerLeave: () => clearTimeout(t.current),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

function ItemCell({ item, onTap, onLong, leaving = false }: { item: any; onTap: () => void; onLong: () => void; leaving?: boolean }) {
  const lp = useLongPress(onLong, onTap);
  return (
    <button {...lp} disabled={leaving} onKeyDown={(e) => e.key === "Enter" && onTap()} className={`${leaving ? "anim-exit" : ""} relative flex aspect-square min-h-16 select-none flex-col items-center justify-center border-2 p-1 text-center text-xs font-bold ${item.equipped ? "border-primary bg-secondary" : "border-foreground/50"}`}>
      <span className="line-clamp-2">{item.name}</span>
      {item.quantity > 1 && <span className="absolute bottom-1 right-1 font-pixel">×{item.quantity}</span>}
      {item.equipped && <span className="absolute left-1 top-1 text-[9px] text-primary">ÉQUIPÉ</span>}
    </button>
  );
}

function InventoryPanel({ d, settings }: { d: any; settings: GameSettings }) {
  const act = useServerFn(inventoryAction);
  const canAct = d.me.role === "narrator" || d.game.status !== "playing" || (d.combat ? d.combat.isMine : salonTurn(d.game, d.players, d.me.user_id).isMine);
  const add = useServerFn(narratorAddItem);
  const isNarr = d.me.role === "narrator";
  const [tab, setTab] = useState<keyof typeof CAT_LABEL>("arme");
  const [owner, setOwner] = useState<string>(d.me.role === "narrator" ? d.players.find((p: any) => p.role === "adventurer")?.user_id ?? "" : d.me.user_id);
  const [menu, setMenu] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [confirm, setConfirm] = useState<{ item: any; action: "give" | "discard"; target?: any } | null>(null);
  const [giveFor, setGiveFor] = useState<any>(null);
  const [newItem, setNewItem] = useState({ name: "", effect: "", rarity: "commun" });
  const { busy, run } = useAction();
  const others = d.players.filter((p: any) => p.user_id !== d.me.user_id);
  const viewOwner = isNarr ? owner : d.me.user_id;
  const items = d.inventory.filter((i: any) => i.owner_id === viewOwner && i.category === tab);
  const shownItems = useMotionItems<any>(items);
  const call = (item: any, action: any, targetUserId?: string, ok?: string) =>
    run(action, () => act({ data: { gameId: d.game.id, itemId: item.id, action, targetUserId } }), ok).then((r) => { if (r) { setMenu(null); setConfirm(null); } });

  return (
    <div>
      {isNarr && (
        <select className="mb-3 h-11 w-full border border-input bg-background px-2" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Inventaire de">
          {d.players.filter((p: any) => p.role === "adventurer").map((p: any) => <option key={p.user_id} value={p.user_id}>Inventaire de {p.display_name}</option>)}
        </select>
      )}
      <div role="tablist" className="grid grid-cols-3 border-2 border-foreground">
        {(Object.keys(CAT_LABEL) as (keyof typeof CAT_LABEL)[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-11 text-xs font-black uppercase ${tab === k ? "bg-foreground text-background" : ""}`}>{CAT_LABEL[k]}</button>
        ))}
      </div>
      <div className="anim-list mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {shownItems.map(({ item: i, leaving }) => <ItemCell key={i.id} item={i} leaving={leaving} onTap={() => { vibrate(settings); setMenu(i); }} onLong={() => { vibrate(settings, 60); setDetails(i); }} />)}
        {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, i) => <div key={i} className="aspect-square border border-dashed border-foreground/20" />)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Appui : actions · appui long : détails.</p>

      {isNarr && (
        <form className="mt-4 grid gap-2 border-t border-foreground/30 pt-3" onSubmit={(e) => { e.preventDefault(); run("add", async () => { await add({ data: { gameId: d.game.id, ownerId: owner, name: newItem.name, category: tab, effect: newItem.effect, rarity: newItem.rarity as any } }); setNewItem({ name: "", effect: "", rarity: "commun" }); }, "Objet ajouté"); }}>
          <p className="text-xs font-black uppercase">Ajouter dans « {CAT_LABEL[tab]} »</p>
          <Input required maxLength={40} className="h-11 rounded-none" placeholder="Nom" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
          <Input maxLength={200} className="h-11 rounded-none" placeholder="Effet (ex : rend 5 PV)" value={newItem.effect} onChange={(e) => setNewItem({ ...newItem, effect: e.target.value })} />
          <select className="h-11 border border-input bg-background px-2" value={newItem.rarity} onChange={(e) => setNewItem({ ...newItem, rarity: e.target.value })}>
            {Object.entries(RARITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Button disabled={busy === "add" || !canAct} className="min-h-11 rounded-none font-bold uppercase">{busy === "add" ? "Ajout…" : "Ajouter l'objet"}</Button>
        </form>
      )}

      <Sheet open={!!menu} onOpenChange={(o) => !o && (setMenu(null), setGiveFor(null))}>
        <SheetContent side="bottom" className="rounded-none border-t-2 border-foreground">
          <SheetHeader><SheetTitle className="font-display text-lg uppercase">{menu?.name}</SheetTitle></SheetHeader>
          {menu && !giveFor && (
            <fieldset disabled={!canAct} className="grid min-w-0 gap-2 px-4 pb-6">
              <Button variant="outline" disabled={menu.category !== "consommable" || !!busy} className="min-h-11 rounded-none font-bold uppercase" onClick={() => call(menu, "use", undefined, "Objet utilisé")}>{busy === "use" ? "…" : "Utiliser"}</Button>
              <Button variant="outline" disabled={menu.category !== "arme" || !!busy} className="min-h-11 rounded-none font-bold uppercase" onClick={() => call(menu, "equip", undefined, menu.equipped ? "Arme rangée" : "Arme équipée")}>{busy === "equip" ? "…" : menu.equipped ? "Déséquiper" : "Équiper"}</Button>
              <Button variant="outline" disabled={!others.length} className="min-h-11 rounded-none font-bold uppercase" onClick={() => setGiveFor(menu)}>Donner à un joueur</Button>
              <Button variant="destructive" className="min-h-11 rounded-none font-bold uppercase" onClick={() => setConfirm({ item: menu, action: "discard" })}>Jeter</Button>
            </fieldset>
          )}
          {giveFor && (
            <div className="grid gap-2 px-4 pb-6">
              <p className="text-sm">Donner {giveFor.name} à :</p>
              {d.players.filter((p: any) => p.role === "adventurer" && p.user_id !== giveFor.owner_id).map((p: any) => (
                <Button key={p.user_id} variant="outline" className="min-h-11 rounded-none" onClick={() => setConfirm({ item: giveFor, action: "give", target: p })}>{p.display_name}</Button>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.action === "discard" ? "Jeter cet objet ?" : "Donner cet objet ?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "discard" ? `${confirm?.item.name} sera définitivement perdu.` : `${confirm?.item.name} ira dans l'inventaire de ${confirm?.target?.display_name}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 rounded-none">Annuler</AlertDialogCancel>
            <AlertDialogAction className="min-h-11 rounded-none" disabled={!!busy}
              onClick={(e) => { e.preventDefault(); if (!confirm) return; call(confirm.item, confirm.action, confirm.target?.user_id, confirm.action === "give" ? "Objet donné" : "Objet jeté").then(() => setGiveFor(null)); }}>
              {busy ? "…" : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>{details?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Rareté : {RARITY_LABEL[details?.rarity]} · {CAT_LABEL[details?.category as keyof typeof CAT_LABEL]}<br />
              Effet : {details?.effect || "aucun effet particulier"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="min-h-11 rounded-none">Fermer</AlertDialogCancel></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SheetPanel({ d }: { d: any }) {
  const upd = useServerFn(updateCharacter);
  const me = d.me;
  const [race, setRace] = useState(me.race);
  const [name, setName] = useState(me.display_name);
  const { busy, run } = useAction();
  const editable = d.game.status === "waiting";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        {[["Vitesse", me.speed], ["Force", me.strength], ["Endurance", me.endurance], ["PV", `${me.hp}/${me.max_hp}`]].map(([k, v]) => (
          <div key={k} className="border-2 border-foreground p-2"><p className="text-[6.0px] font-black uppercase">{k}</p><p className="font-display text-lg">{v}</p></div>
        ))}
      </div>
      <p className="text-sm">Rôle dans ce salon : <b>{ROLE_LABEL[me.role]}</b></p>
      {editable ? (
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run("fiche", () => upd({ data: { gameId: d.game.id, race, displayName: name } }), "Fiche mise à jour"); }}>
          <Input required maxLength={40} className="h-11 rounded-none" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="h-11 border border-input bg-background px-2" value={race} onChange={(e) => setRace(e.target.value)}>
            {RACE_NAMES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <Button disabled={busy === "fiche"} className="min-h-11 rounded-none font-bold uppercase">{busy === "fiche" ? "Enregistrement…" : "Enregistrer la fiche"}</Button>
        </form>
      ) : <p className="text-sm text-muted-foreground">La fiche est figée depuis le lancement de la partie.</p>}
    </div>
  );
}

function JournalPanel({ d }: { d: any }) {
  return (
    <div>
      <ReportButton gameId={d.game.id} className="mb-3 w-full" />
      <ol className="space-y-1 text-sm">
        {d.events.map((e: any) => (
          <li key={e.id} className={`border-l-2 pl-2 ${e.important ? "border-primary font-bold" : "border-foreground/30"}`}>
            <span className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span> {e.message}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ChatPanel({ d, dmTo, setDmTo }: { d: any; dmTo: string | null; setDmTo: (v: string | null) => void }) {
  const [body, setBody] = useState("");
  const { busy, run } = useAction();
  const nameOf = (id: string) => d.players.find((p: any) => p.user_id === id)?.display_name ?? "?";
  return (
    <div>
      <ol className="max-h-[40vh] space-y-1 overflow-y-auto text-sm">
        {d.messages.map((m: any) => (
          <li key={m.id}><b className={m.user_id === d.me.user_id ? "text-primary" : ""}>{m.author_name}</b>{m.recipient_id ? <span className="text-muted-foreground"> → {nameOf(m.recipient_id)} (privé)</span> : null} : {m.body}</li>
        ))}
        {!d.messages.length && <li className="text-muted-foreground">Aucun message.</li>}
      </ol>
      <form className="mt-3 grid gap-2" onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        run("msg", async () => {
          const { error } = await supabase.from("game_messages").insert({ game_id: d.game.id, user_id: d.me.user_id, author_name: d.me.display_name, recipient_id: dmTo, body: body.trim() });
          if (error) throw new Error("Message non envoyé.");
          setBody("");
        });
      }}>
        <select className="h-11 border border-input bg-background px-2" value={dmTo ?? ""} onChange={(e) => setDmTo(e.target.value || null)}>
          <option value="">À toute la table</option>
          {d.players.filter((p: any) => p.user_id !== d.me.user_id).map((p: any) => <option key={p.user_id} value={p.user_id}>Privé : {p.display_name}</option>)}
        </select>
        <div className="flex gap-2">
          <Input maxLength={500} className="h-11 rounded-none" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message…" />
          <Button disabled={busy === "msg"} className="min-h-11 rounded-none">{busy === "msg" ? "…" : "Envoyer"}</Button>
        </div>
      </form>
    </div>
  );
}

function SettingsPanel({ settings, update, saving, error, game, players, me, onLeave, busy }: any) {
  const [reportFor, setReportFor] = useState("");
  const [reason, setReason] = useState("");
  const { busy: b2, run } = useAction();
  const sl = (label: string, key: keyof GameSettings) => (
    <label className="block text-sm font-bold">{label} : {settings[key]}%
      <Slider className="mt-3 py-2" min={0} max={100} step={5} value={[settings[key] as number]} onValueCommit={(v) => update({ [key]: v[0] })} onValueChange={() => {}} />
    </label>
  );
  const sw = (label: string, key: keyof GameSettings) => (
    <label className="flex min-h-11 items-center justify-between text-sm font-bold">{label}<Switch checked={settings[key] as boolean} onCheckedChange={(v) => update({ [key]: v })} /></label>
  );
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground" aria-live="polite">{saving ? "Enregistrement…" : error ? <span className="font-bold text-primary">{error}</span> : "Préférences enregistrées sur ton compte."}</p>
      <fieldset className="space-y-4"><legend className="section-label">Audio</legend>{sl("Volume général", "volume")}{sl("Musique", "music")}{sl("Effets", "effects")}{sw("Couper la musique", "muteMusic")}
        <Link to="/credits" className="inline-flex min-h-11 items-center text-sm font-bold underline">Crédits audio</Link></fieldset>
      <fieldset className="space-y-2"><legend className="section-label">Affichage</legend>
        <label className="block text-sm font-bold">Taille du texte
          <select className="mt-1 h-11 w-full border border-input bg-background px-2" value={settings.textSize} onChange={(e) => update({ textSize: e.target.value })}>
            <option value="normal">Normale</option><option value="grand">Grande</option><option value="tres-grand">Très grande</option>
          </select>
        </label>
        {sw("Contraste renforcé", "highContrast")}{sw("Mode daltonien", "colorblind")}{sw("Réduire les animations", "reducedMotion")}
      </fieldset>
      <fieldset className="space-y-2"><legend className="section-label">Contrôles</legend>
        <div className="grid grid-cols-2 border-2 border-foreground">
          {[["Droitier", false], ["Gaucher", true]].map(([l, v]) => (
            <button key={l as string} onClick={() => update({ leftHanded: v })} className={`min-h-11 text-xs font-black uppercase ${settings.leftHanded === v ? "bg-foreground text-background" : ""}`}>{l}</button>
          ))}
        </div>
        {sw("Vibrations", "vibrations")}
      </fieldset>
      <fieldset className="space-y-3"><legend className="section-label">Partie</legend>
        <p className="text-sm">Code du salon : <span className="font-pixel text-xl tracking-[0.3em]">{game.code}</span></p>
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run("report", async () => { const { error } = await supabase.from("player_reports").insert({ game_id: game.id, reporter_id: me.user_id, reported_id: reportFor, reason }); if (error) throw new Error("Signalement non envoyé (motif de 3 caractères minimum)."); setReason(""); setReportFor(""); }, "Signalement envoyé"); }}>
          <select required className="h-11 border border-input bg-background px-2" value={reportFor} onChange={(e) => setReportFor(e.target.value)}>
            <option value="">Signaler un joueur…</option>
            {players.filter((p: any) => p.user_id !== me.user_id).map((p: any) => <option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}
          </select>
          <Input required minLength={3} maxLength={500} className="h-11 rounded-none" placeholder="Motif" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="outline" disabled={b2 === "report"} className="min-h-11 rounded-none font-bold uppercase">{b2 === "report" ? "Envoi…" : "Signaler"}</Button>
        </form>
        <Button variant="destructive" disabled={busy === "leave"} className="min-h-11 w-full rounded-none font-black uppercase" onClick={onLeave}>{busy === "leave" ? "Départ…" : "Quitter la partie"}</Button>
      </fieldset>
    </div>
  );
}
