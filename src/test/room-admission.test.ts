import { describe, expect, it } from "vitest";
import { roomAdmissionError } from "../lib/room-admission";

const room = { status: "playing", locked: false, players: 2, maxPlayers: 5 };
describe("salon admission", () => {
  it("allows an adventurer to join after the game starts", () => {
    expect(roomAdmissionError(room)).toBeNull();
  });
  it("still allows arrivals before start", () => {
    expect(roomAdmissionError({ ...room, status: "waiting" })).toBeNull();
  });
  it("honours an explicit narrator lock", () => {
    expect(roomAdmissionError({ ...room, locked: true })).not.toBeNull();
  });
  it("refuses a sixth adventurer in a five-adventurer salon", () => {
    expect(roomAdmissionError({ ...room, players: 5 })).not.toBeNull();
  });
  it("does not reopen a finished game", () => {
    expect(roomAdmissionError({ ...room, status: "finished" })).not.toBeNull();
  });
});