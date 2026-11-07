import { expect, it } from "vitest";
import { worldKeyDirection } from "../lib/world-keys";
import { WORLD_DELTAS } from "../lib/world-map";

it.each([["z", 0, -1], ["q", -1, 0], ["s", 0, 1], ["d", 1, 0]] as const)("%s moves exactly one tile on its axis", (key, x, y) => {
  const dir = worldKeyDirection(key, false, false);
  expect(dir && WORLD_DELTAS[dir]).toEqual([x, y]);
});
it("does not repeat a held key or steal typing", () => {
  expect(worldKeyDirection("z", true, false)).toBeUndefined();
  expect(worldKeyDirection("z", false, true)).toBeUndefined();
});