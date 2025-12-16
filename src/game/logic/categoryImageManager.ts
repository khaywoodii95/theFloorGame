import Phaser from "phaser";
import { CATEGORY_IMAGES } from "./categoryAssets";

export class CategoryImageManager {
  private scene: Phaser.Scene;
  private fade?: Phaser.GameObjects.Rectangle;
  private image?: Phaser.GameObjects.Image;
  private nameText?: Phaser.GameObjects.Text;
  private nameTimer?: Phaser.Time.TimerEvent;
  private currentCategory: string | null = null;
  private currentName: string | null = null;
  private previousName: string | null = null;
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
    if (!this.nameText) {
      this.nameText = this.scene.add
        .text(width / 2, height * 0.68, '', { fontSize: '32px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 })
        .setOrigin(0.5)
        .setDepth(70);
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
    this.previousName = this.currentName;
    this.currentName = this.getNameFromPath(pick);
    this.placeImage(pick);
  }

  clear() {
    this.image?.destroy();
    this.image = undefined;
    this.nameText?.destroy();
    this.nameText = undefined;
    if (this.nameTimer) {
      this.nameTimer.destroy();
      this.nameTimer = undefined;
    }
    this.currentCategory = null;
    this.currentName = null;
    this.previousName = null;
    if (this.fade) {
      this.fade.setVisible(false);
    }
  }

  showPreviousName(duration: number, callback?: () => void) {
    if (this.previousName && this.nameText) {
      this.showName(this.previousName, duration, callback);
    }
  }

  showCurrentName(duration: number, callback?: () => void) {
    if (this.currentName && this.nameText) {
      this.showName(this.currentName, duration, callback);
    }
  }

  private showName(name: string, duration: number, callback?: () => void) {
    if (this.nameTimer) {
      this.nameTimer.destroy();
    }
    this.nameText?.setText(name);
    this.nameTimer = this.scene.time.delayedCall(duration, () => {
      this.nameText?.setText('');
      this.nameTimer = undefined;
      callback?.();
    });
  }

  private getNameFromPath(path: string): string {
    // Extract file name without extension
    const parts = path.split('/');
    const file = parts[parts.length - 1];
    const dotIndex = file.lastIndexOf('.');
    return dotIndex > 0 ? file.substring(0, dotIndex) : file;
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
    this.nameText?.destroy();
    if (this.nameTimer) {
      this.nameTimer.destroy();
    }
    this.image = undefined;
    this.fade = undefined;
    this.nameText = undefined;
    this.nameTimer = undefined;
    this.currentCategory = null;
    this.currentName = null;
    this.previousName = null;
    this.used = {};
  }
}
