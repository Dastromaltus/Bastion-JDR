import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { WORLD_DELTAS, worldPosition, worldWalkable } from "./world-map";

export const moveWorldPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ gameId: z.string().uuid(), direction: z.enum(["up", "down", "left", "right"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: me, error: memberError } = await context.supabase.from("game_players").select("*").eq("game_id", data.gameId).eq("user_id", context.userId).maybeSingle();
    if (memberError || !me || me.role !== "adventurer") throw new Error("Seuls les aventuriers de ce salon peuvent se déplacer.");
    const { data: game } = await context.supabase.from("games").select("status").eq("id", data.gameId).single();
    if (game?.status !== "playing" || me.hp <= 0) throw new Error("Déplacement indisponible pour le moment.");
    const { requireSalonTurn } = await import("./turns.server");
    await requireSalonTurn(context, data.gameId);
    const zone = me.current_zone ?? "entree";
    const { x, y } = worldPosition(me, zone);
    const [dx, dy] = WORLD_DELTAS[data.direction];
    if (!worldWalkable(x + dx, y + dy)) return { moved: false, message: "Le passage est bloqué.", x, y };
    // Privileged write only after membership, role, status and collision validation.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let update = supabaseAdmin.from("game_players").update({ world_x: x + dx, world_y: y + dy, world_zone: zone })
      .eq("id", me.id).eq("game_id", data.gameId).eq("world_x", me.world_x).eq("world_y", me.world_y);
    update = me.current_zone === null ? update.is("current_zone", null) : update.eq("current_zone", me.current_zone);
    update = me.world_zone === null ? update.is("world_zone", null) : update.eq("world_zone", me.world_zone);
    const { data: changed, error } = await update.select("id").maybeSingle();
    if (error || !changed) throw new Error("La position a changé : réessaie.");
    return { moved: true, message: "", x: x + dx, y: y + dy };
  });