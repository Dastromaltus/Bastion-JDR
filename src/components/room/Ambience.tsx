import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { trackLabel } from "@/lib/ambience-tracks";
import type { GameSettings } from "./useSettings";
import type { AmbienceEngine } from "./ambience-engine";

export type AmbienceRow = { track: string; state: string; volume: number; loop: boolean; sfx: string | null; sfx_at: string | null } | null;

/** Plays the salon's shared ambience locally, applying this user's personal volume. */
export function useAmbience(gameId: string | undefined, initial: AmbienceRow, settings: GameSettings) {
  const engine = useRef<AmbienceEngine | null>(null);
  const [row, setRow] = useState<AmbienceRow>(initial);
  const [unlocked, setUnlocked] = useState(false);
  const lastSfx = useRef<string | null>(initial?.sfx_at ?? null);

  useEffect(() => { if (initial) setRow(initial); }, [initial?.track, initial?.state, initial?.volume, initial?.loop, initial?.sfx_at]);

  // Direct realtime subscription for < 2 s propagation (RLS: members only).
  useEffect(() => {
    if (!gameId) return;
    const ch = supabase
      .channel(`ambience-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_ambience", filter: `game_id=eq.${gameId}` }, (p: any) => p.new && setRow(p.new))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gameId]);

  async function unlock() {
    if (!engine.current) {
      const { AmbienceEngine } = await import("./ambience-engine");
      engine.current = new AmbienceEngine();
    }
    await engine.current.unlock();
    setUnlocked(engine.current.unlocked);
  }

  useEffect(() => () => engine.current?.dispose(), []);

  // Levels
  useEffect(() => {
    const e = engine.current;
    if (!e || !unlocked) return;
    const general = settings.volume / 100;
    const music = settings.muteMusic ? 0 : (settings.music / 100) * ((row?.volume ?? 70) / 100) * general;
    e.setLevels(music, (settings.effects / 100) * general);
  }, [unlocked, settings.volume, settings.music, settings.effects, settings.muteMusic, row?.volume]);

  // Track / state
  useEffect(() => {
    const e = engine.current;
    if (!e || !unlocked || !row) return;
    if (row.state === "lecture") e.play(row.track, row.loop);
    else e.stop();
  }, [unlocked, row?.track, row?.state, row?.loop]);

  // One-shot effects
  useEffect(() => {
    if (!row?.sfx_at || row.sfx_at === lastSfx.current) return;
    lastSfx.current = row.sfx_at;
    if (engine.current && unlocked && row.sfx) engine.current.sfx(row.sfx);
  }, [row?.sfx_at, unlocked]);

  return { row, unlocked, unlock };
}

export function SoundGate({ unlocked, onUnlock }: { unlocked: boolean; onUnlock: () => void }) {
  if (unlocked) return null;
  return (
    <div role="region" aria-label="Son" className="flex flex-wrap items-center justify-between gap-3 border-2 border-primary bg-secondary p-3">
      <p className="text-sm font-bold">Ton navigateur bloque le son tant que tu n'as pas appuyé.</p>
      <Button onClick={onUnlock} className="min-h-11 rounded-none font-black uppercase"><Volume2 /> Activer le son</Button>
    </div>
  );
}

/** Personal controls for everyone: own volume + mute, stored in user settings. */
export function PersonalAmbience({ row, settings, update }: { row: AmbienceRow; settings: GameSettings; update: (p: Partial<GameSettings>) => void }) {
  const playing = row?.state === "lecture" && row.track !== "silence";
  return (
    <section className="flex flex-wrap items-center gap-3 border-2 border-foreground p-3">
      <p className="min-w-40 flex-1 text-sm"><span className="section-label">Ambiance</span><br />{playing ? `♪ ${trackLabel(row!.track)}` : row?.state === "pause" ? "En pause" : "Silence"}</p>
      <label className="flex min-w-48 flex-1 items-center gap-3 text-xs font-bold uppercase">Mon volume
        <Slider aria-label="Mon volume de musique" className="py-3" min={0} max={100} step={5} value={[settings.music]} onValueCommit={(v) => update({ music: v[0] ?? 0 })} onValueChange={() => {}} />
      </label>
      <Button variant={settings.muteMusic ? "default" : "outline"} className="min-h-11 rounded-none font-bold uppercase" aria-pressed={settings.muteMusic} onClick={() => update({ muteMusic: !settings.muteMusic })}>
        {settings.muteMusic ? <><VolumeX /> Musique coupée</> : <><Volume2 /> Couper la musique</>}
      </Button>
    </section>
  );
}
