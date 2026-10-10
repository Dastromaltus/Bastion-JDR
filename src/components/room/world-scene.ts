import * as Phaser from "phaser";
import tiles from "@/assets/world-tiles.png";
import map from "@/data/salon-world.json";

export type WorldActor = { id: string; name: string; x: number; y: number; frame: number; own?: boolean };
export class WorldScene extends Phaser.Scene {
  private actors = new Map<string, Phaser.GameObjects.Container>();
  constructor() { super("SalonWorld"); }
  preload() { this.load.spritesheet("world-tiles", tiles, { frameWidth: 16, frameHeight: 16 }); }
  create() {
    map.layers[0]?.data.forEach((tile, i) => this.add.image((i % map.width) * 16 + 8, Math.floor(i / map.width) * 16 + 8, "world-tiles", tile - 1));
    this.events.on("actors", (actors: WorldActor[]) => this.sync(actors));
    this.game.events.emit("world-ready");
  }
  sync(actors: WorldActor[]) {
    const ids = new Set(actors.map((a) => a.id));
    for (const [id, node] of this.actors) if (!ids.has(id)) { node.destroy(); this.actors.delete(id); }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !!document.querySelector(".room-reduced-motion");
    for (const actor of actors) {
      let node = this.actors.get(actor.id);
      const sharing = actors.filter((a) => a.x === actor.x && a.y === actor.y);
      const slot = sharing.findIndex((a) => a.id === actor.id);
      const x = actor.x * 16 + 8 + (slot - (sharing.length - 1) / 2) * 16, y = actor.y * 16 + 8;
      if (!node) {
        const sprite = this.add.image(0, -2, "world-tiles", actor.frame);
        const label = this.add.text(0, -15, actor.name, { fontFamily: "VT323, monospace", fontSize: "8px", color: getComputedStyle(document.documentElement).getPropertyValue("--world-label").trim(), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--world-label-bg").trim(), padding: { x: 2, y: 1 } }).setOrigin(0.5, 1);
        node = this.add.container(x, y, [sprite, label]);
        this.actors.set(actor.id, node);
      } else {
        const sprite = node.list[0];
        if (sprite instanceof Phaser.GameObjects.Image) sprite.setFrame(actor.frame);
        const label = node.list[1];
        if (label instanceof Phaser.GameObjects.Text) label.setText(actor.name);
        this.tweens.killTweensOf(node);
        if (reduced) node.setPosition(x, y);
        else this.tweens.add({ targets: node, x, y, duration: 160, ease: "Linear" });
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