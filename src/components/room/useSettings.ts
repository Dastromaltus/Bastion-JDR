import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GameSettings = {
  volume: number;
  music: number;
  effects: number;
  textSize: "normal" | "grand" | "tres-grand";
  highContrast: boolean;
  colorblind: boolean;
  reducedMotion: boolean;
  leftHanded: boolean;
  vibrations: boolean;
  muteMusic: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  volume: 80, music: 60, effects: 80, textSize: "normal", highContrast: false, colorblind: false, reducedMotion: false, leftHanded: false, vibrations: true, muteMusic: false,
};

export function useSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from("user_settings").select("settings").eq("user_id", userId).maybeSingle().then(({ data }) => {
      if (data?.settings) setSettings({ ...DEFAULT_SETTINGS, ...(data.settings as Partial<GameSettings>) });
    });
  }, [userId]);

  const update = useCallback(
    async (patch: Partial<GameSettings>) => {
      if (!userId) return;
      const next = { ...settings, ...patch };
      setSettings(next);
      setSaving(true);
      setError(null);
      const { error } = await supabase.from("user_settings").upsert({ user_id: userId, settings: next as any, updated_at: new Date().toISOString() });
      setSaving(false);
      if (error) setError("Préférences non enregistrées. Vérifie ta connexion.");
    },
    [settings, userId],
  );

  return { settings, update, saving, error };
}

export function vibrate(settings: GameSettings, ms = 30) {
  if (settings.vibrations && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
}
