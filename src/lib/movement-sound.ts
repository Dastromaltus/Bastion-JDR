import type { WorldActor } from "./world-actors";

export const MOVEMENT_SOUND_EVENT = "bastion-movement-sound";

export function characterStepped(actor: WorldActor, previous?: { x: number; y: number }) {
  return !!previous && actor.sprite !== "treasure" && !actor.dead &&
    (actor.x !== previous.x || actor.y !== previous.y);
}