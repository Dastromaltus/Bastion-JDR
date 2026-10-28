import * as Phaser from "phaser";
import tiles from "@/assets/world-tiles.png";
import mapSprites from "@/assets/map-sprites.png.asset.json";
import zombieSheet from "@/assets/zombie-sheet.png.asset.json";

/** Zombie sheet: 32px frames, 19 cols. Rows: idle, walk×4, attack×4, damage×4, death. Directions: bas, gauche, haut, droite. */
const Z_COLS = 19, DIRS = ["down", "left", "up", "right"] as const;
const Z_DIE_LAST = 13 * Z_COLS + 10;
type ZState = { x: number; y: number; hp?: number; dead?: boolean; dir: number };
function dirOf(dx: number, dy: number, fallback: number) { if (!dx && !dy) return fallback; return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 1 : 3) : (dy < 0 ? 2 : 0); }
import { GRID, type GridMap } from "@/lib/map-grid";
const map = { width: GRID, height: GRID };
import type { WorldActor } from "@/lib/world-actors";
import { motionDisabled, MOTION_EVENT } from "@/lib/motion";

export class WorldScene extends Phaser.Scene {
  private actors = new Map<string, Phaser.GameObjects.Container>();
  private scenery: Phaser.GameObjects.Image[] = [];
  private prev = new Map<string, ZState>();
  constructor() { super("SalonWorld"); }
  preload() {
    this.load.spritesheet("world-tiles", tiles, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("map-sprites", mapSprites.url, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("zombie", zombieSheet.url, { frameWidth: 32, frameHeight: 32 });
  }
  create() {
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--world-label-bg").trim() || "#111";
    const row = (r: number, n: number) => this.anims.generateFrameNumbers("zombie", { start: r * Z_COLS, end: r * Z_COLS + n - 1 });
    this.anims.create({ key: "z-idle", frames: row(0, 19), frameRate: 5, repeat: -1 });
    DIRS.forEach((d, i) => {
      this.anims.create({ key: `z-walk-${i}`, frames: row(1 + i, 4), frameRate: 10 });
      this.anims.create({ key: `z-attack-${i}`, frames: row(5 + i, 5), frameRate: 10 });
      this.anims.create({ key: `z-dmg-${i}`, frames: row(9 + i, 4), frameRate: 10 });
    });
    this.anims.create({ key: "z-die", frames: row(13, 11), frameRate: 10 });
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
    const hurt = actors.filter((a) => a.sprite !== "zombie" && a.hp !== undefined && (this.prev.get(a.id)?.hp ?? a.hp) > a.hp);
    for (const actor of actors) {
      let node = this.actors.get(actor.id);
      const sharing = actors.filter((a) => a.x === actor.x && a.y === actor.y);
      const slot = sharing.findIndex((a) => a.id === actor.id);
      const x = Phaser.Math.Clamp(actor.x * 16 + 8 + (slot - (sharing.length - 1) / 2) * 16, 8, map.width * 16 - 8), y = actor.y * 16 + 8;
      if (!node) {
        const sprite = actor.sprite === "treasure"
          ? this.add.text(0, -1, "✦", { fontFamily: "monospace", fontSize: "12px", color: "#ffd84a" }).setOrigin(0.5)
          : actor.sprite === "zombie"
          ? this.add.sprite(0, -6, "zombie", actor.dead ? Z_DIE_LAST : 0)
          : this.add.image(0, -2, "world-tiles", actor.frame);
        if (sprite instanceof Phaser.GameObjects.Sprite && !actor.dead && !reduced) sprite.play("z-idle");
        const label = this.add.text(0, -15, actor.name, { fontFamily: "VT323, monospace", fontSize: "8px", color: getComputedStyle(document.documentElement).getPropertyValue("--world-label").trim(), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--world-label-bg").trim(), padding: { x: 2, y: 1 } }).setOrigin(0.5, 1).setVisible(false);
        node = this.add.container(x, y, [sprite, label]);
        if (actor.frame === 12) sprite.setInteractive().on("pointerdown", () => window.dispatchEvent(new CustomEvent("bastion-select-mob", { detail: actor.id })));
        this.actors.set(actor.id, node);
        if (!reduced) this.tweens.add({ targets: sprite, alpha: { from: 0, to: 1 }, scale: { from: 0.88, to: 1 }, duration: actor.frame === 12 ? 200 : 160, ease: "Linear" });
      } else {
        const sprite = node.list[0];
        if (sprite instanceof Phaser.GameObjects.Image && !actor.sprite) sprite.setFrame(actor.frame);
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
      if (actor.sprite === "zombie") this.animateZombie(node, actor, reduced);
      else this.prev.set(actor.id, { x: actor.x, y: actor.y, ...(actor.hp !== undefined ? { hp: actor.hp } : {}), dir: 0 });
    }
    for (const id of [...this.prev.keys()]) if (!ids.has(id)) this.prev.delete(id);
    if (!hurt.length) return;
    // An adventurer lost HP: the adjacent living zombie plays its attack toward them.
    for (const t of hurt) {
      const z = actors.find((a) => a.sprite === "zombie" && !a.dead && Math.abs(a.x - t.x) <= 1 && Math.abs(a.y - t.y) <= 1);
      const zs = z && this.actors.get(z.id)?.list[0];
      if (!z || !(zs instanceof Phaser.GameObjects.Sprite)) continue;
      const dir = dirOf(t.x - z.x, t.y - z.y, this.prev.get(z.id)?.dir ?? 0);
      const st = this.prev.get(z.id); if (st) st.dir = dir;
      if (reduced) zs.setFrame((5 + dir) * Z_COLS + 2); else zs.play(`z-attack-${dir}`).chain("z-idle");
    }
  }
  private animateZombie(node: Phaser.GameObjects.Container, actor: WorldActor, reduced: boolean) {
    const sprite = node.list[0];
    const label = node.list[1];
    const before = this.prev.get(actor.id);
    const dir = before ? dirOf(actor.x - before.x, actor.y - before.y, before.dir) : 0;
    this.prev.set(actor.id, { x: actor.x, y: actor.y, ...(actor.hp !== undefined ? { hp: actor.hp } : {}), ...(actor.dead ? { dead: true } : {}), dir });
    if (!(sprite instanceof Phaser.GameObjects.Sprite) || !before) return;
    if (actor.dead) {
      if (label instanceof Phaser.GameObjects.Text) label.setVisible(false);
      if (before.dead) return;
      if (reduced) sprite.stop().setFrame(Z_DIE_LAST); else sprite.play("z-die");
      return;
    }
    if (reduced) { sprite.stop().setFrame(0); return; }
    if (actor.hp !== undefined && before.hp !== undefined && actor.hp < before.hp) sprite.play(`z-dmg-${dir}`).chain("z-idle");
    else if (actor.x !== before.x || actor.y !== before.y) sprite.play(`z-walk-${dir}`).chain("z-idle");
  }
}
export function createWorldGame(parent: HTMLDivElement, ready: () => void) {
  const game = new Phaser.Game({ type: Phaser.CANVAS, width: 400, height: 272, parent, pixelArt: true, antialias: false, roundPixels: true, transparent: true, banner: false, scene: WorldScene });
  game.events.once("world-ready", ready);
  return game;
}