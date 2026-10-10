import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0009_scope_selected_catalogue_and_demo_reads.sql", "utf8");

describe("selected shared catalogue and demo read policies", () => {
  it("requires an authenticated identity for all five template policies", () => {
    for (const table of ["dungeon_templates", "dungeon_rooms", "dungeon_room_enemies", "dungeon_room_treasures", "dungeon_events"]) {
      expect(sql).toContain(`ON public.${table} USING ((SELECT auth.uid()) IS NOT NULL)`);
    }
  });

  it("limits public exploration reads to the existing demo and its related rows", () => {
    expect(sql).toContain("ON public.exploration_sessions USING (slug = 'porte-rouge')");
    for (const table of ["exploration_players", "exploration_entities", "exploration_events", "exploration_saves"]) {
      expect(sql).toContain(`session.id = ${table}.session_id AND session.slug = 'porte-rouge'`);
    }
  });

  it("changes only the ten selected policies without weakening write access", () => {
    expect(sql.match(/ALTER POLICY/g)).toHaveLength(10);
    expect(sql).not.toMatch(/USING\s*\(true\)|CREATE POLICY|GRANT|WITH CHECK|DISABLE ROW LEVEL SECURITY/i);
  });
});