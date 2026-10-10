import { describe, it, expect } from "vitest";
import { campaignIssues, playerPlacements, type Campaign, type Placement } from "@/lib/campaign-model";
const placement: Placement = { id: "p", room_key: "a", kind: "mob", catalog_id: "e", hidden: true, trigger: "entree", tile_x: 16, tile_y: 9, overrides: {} };
const document: Campaign = { revision: 0, name: "Campagne", summary: "", difficulty: "initiation", recommended_players: 3, is_template: false, status: "draft", stages: [{ position: 0, template_id: "t", objective: "Sortir", objective_room: "b", exit_room: "b", intro_text: "", track: "forteresse", placements: [] }] };
const ops = [{ id: "t", rooms: [{ key: "a", connections: ["b"] }, { key: "b", connections: ["a"] }] }];
describe("campaign validation and preview", () => {
  it("accepts a connected objective and exit", () => expect(campaignIssues(document, ops, [])).toEqual([]));
  it("blocks inaccessible rooms", () => expect(campaignIssues(document, [{ id: "t", rooms: [{ key: "a", connections: [] }, { key: "b", connections: [] }] }], [])).toContain("Étape 1 : salle inaccessible."));
  it("blocks over-budget mobs", () => expect(campaignIssues({ ...document, stages: [{ ...document.stages[0], placements: Array.from({ length: 4 }, () => placement) }] } as Campaign, ops, [{ id: "e", threat_cost: 3 }])).toContain("Étape 1 : menace 12/9."));
  it("removes hidden mobs and treasures from player preview", () => expect(playerPlacements([placement, { ...placement, id: "t", kind: "treasure" }, { ...placement, id: "v", hidden: false }]).map((p) => p.id)).toEqual(["v"]));
  it("rejects a missing exit", () => expect(campaignIssues({ ...document, stages: [{ ...document.stages[0], exit_room: "missing" }] } as Campaign, ops, [])).toContain("Étape 1 : map sans sortie accessible."));
});