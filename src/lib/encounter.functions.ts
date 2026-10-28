import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ZONES } from "./races";

const encounterSchema = z.object({
  title: z.string(),
  pitch: z.string(),
  zone: z.string(),
  objectives: z.array(z.object({ label: z.string(), detail: z.string() })),
  enemies: z.array(z.object({ name: z.string(), count: z.number(), role: z.string(), tactic: z.string() })),
  twist: z.string(),
  balance: z.string(),
});
export type Encounter = z.infer<typeof encounterSchema>;

/** Narrator-only AI encounter proposal. Uses only this salon's visible catalog names. */
export const suggestEncounter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      gameId: z.string().uuid(),
      scenario: z.string().trim().min(5, "Décris le scénario.").max(1500),
      party: z.string().trim().min(3, "Décris le groupe.").max(1500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase.from("game_players").select("role").eq("game_id", data.gameId).eq("user_id", context.userId).maybeSingle();
    if (me?.role !== "narrator") throw new Error("Seul le narrateur de ce salon peut faire ça.");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Service d'IA non configuré.");

    const { data: cat } = await context.supabase
      .from("enemy_catalog")
      .select("name, category, speed, strength, endurance, ability")
      .or(`game_id.is.null,game_id.eq.${data.gameId}`);
    const catalog = (cat ?? []).map((e: any) => `- ${e.name} (${e.category}; V${e.speed} F${e.strength} E${e.endurance}; ${e.ability ?? "—"})`).join("\n");
    const zones = ZONES.map((z: any) => z.label ?? z.name ?? z.key).join(", ");

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system:
        "Tu es l'assistant du narrateur de Bastion, un dungeon crawler pour 3 à 5 aventuriers. Règles : jets de X d6, réussite sur 5 ou 6 ; stats des mobs de 1 à 5 (Vitesse, Force, Endurance). Propose UNE rencontre équilibrée pour le groupe décrit, en français. Utilise de préférence les ennemis du catalogue (noms exacts) et une zone de la liste. Objectifs concrets (2 à 3), au moins un hors combat.",
      prompt: `Zones disponibles : ${zones}\n\nCatalogue d'ennemis :\n${catalog || "(vide)"}\n\nScénario :\n${data.scenario}\n\nGroupe d'aventuriers :\n${data.party}`,
      output: Output.object({ schema: encounterSchema }),
      maxRetries: 0,
      providerOptions: {
        openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
      },
    });
    try {
      return { encounter: (await result.output) as Encounter };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.lastError?.statusCode;
      console.error("suggestEncounter failed", status, e?.message);
      if (status === 429) throw new Error("Trop de demandes, réessaie dans un instant.");
      if (status === 402) throw new Error("Crédits IA épuisés : ajoute des crédits dans les paramètres de l'espace de travail.");
      throw new Error("La proposition de rencontre a échoué. Réessaie.");
    }
  });
