import { describe, expect, it } from "vitest";
import { cellWalkable, validateGrid } from "@/lib/map-grid";
import { TRACKS } from "@/lib/ambience-tracks";
import { READY_CONTENT, readyMapStep } from "@/lib/ready-maps";

describe("ready-to-play maps", () => {
  for (const key of Object.keys(READY_CONTENT)) {
    it(`${key} has a 40×40 grid with reachable mobs and treasures and music`, () => {
      const step = readyMapStep(key);
      expect(step.tiles).toHaveLength(40 * 40);
      expect(validateGrid(step.tiles, step.spawn)).toBeNull();
      expect(step.enemies.length).toBeGreaterThan(0);
      expect(step.treasures?.length).toBeGreaterThan(0);
      expect(TRACKS.find((t) => t.key === step.track)?.synth).toBeTruthy();
      const reached = new Set([`${step.spawn.x},${step.spawn.y}`]);
      const queue = [step.spawn];
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i];
        if (!p) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = p.x + (dx ?? 0), y = p.y + (dy ?? 0), id = `${x},${y}`;
          if (cellWalkable(step, x, y) && !reached.has(id)) { reached.add(id); queue.push({ x, y }); }
        }
      }
      const placements = [...step.enemies, ...(step.treasures ?? [])];
      for (const p of placements) expect(reached.has(`${p.x},${p.y}`)).toBe(true);
      expect(new Set(placements.map((p) => `${p.x},${p.y}`)).size).toBe(placements.length);
    });
  }
  it("returns independent copies for salon edits", () => {
    const first = readyMapStep("le-sas");
    first.tiles[0] = 6; first.enemies.length = 0;
    const second = readyMapStep("le-sas");
    expect(second.tiles[0]).not.toBe(6);
    expect(second.enemies).toHaveLength(3);
    expect(second.treasures).toHaveLength(3);
  });
});