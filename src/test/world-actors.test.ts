import { describe, expect, it } from "vitest";
import { participantActors, type WorldParticipant } from "@/lib/world-actors";

const players: WorldParticipant[] = [
  { id: "n", display_name: "Mat", role: "narrator", race: "Humain", current_zone: "entree" },
  { id: "a", display_name: "Alice", role: "adventurer", race: "Oiseau", current_zone: "machines", world_zone: "machines", world_x: 10, world_y: 9 },
  { id: "b", display_name: "Bob", role: "adventurer", race: "Reptile", current_zone: "machines" },
  { id: "c", display_name: "Cam", role: "adventurer", race: "Insecte", current_zone: "entree" },
];
describe("shared salon characters", () => {
  it("shows both adventurers and the narrator in the viewed zone", () => {
    expect(participantActors(players, "machines", "a").map((p) => p.id)).toEqual(["n", "a", "b"]);
  });
  it("marks the narrator as an observer and the viewer by name", () => {
    const actors = participantActors(players, "machines", "n");
    expect(actors[0]).toMatchObject({ name: "Mat · narrateur · toi", x: 12, y: 6 });
    expect(actors[1]).toMatchObject({ name: "Alice", x: 10, y: 9, frame: 11 });
  });
  it("does not fabricate other-zone adventurer positions", () => {
    expect(participantActors(players, "entree", "c").map((p) => p.id)).toEqual(["n", "c"]);
  });
  it("keeps solo games narrator-free", () => {
    expect(participantActors(players.filter((p) => p.id === "a"), "machines", "a")).toHaveLength(1);
  });
});