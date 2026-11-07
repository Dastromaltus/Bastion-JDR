import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { WORLD_DELTAS, worldPosition, worldWalkable } from "./world-map";

const direction = z.enum(["up", "down", "left", "right"]);

// Free movement: adventurers move whenever the game is playing; turns only gate attacks and abilities.
export const moveWorldPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ gameId: z.string().uuid(), direction }).parse(input))
  .handler(async ({ data, context }) => {
    const [dx, dy] = WORLD_DELTAS[data.direction];
    const { data: result, error } = await context.supabase.rpc("salon_move_player", { p_game_id: data.gameId, p_dx: dx, p_dy: dy });
    if (error) throw new Error(error.message);
    const r = result as { nomap?: boolean; moved?: boolean; x?: number; y?: number };
    if (!r.nomap) return { moved: !!r.moved, message: r.moved ? "" : "Le passage est bloqué.", x: r.x!, y: r.y! };
    // Legacy salons without their own map copy: validate against the template map.
    const { data: me } = await context.supabase.from("game_players").select("*").eq("game_id", data.gameId).eq("user_id", context.userId).maybeSingle();
    if (!me || me.role !== "adventurer" || me.hp <= 0) throw new Error("Déplacement indisponible pour le moment.");
    const zone = me.current_zone ?? "entree";
    const { salonGrid } = await import("./maps.functions");
    const grid = await salonGrid(context.supabase, data.gameId);
    const { x, y } = worldPosition(me, zone, grid);
    if (!worldWalkable(x + dx, y + dy, grid)) return { moved: false, message: "Le passage est bloqué.", x, y };
    // Privileged write only after membership, role and collision validation.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: writeError } = await supabaseAdmin.from("game_players").update({ world_x: x + dx, world_y: y + dy, world_zone: zone }).eq("id", me.id).eq("game_id", data.gameId);
    if (writeError) throw new Error("La position a changé : réessaie.");
    return { moved: true, message: "", x: x + dx, y: y + dy };
  });

/** Narrator-only free movement of a mob, validated against the salon map in the database. */
export const moveSalonMob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ gameId: z.string().uuid(), enemyId: z.string().uuid(), direction }).parse(input))
  .handler(async ({ data, context }) => {
    const [dx, dy] = WORLD_DELTAS[data.direction];
    const { data: result, error } = await context.supabase.rpc("salon_move_mob", { p_game_id: data.gameId, p_enemy_id: data.enemyId, p_dx: dx, p_dy: dy });
    if (error) throw new Error(error.message);
    const r = result as { moved: boolean; x: number; y: number };
    return { moved: r.moved, message: r.moved ? "" : "Le passage est bloqué.", x: r.x, y: r.y };
  });
