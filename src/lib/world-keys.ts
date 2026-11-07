import type { WorldDirection } from "./world-map";

export function worldKeyDirection(key: string, repeat: boolean, editing: boolean): WorldDirection | undefined {
  if (repeat || editing) return undefined;
  const keys: Record<string, WorldDirection> = { z: "up", q: "left", s: "down", d: "right", ArrowUp: "up", ArrowLeft: "left", ArrowDown: "down", ArrowRight: "right" };
  return keys[key.length === 1 ? key.toLowerCase() : key];
}