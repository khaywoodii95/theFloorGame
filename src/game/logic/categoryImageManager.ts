import Phaser from "phaser";
import { CATEGORY_IMAGES } from "./categoryAssets";

export class CategoryImageManager {
  private scene: Phaser.Scene;
  private fade?: Phaser.GameObjects.Rectangle;
  private image?: Phaser.GameObjects.Image;
  private currentCategory: string | null = null;
  private used: Record<string, Set<string>> = {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  start(category: string) {
    this.currentCategory = category;
    const width = Number(this.scene.scale.width) || 600;
    const height = Number(this.scene.scale.height) || 600;
    if (!this.fade) {
      this.fade = this.scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.35)
        .setDepth(25);
    } else {
      this.fade.setPosition(width / 2, height / 2).setSize(width, height).setVisible(true);
    }
  }

  next() {
    if (!this.currentCategory) return;
    const list = CATEGORY_IMAGES[this.currentCategory] ?? [];
    if (!list.length) return;
    const used = this.used[this.currentCategory] ?? new Set<string>();
    if (!this.used[this.currentCategory]) {
      this.used[this.currentCategory] = used;
    }
    const remaining = list.filter((p) => !used.has(p));
    const pool = remaining.length ? remaining : list;
    const pick = Phaser.Utils.Array.GetRandom(pool);
    used.add(pick);
    this.placeImage(pick);
  }

  clear() {
    this.image?.destroy();
    this.image = undefined;
    this.currentCategory = null;
    if (this.fade) {
      this.fade.setVisible(false);
    }
  }

  private placeImage(key: string) {
    const place = () => {
      if (!this.scene.scene.isActive()) return;
      const width = Number(this.scene.scale.width) || 600;
      const height = Number(this.scene.scale.height) || 600;
      if (!this.image) {
        this.image = this.scene.add.image(width / 2, height * 0.42, key).setDepth(55);
      } else {
        this.image.setTexture(key).setVisible(true);
      }
      const tex = this.scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const maxW = width * 0.9;
      const maxH = height * 0.9;
      const scale = Math.min(maxW / tex.width, maxH / tex.height, 1);
      this.image.setDisplaySize(tex.width * scale, tex.height * scale);
    };

    if (!this.scene.textures.exists(key)) {
      this.scene.load.image(key, key);
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, place);
      this.scene.load.start();
    } else {
      place();
    }
  }

  private cleanup() {
    this.image?.destroy();
    this.fade?.destroy();
    this.image = undefined;
    this.fade = undefined;
    this.currentCategory = null;
    this.used = {};
  }
}
