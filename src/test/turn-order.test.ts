import { describe, expect, it } from "vitest";
import { salonTurn, turnOrder, type TurnPlayer } from "../lib/turn-order";

const p = (id: string, role: string, joined_at: string, hp = 14): TurnPlayer => ({ id, user_id: id, display_name: id, role, joined_at, hp });
const players = [p("n", "narrator", "2026-01-01"), p("3", "adventurer", "2026-01-04"), p("1", "adventurer", "2026-01-02"), p("2", "adventurer", "2026-01-03")];
describe("salon turns", () => {
  it("orders adventurers by joining without narrator", () => expect(turnOrder(players).map((v) => v.id)).toEqual(["1", "2", "3"]));
  it("starts with player 1 even when narrator joined first", () => expect(salonTurn({}, players, "n").label).toBe("Tour de joueur 1 · 1"));
  it.each(["1", "2", "3"])("only grants the active participant %s a turn", (id) => {
    for (const user of players) expect(salonTurn({ turn_player_id: id }, players, user.id).isMine).toBe(user.id === id);
  });
  it("announces your turn", () => expect(salonTurn({}, players, "1").message).toBe("C’est à ton tour !"));
  it("does not grant a narrator a player turn", () => expect(salonTurn({ turn_player_id: "n" }, players, "n").isMine).toBe(false));
  it("skips incapacitated or removed participants", () => {
    const roster = players.map((v) => v.id === "1" ? { ...v, hp: 0 } : v);
    expect(salonTurn({ turn_player_id: "1" }, roster, "2").isMine).toBe(true);
    expect(salonTurn({ turn_player_id: "missing" }, roster, "2").label).toBe("Tour de joueur 2 · 2");
  });
  it("preserves automatic solo play", () => expect(salonTurn({ solo: true }, [p("1", "adventurer", "2026-01-02")], "1").isMine).toBe(true));
  it("breaks tied join dates consistently", () => expect(turnOrder([p("b", "adventurer", "same"), p("a", "adventurer", "same")]).map((v) => v.id)).toEqual(["a", "b"]));
});