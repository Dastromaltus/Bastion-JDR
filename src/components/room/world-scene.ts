import * as Phaser from "phaser";
import tiles from "@/assets/world-tiles.png";
import mapSprites from "@/assets/map-textures-complete.png.asset.json";
import zombieSheet from "@/assets/zombie-sheet.png.asset.json";
import slimeSheet from "@/assets/slime-sheet.png.asset.json";
import yetiSheet from "@/assets/yeti-sheet.png.asset.json";
import wolfSheet from "@/assets/wolf-sheet.png.asset.json";
import orcSheet from "@/assets/orc-sheet.png.asset.json";
import goblinSheet from "@/assets/goblin-sheet.png.asset.json";
import cyclopsSheet from "@/assets/cyclops-sheet.png.asset.json";
import humanSheet from "@/assets/human-sheet.png.asset.json";
import slashSheet from "@/assets/slash-atlas.png.asset.json";

/** Zombie sheet: 32px frames, 19 cols. Rows: idle, walk×4, attack×4, damage×4, death. Directions: bas, gauche, haut, droite. */
const Z_COLS = 19, DIRS = ["down", "left", "up", "right"] as const;
const Z_DIE_LAST = 13 * Z_COLS + 10;
/** Slime sheet: 32px frames, 9 cols. Rows: idle (4), attack (4), damage (4), death (9). No directions. */
const S_COLS = 9;
const S_DIE_LAST = 3 * S_COLS + 8;
const Y_COLS = 16, Y_DIE_LAST = 16 * Y_COLS + 13;
const W_COLS = 12, W_DIE_LAST = 16 * W_COLS + 8;
const O_COLS = 16, O_DIE_LAST = 16 * O_COLS + 11;
const animated = (sprite: WorldActor["sprite"]) => sprite === "zombie" || sprite === "slime" || sprite === "yeti" || sprite === "wolf" || sprite === "orc" || sprite === "goblin" || sprite === "cyclops" || sprite === "human";
type ZState = { x: number; y: number; hp?: number; dead?: boolean; dir: number };
function dirOf(dx: number, dy: number, fallback: number) { if (!dx && !dy) return fallback; return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 1 : 3) : (dy < 0 ? 2 : 0); }
import { GRID, tileFrame, type GridMap } from "@/lib/map-grid";
const map = { width: GRID, height: GRID };
import type { WorldActor } from "@/lib/world-actors";
import { motionDisabled, MOTION_EVENT } from "@/lib/motion";

export class WorldScene extends Phaser.Scene {
  private actors = new Map<string, Phaser.GameObjects.Container>();
  private terrain: Phaser.Tilemaps.TilemapLayer | null = null;
  private passage: Phaser.GameObjects.Text | null = null;
  private prev = new Map<string, ZState>();
  constructor() { super("SalonWorld"); }
  preload() {
    this.load.spritesheet("world-tiles", tiles, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("map-sprites", mapSprites.url, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("zombie", zombieSheet.url, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("slime", slimeSheet.url, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("yeti", yetiSheet.url, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("wolf", wolfSheet.url, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("orc", orcSheet.url, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("goblin", goblinSheet.url, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("cyclops", cyclopsSheet.url, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("human", humanSheet.url, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("slash", slashSheet.url, { frameWidth: 96, frameHeight: 96 });
  }
  create() {
    this.anims.create({ key: "slash-hit", frames: this.anims.generateFrameNumbers("slash", { start: 0, end: 19 }), frameRate: 50, repeat: 0 });
    this.events.on("slash", (id: string) => {
      const target = this.actors.get(id);
      if (!target || motionDisabled()) return;
      const effect = this.add.sprite(target.x, target.y - 9, "slash").setScale(0.5).setDepth(10000).setName("slash-effect");
      effect.play("slash-hit");
      effect.once("animationcomplete", () => effect.destroy());
    });
    const hrow = (r: number, n: number) => this.anims.generateFrameNumbers("human", { start: r * O_COLS, end: r * O_COLS + n - 1 });
    DIRS.forEach((_, i) => {
      this.anims.create({ key: `h-idle-${i}`, frames: hrow(i, 16), frameRate: 5, repeat: -1 });
      this.anims.create({ key: `h-walk-${i}`, frames: hrow(4 + i, 4), frameRate: 10 });
      this.anims.create({ key: `h-attack-${i}`, frames: hrow(8 + i, 4), frameRate: 10 });
      this.anims.create({ key: `h-dmg-${i}`, frames: hrow(12 + i, 4), frameRate: 10 });
    });
    this.anims.create({ key: "h-die", frames: hrow(16, 12), frameRate: 10 });
    this.anims.create({ key: "h-jump", frames: hrow(17, 4), frameRate: 10 });
    for (let i = 0; i < 3; i++) this.anims.create({ key: `h-charged-${i}`, frames: hrow(18 + i, 6), frameRate: 10 });
    this.events.on("human-attack", (p: { id: string; x: number; y: number }) => {
      const node = this.actors.get(p.id), state = this.prev.get(p.id);
      const sprite = node?.list[0];
      if (!(sprite instanceof Phaser.GameObjects.Sprite) || !state || motionDisabled()) return;
      const dir = dirOf(p.x - state.x, p.y - state.y, state.dir);
      sprite.play(`h-attack-${dir}`).chain(`h-idle-${dir}`);
    });
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--world-label-bg").trim() || "#111";
    const row = (r: number, n: number) => this.anims.generateFrameNumbers("zombie", { start: r * Z_COLS, end: r * Z_COLS + n - 1 });
    this.anims.create({ key: "z-idle", frames: row(0, 19), frameRate: 5, repeat: -1 });
    DIRS.forEach((d, i) => {
      this.anims.create({ key: `z-walk-${i}`, frames: row(1 + i, 4), frameRate: 10 });
      this.anims.create({ key: `z-attack-${i}`, frames: row(5 + i, 5), frameRate: 10 });
      this.anims.create({ key: `z-dmg-${i}`, frames: row(9 + i, 4), frameRate: 10 });
    });
    this.anims.create({ key: "z-die", frames: row(13, 11), frameRate: 10 });
    const srow = (r: number, n: number) => this.anims.generateFrameNumbers("slime", { start: r * S_COLS, end: r * S_COLS + n - 1 });
    this.anims.create({ key: "s-idle", frames: srow(0, 4), frameRate: 5, repeat: -1 });
    this.anims.create({ key: "s-attack", frames: srow(1, 4), frameRate: 8 });
    this.anims.create({ key: "s-dmg", frames: srow(2, 4), frameRate: 8 });
    this.anims.create({ key: "s-die", frames: srow(3, 9), frameRate: 8 });
    const yrow = (r: number, n: number) => this.anims.generateFrameNumbers("yeti", { start: r * Y_COLS, end: r * Y_COLS + n - 1 });
    DIRS.forEach((_, i) => {
      this.anims.create({ key: `y-idle-${i}`, frames: yrow(i, 16), frameRate: 5, repeat: -1 });
      this.anims.create({ key: `y-walk-${i}`, frames: yrow(4 + i, 6), frameRate: 5 });
      this.anims.create({ key: `y-attack-${i}`, frames: yrow(8 + i, 4), frameRate: 10 });
      this.anims.create({ key: `y-dmg-${i}`, frames: yrow(12 + i, 4), frameRate: 10 });
      this.anims.create({ key: `y-jump-${i}`, frames: yrow(17 + i, 6), frameRate: 10 });
    });
    this.anims.create({ key: "y-die", frames: yrow(16, 14), frameRate: 10 });
    const wrow = (r: number, n: number) => this.anims.generateFrameNumbers("wolf", { start: r * W_COLS, end: r * W_COLS + n - 1 });
    DIRS.forEach((_, i) => {
      this.anims.create({ key: `w-idle-${i}`, frames: wrow(i, 12), frameRate: 5, repeat: -1 });
      this.anims.create({ key: `w-walk-${i}`, frames: wrow(4 + i, 4), frameRate: 5 });
      this.anims.create({ key: `w-attack-${i}`, frames: wrow(8 + i, 4), frameRate: 10 });
      this.anims.create({ key: `w-dmg-${i}`, frames: wrow(12 + i, 4), frameRate: 10 });
      this.anims.create({ key: `w-jump-${i}`, frames: wrow(17 + i, 4), frameRate: 10 });
    });
    this.anims.create({ key: "w-die", frames: wrow(16, 9), frameRate: 10 });
    const orow = (r: number, n: number) => this.anims.generateFrameNumbers("orc", { start: r * O_COLS, end: r * O_COLS + n - 1 });
    DIRS.forEach((_, i) => {
      this.anims.create({ key: `o-idle-${i}`, frames: orow(i, 16), frameRate: 5, repeat: -1 });
      this.anims.create({ key: `o-walk-${i}`, frames: orow(4 + i, 4), frameRate: 5 });
      this.anims.create({ key: `o-attack-${i}`, frames: orow(8 + i, 4), frameRate: 10 });
      this.anims.create({ key: `o-dmg-${i}`, frames: orow(12 + i, 4), frameRate: 10 });
      this.anims.create({ key: `o-jump-${i}`, frames: orow(17 + i, 4), frameRate: 10 });
    });
    // ChargedAttack supplies three action stages, not four facing directions.
    for (let i = 0; i < 3; i++) this.anims.create({ key: `o-charged-${i}`, frames: orow(21 + i, 6), frameRate: 10 });
    this.anims.create({ key: "o-die", frames: orow(16, 12), frameRate: 10 });
    // Goblin GIFs share the same frame counts and directional layout as the orc.
    const grow = (r: number, n: number) => this.anims.generateFrameNumbers("goblin", { start: r * O_COLS, end: r * O_COLS + n - 1 });
    DIRS.forEach((_, i) => {
      this.anims.create({ key: `g-idle-${i}`, frames: grow(i, 16), frameRate: 5, repeat: -1 });
      this.anims.create({ key: `g-walk-${i}`, frames: grow(4 + i, 4), frameRate: 5 });
      this.anims.create({ key: `g-attack-${i}`, frames: grow(8 + i, 4), frameRate: 10 });
      this.anims.create({ key: `g-dmg-${i}`, frames: grow(12 + i, 4), frameRate: 10 });
      this.anims.create({ key: `g-jump-${i}`, frames: grow(17 + i, 4), frameRate: 10 });
    });
    for (let i = 0; i < 3; i++) this.anims.create({ key: `g-charged-${i}`, frames: grow(21 + i, 6), frameRate: 10 });
    this.anims.create({ key: "g-die", frames: grow(16, 12), frameRate: 10 });
    // Cyclops GIFs share the yeti frame layout: idle 16, walk/jump 6, death 14.
    const crow = (r: number, n: number) => this.anims.generateFrameNumbers("cyclops", { start: r * Y_COLS, end: r * Y_COLS + n - 1 });
    DIRS.forEach((_, i) => {
      this.anims.create({ key: `c-idle-${i}`, frames: crow(i, 16), frameRate: 5, repeat: -1 });
      this.anims.create({ key: `c-walk-${i}`, frames: crow(4 + i, 6), frameRate: 5 });
      this.anims.create({ key: `c-attack-${i}`, frames: crow(8 + i, 4), frameRate: 10 });
      this.anims.create({ key: `c-dmg-${i}`, frames: crow(12 + i, 4), frameRate: 10 });
      this.anims.create({ key: `c-jump-${i}`, frames: crow(17 + i, 6), frameRate: 10 });
    });
    this.anims.create({ key: "c-die", frames: crow(16, 14), frameRate: 10 });
    this.cameras.main.setBounds(0, 0, GRID * 16, GRID * 16).setBackgroundColor(bg);
    this.events.on("map", (grid: GridMap) => {
      this.passage?.destroy();
      this.passage = grid.passage ? this.add.text(grid.passage.x * 16 + 8, grid.passage.y * 16 + 8, "↑", { fontFamily: "monospace", fontSize: "16px", color: getComputedStyle(document.documentElement).getPropertyValue("--world-label").trim(), backgroundColor: bg }).setOrigin(0.5).setDepth(1) : null;
      this.terrain?.tilemap.destroy();
      const data = Array.from({ length: GRID }, (_, y) => grid.tiles.slice(y * GRID, (y + 1) * GRID).map((t) => t > 0 ? tileFrame(t) : -1));
      const tilemap = this.make.tilemap({ data, tileWidth: 16, tileHeight: 16 });
      const tileset = tilemap.addTilesetImage("map-sprites", "map-sprites", 16, 16);
      this.terrain = tileset ? tilemap.createLayer(0, tileset, 0, 0) : null;
      this.terrain?.setDepth(-1);
    });
    this.events.on("focus", (p: { id?: string; x: number; y: number }) => {
      const target = p.id ? this.actors.get(p.id) : undefined;
      if (target) {
        const cam = this.cameras.main as any, lerp = motionDisabled() ? 1 : 0.1;
        // Keep the same follow running (restarting it causes jumps); sub-pixel camera motion avoids stutter.
        if (cam._follow !== target) cam.startFollow(target, false, lerp, lerp);
        else cam.setLerp(lerp, lerp);
        return;
      }
      this.cameras.main.stopFollow();
      const cam = this.cameras.main, tx = p.x * 16 + 8, ty = p.y * 16 + 8;
      if (motionDisabled()) cam.centerOn(tx, ty); else cam.pan(tx, ty, 160, "Linear", true);
    });
    this.events.on("actors", (actors: WorldActor[]) => this.sync(actors));
    const stop = () => {
      if (motionDisabled()) {
        this.children.list.filter((child) => child.name === "slash-effect").forEach((child) => child.destroy());
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
    for (const [id, node] of this.actors) if (!ids.has(id)) { if ((this.cameras.main as any)._follow === node) this.cameras.main.stopFollow(); node.destroy(); this.actors.delete(id); }
    const reduced = motionDisabled();
    const hurt = actors.filter((a) => a.sprite === "human" && a.hp !== undefined && (this.prev.get(a.id)?.hp ?? a.hp) > a.hp);
    for (const actor of actors) {
      let node = this.actors.get(actor.id);
      const sharing = actors.filter((a) => a.x === actor.x && a.y === actor.y);
      const slot = sharing.findIndex((a) => a.id === actor.id);
      const x = Phaser.Math.Clamp(actor.x * 16 + 8 + (slot - (sharing.length - 1) / 2) * 16, 8, map.width * 16 - 8), y = actor.y * 16 + 8;
      if (!node) {
        const sprite = actor.sprite === "treasure"
          ? this.add.text(0, -1, "✦", { fontFamily: "monospace", fontSize: "12px", color: "#ffd84a" }).setOrigin(0.5)
          : actor.sprite === "zombie"
          ? this.add.sprite(0, -9, "zombie", actor.dead ? Z_DIE_LAST : 0).setScale(1.5)
          : actor.sprite === "slime"
          ? this.add.sprite(0, -9, "slime", actor.dead ? S_DIE_LAST : 0).setScale(1.5)
          : actor.sprite === "yeti"
          ? this.add.sprite(0, -9, "yeti", actor.dead ? Y_DIE_LAST : 0).setScale(1.5)
          : actor.sprite === "wolf"
          ? this.add.sprite(0, -9, "wolf", actor.dead ? W_DIE_LAST : 0).setScale(1.5)
          : actor.sprite === "orc"
          ? this.add.sprite(0, -9, "orc", actor.dead ? O_DIE_LAST : 0).setScale(1.5)
          : actor.sprite === "goblin"
          ? this.add.sprite(0, -9, "goblin", actor.dead ? O_DIE_LAST : 0).setScale(1.5)
          : actor.sprite === "cyclops"
          ? this.add.sprite(0, -9, "cyclops", actor.dead ? Y_DIE_LAST : 0).setScale(1.5)
          : actor.sprite === "human"
          ? this.add.sprite(0, -9, "human", actor.dead ? O_DIE_LAST : 0).setScale(1.5)
          : this.add.image(0, -2, "world-tiles", actor.frame);
        if (sprite instanceof Phaser.GameObjects.Sprite && !actor.dead && !reduced) sprite.play(actor.sprite === "human" ? "h-idle-0" : actor.sprite === "slime" ? "s-idle" : actor.sprite === "yeti" ? "y-idle-0" : actor.sprite === "wolf" ? "w-idle-0" : actor.sprite === "orc" ? "o-idle-0" : actor.sprite === "goblin" ? "g-idle-0" : actor.sprite === "cyclops" ? "c-idle-0" : "z-idle");
        const label = this.add.text(0, -18, actor.name, { fontFamily: "monospace", fontSize: "10px", color: getComputedStyle(document.documentElement).getPropertyValue("--world-label").trim(), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--world-label-bg").trim(), padding: { x: 4, y: 3 }, resolution: 3 }).setOrigin(0.5, 1).setVisible(false);
        node = this.add.container(x, y, [sprite, label, this.add.graphics()]);
        if (actor.frame === 12) sprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => window.dispatchEvent(new CustomEvent("bastion-select-mob", { detail: actor.id })));
        this.actors.set(actor.id, node);
        if (!reduced) this.tweens.add({ targets: sprite, alpha: { from: 0, to: 1 }, scale: animated(actor.sprite) ? { from: 1.3, to: 1.5 } : { from: 0.88, to: 1 }, duration: actor.frame === 12 ? 200 : 160, ease: "Linear" });
      } else {
        const sprite = node.list[0];
        if (sprite instanceof Phaser.GameObjects.Image && !actor.sprite) sprite.setFrame(actor.frame);
        const label = node.list[1];
        if (label instanceof Phaser.GameObjects.Text) label.setText(actor.name);
        this.tweens.killTweensOf(node);
        if (reduced) node.setPosition(x, y);
        else if (node.x !== x || node.y !== y) {
          this.tweens.add({ targets: node, x, y, duration: 180, ease: "Sine.easeOut" });
          if (sprite instanceof Phaser.GameObjects.Image) {
            this.tweens.killTweensOf(sprite);
            sprite.setY(-2).setScale(1).setAlpha(1);
            this.tweens.add({ targets: sprite, y: -4, duration: 80, yoyo: true, ease: "Linear" });
          }
        }
      }
      const label = node.list[1];
      if (label instanceof Phaser.GameObjects.Text) {
        const row = actors.filter((a) => a.y === actor.y && Math.abs(a.x - actor.x) < 12).findIndex((a) => a.id === actor.id);
        label.setVisible(true).setY(-18 - row * (label.height + 3));
        label.setX(Phaser.Math.Clamp(x, label.width / 2, map.width * 16 - label.width / 2) - x);
      }
      const bar = node.list[2];
      if (bar instanceof Phaser.GameObjects.Graphics) {
        bar.clear();
        // Health bar under every character and living mob.
        if (actor.hp !== undefined && actor.maxHp && !actor.dead) {
          const ratio = Phaser.Math.Clamp(actor.hp / actor.maxHp, 0, 1), w = 16, by = animated(actor.sprite) ? 3 : 7;
          bar.fillStyle(0x1b1b1b, 1).fillRect(-w / 2 - 1, by - 1, w + 2, 4);
          bar.fillStyle(ratio > 0.5 ? 0x4ade55 : ratio > 0.25 ? 0xffd84a : 0xff4d4d, 1).fillRect(-w / 2, by, Math.round(w * ratio), 2);
        }
      }
      node.setDepth(100 + y);
      if (animated(actor.sprite)) this.animateMonster(node, actor, reduced);
      else this.prev.set(actor.id, { x: actor.x, y: actor.y, ...(actor.hp !== undefined ? { hp: actor.hp } : {}), dir: 0 });
    }
    for (const id of [...this.prev.keys()]) if (!ids.has(id)) this.prev.delete(id);
    if (!hurt.length) return;
    // An adventurer lost HP: the adjacent living monster plays its attack toward them.
    for (const t of hurt) {
      const z = actors.find((a) => animated(a.sprite) && a.sprite !== "human" && !a.dead && Math.abs(a.x - t.x) <= 1 && Math.abs(a.y - t.y) <= 1);
      const zs = z && this.actors.get(z.id)?.list[0];
      if (!z || !(zs instanceof Phaser.GameObjects.Sprite)) continue;
      const dir = dirOf(t.x - z.x, t.y - z.y, this.prev.get(z.id)?.dir ?? 0);
      const st = this.prev.get(z.id); if (st) st.dir = dir;
      if (z.sprite === "slime") { if (reduced) zs.setFrame(S_COLS + 1); else zs.play("s-attack").chain("s-idle"); continue; }
      if (z.sprite === "yeti") { if (reduced) zs.setFrame((8 + dir) * Y_COLS + 1); else zs.play(`y-attack-${dir}`).chain(`y-idle-${dir}`); continue; }
      if (z.sprite === "wolf") { if (reduced) zs.setFrame((8 + dir) * W_COLS + 1); else zs.play(`w-attack-${dir}`).chain(`w-idle-${dir}`); continue; }
      if (z.sprite === "orc") { if (reduced) zs.setFrame((8 + dir) * O_COLS + 1); else zs.play(`o-attack-${dir}`).chain(`o-idle-${dir}`); continue; }
      if (z.sprite === "goblin") { if (reduced) zs.setFrame((8 + dir) * O_COLS + 1); else zs.play(`g-attack-${dir}`).chain(`g-idle-${dir}`); continue; }
      if (z.sprite === "cyclops") { if (reduced) zs.setFrame((8 + dir) * Y_COLS + 1); else zs.play(`c-attack-${dir}`).chain(`c-idle-${dir}`); continue; }
      if (reduced) zs.setFrame((5 + dir) * Z_COLS + 2); else zs.play(`z-attack-${dir}`).chain("z-idle");
    }
  }
  private animateMonster(node: Phaser.GameObjects.Container, actor: WorldActor, reduced: boolean) {
    const sprite = node.list[0];
    const label = node.list[1];
    const before = this.prev.get(actor.id);
    const dir = before ? dirOf(actor.x - before.x, actor.y - before.y, before.dir) : 0;
    this.prev.set(actor.id, { x: actor.x, y: actor.y, ...(actor.hp !== undefined ? { hp: actor.hp } : {}), ...(actor.dead ? { dead: true } : {}), dir });
    if (!(sprite instanceof Phaser.GameObjects.Sprite) || !before) return;
    const slime = actor.sprite === "slime", yeti = actor.sprite === "yeti", wolf = actor.sprite === "wolf", orc = actor.sprite === "orc", goblin = actor.sprite === "goblin", cyclops = actor.sprite === "cyclops" || sprite === "human";
    const idle = human ? `h-idle-${dir}` : slime ? "s-idle" : yeti ? `y-idle-${dir}` : wolf ? `w-idle-${dir}` : orc ? `o-idle-${dir}` : goblin ? `g-idle-${dir}` : cyclops ? `c-idle-${dir}` : "z-idle";
    if (actor.dead) {
      if (label instanceof Phaser.GameObjects.Text) label.setVisible(false);
      if (before.dead) return;
      if (reduced) sprite.stop().setFrame(slime ? S_DIE_LAST : yeti || cyclops ? Y_DIE_LAST : wolf ? W_DIE_LAST : orc || goblin || human ? O_DIE_LAST : Z_DIE_LAST); else sprite.play(human ? "h-die" : slime ? "s-die" : yeti ? "y-die" : wolf ? "w-die" : orc ? "o-die" : goblin ? "g-die" : cyclops ? "c-die" : "z-die");
      return;
    }
    if (reduced) { sprite.stop().setFrame(human ? dir * O_COLS : 0); return; }
    if (before.dead) { sprite.play(idle); return; }
    if (actor.hp !== undefined && before.hp !== undefined && actor.hp < before.hp) sprite.play(human ? `h-dmg-${dir}` : slime ? "s-dmg" : yeti ? `y-dmg-${dir}` : wolf ? `w-dmg-${dir}` : orc ? `o-dmg-${dir}` : goblin ? `g-dmg-${dir}` : cyclops ? `c-dmg-${dir}` : `z-dmg-${dir}`).chain(idle);
    else if (actor.x !== before.x || actor.y !== before.y) sprite.play(human ? `h-walk-${dir}` : slime ? "s-idle" : yeti ? `y-walk-${dir}` : wolf ? `w-walk-${dir}` : orc ? `o-walk-${dir}` : goblin ? `g-walk-${dir}` : cyclops ? `c-walk-${dir}` : `z-walk-${dir}`).chain(idle);
  }
}
export function createWorldGame(parent: HTMLDivElement, ready: () => void) {
  const game = new Phaser.Game({ type: Phaser.CANVAS, width: 400, height: 272, parent, pixelArt: true, antialias: false, roundPixels: true, transparent: true, banner: false, scene: WorldScene });
  game.events.once("world-ready", ready);
  return game;
}