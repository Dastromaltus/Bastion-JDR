import { supabase } from "@/integrations/supabase/client";
import type { RaceName } from "@/lib/races";

export const SKIN_COLORS = ["#f2c19b", "#b9774f", "#6b4130", "#7fc46a", "#5aa0e0", "#e86a9a"] as const;
export const OUTFIT_COLORS = ["#ffd23f", "#ff5d8f", "#3fa7ff", "#4ecb71", "#9b6bff", "#2b2b2b"] as const;
export const ACCESSORIES = [
  { key: "aucun", label: "Aucun" },
  { key: "casque", label: "Casque" },
  { key: "cape", label: "Cape" },
  { key: "sac", label: "Sac à dos" },
  { key: "bandeau", label: "Bandeau" },
] as const;
export type AccessoryKey = (typeof ACCESSORIES)[number]["key"];

export type CharacterLook = { name: string; race: RaceName; skin: string; outfit: string; accessory: AccessoryKey };
export const DEFAULT_LOOK: CharacterLook = { name: "", race: "Humain", skin: SKIN_COLORS[0], outfit: OUTFIT_COLORS[0], accessory: "aucun" };

/** Character look lives in the owner-only user_settings row, next to game settings. */
export async function loadCharacter(userId: string): Promise<CharacterLook | null> {
  const { data } = await supabase.from("user_settings").select("settings").eq("user_id", userId).maybeSingle();
  const c = (data?.settings as any)?.character;
  return c ? { ...DEFAULT_LOOK, ...c } : null;
}

export async function saveCharacter(userId: string, look: CharacterLook) {
  const { data } = await supabase.from("user_settings").select("settings").eq("user_id", userId).maybeSingle();
  const settings = { ...((data?.settings as object) ?? {}), character: look };
  const { error } = await supabase.from("user_settings").upsert({ user_id: userId, settings: settings as any, updated_at: new Date().toISOString() });
  if (error) throw new Error("Personnage non enregistré. Vérifie ta connexion.");
}
