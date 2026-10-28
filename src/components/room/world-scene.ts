import * as Phaser from "phaser";
import tiles from "@/assets/world-tiles.png";
import mapSprites from "@/assets/map-sprites.png.asset.json";
import { GRID, type GridMap } from "@/lib/map-grid";
const map = { width: GRID, height: GRID };
import type { WorldActor } from "@/lib/world-actors";
import { motionDisabled, MOTION_EVENT } from "@/lib/motion";

export class WorldScene extends Phaser.Scene {
  private actors = new Map<string, Phaser.GameObjects.Container>();
  private scenery: Phaser.GameObjects.Image[] = [];
  constructor() { super("SalonWorld"); }
  preload() {
    this.load.spritesheet("world-tiles", tiles, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("map-sprites", mapSprites.url, { frameWidth: 16, frameHeight: 16 });
  }
  create() {
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--world-label-bg").trim() || "#111";
    this.cameras.main.setBounds(0, 0, GRID * 16, GRID * 16).setBackgroundColor(bg);
    for (let i = 0; i < GRID * GRID; i++) this.scenery.push(this.add.image((i % GRID) * 16 + 8, Math.floor(i / GRID) * 16 + 8, "map-sprites", 8).setVisible(false));
    this.events.on("map", (grid: GridMap) => {
      grid.tiles.forEach((t, i) => { const img = this.scenery[i]; if (img) img.setVisible(t > 0).setFrame(Math.max(0, t - 1)); });
    });
    this.events.on("focus", (p: { x: number; y: number }) => {
      const cam = this.cameras.main, tx = p.x * 16 + 8, ty = p.y * 16 + 8;
      if (motionDisabled()) cam.centerOn(tx, ty); else cam.pan(tx, ty, 160, "Linear", true);
    });
    this.events.on("actors", (actors: WorldActor[]) => this.sync(actors));
    const stop = () => {
      if (motionDisabled()) {
        this.tweens.getTweens().forEach((tween) => { tween.complete(); });
      }
    };
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    window.addEventListener(MOTION_EVENT, stop);
    media.addEventListener("change", stop);
    this.events.once("shutdown", () => { window.removeEventListener(MOTION_EVENT, stop); media.removeEventListener("change", stop); });
    this.game.events.emit("world-ready");
  }
  sync(actors: WorldActor[]) {
    const ids = new Set(actors.map((a) => a.id));
    for (const [id, node] of this.actors) if (!ids.has(id)) { node.destroy(); this.actors.delete(id); }
    const reduced = motionDisabled();
    for (const actor of actors) {
      let node = this.actors.get(actor.id);
      const sharing = actors.filter((a) => a.x === actor.x && a.y === actor.y);
      const slot = sharing.findIndex((a) => a.id === actor.id);
      const x = Phaser.Math.Clamp(actor.x * 16 + 8 + (slot - (sharing.length - 1) / 2) * 16, 8, map.width * 16 - 8), y = actor.y * 16 + 8;
      if (!node) {
        const sprite = this.add.image(0, -2, "world-tiles", actor.frame);
        const label = this.add.text(0, -15, actor.name, { fontFamily: "VT323, monospace", fontSize: "8px", color: getComputedStyle(document.documentElement).getPropertyValue("--world-label").trim(), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--world-label-bg").trim(), padding: { x: 2, y: 1 } }).setOrigin(0.5, 1).setVisible(false);
        node = this.add.container(x, y, [sprite, label]);
        if (actor.frame === 12) sprite.setInteractive().on("pointerdown", () => window.dispatchEvent(new CustomEvent("bastion-select-mob", { detail: actor.id })));
        this.actors.set(actor.id, node);
        if (!reduced) this.tweens.add({ targets: sprite, alpha: { from: 0, to: 1 }, scale: { from: 0.88, to: 1 }, duration: actor.frame === 12 ? 200 : 160, ease: "Linear" });
      } else {
        const sprite = node.list[0];
        if (sprite instanceof Phaser.GameObjects.Image) sprite.setFrame(actor.frame);
        const label = node.list[1];
        if (label instanceof Phaser.GameObjects.Text) label.setText(actor.name);
        this.tweens.killTweensOf(node);
        if (reduced) node.setPosition(x, y);
        else if (node.x !== x || node.y !== y) {
          this.tweens.add({ targets: node, x, y, duration: 160, ease: "Linear" });
          if (sprite instanceof Phaser.GameObjects.Image) {
            this.tweens.killTweensOf(sprite);
            sprite.setY(-2).setScale(1).setAlpha(1);
            this.tweens.add({ targets: sprite, y: -4, duration: 80, yoyo: true, ease: "Linear" });
          }
        }
      }
      const label = node.list[1];
      if (label instanceof Phaser.GameObjects.Text) {
        const row = actors.filter((a) => a.y === actor.y).findIndex((a) => a.id === actor.id);
        label.setVisible(true).setY(-15 - row * 11);
        label.setX(Phaser.Math.Clamp(x, label.width / 2, map.width * 16 - label.width / 2) - x);
      }
      node.setDepth(100 + y);
    }
  }
}
export function createWorldGame(parent: HTMLDivElement, ready: () => void) {
  const game = new Phaser.Game({ type: Phaser.CANVAS, width: 400, height: 272, parent, pixelArt: true, antialias: false, roundPixels: true, transparent: true, banner: false, scene: WorldScene });
  game.events.once("world-ready", ready);
  return game;
}