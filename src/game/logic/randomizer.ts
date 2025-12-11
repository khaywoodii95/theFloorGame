import Phaser from "phaser";
import randomizerMusicUrl from "../../FloorMusic/TheFloorRandomizerMusic.mp3?url";

type GetRect = (key: string) => Phaser.GameObjects.Rectangle | null;

export interface RandomizerOptions {
  tileSize: number;
  getTileRect: GetRect;
  onSelect: (tileKey: string) => void;
  scrollLeadMs?: number;
}

export class RandomizerController {
  private scene: Phaser.Scene;
  private options: RandomizerOptions;
  private cursor?: Phaser.GameObjects.Rectangle;
  private timer?: Phaser.Time.TimerEvent;
  private keys: string[] = [];
  private index = 0;
  private endTime = 0;
  private finalKey: string | null = null;
  private startTime = 0;
  private audio?: HTMLAudioElement;
  private audioDurationMs = 9000;
  private scrollLeadMs: number;

  constructor(scene: Phaser.Scene, options: RandomizerOptions) {
    this.scene = scene;
    this.options = options;
    this.scrollLeadMs = options.scrollLeadMs ?? 2500;
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  start(keys: string[], finalKey: string) {
    if (!keys.length || this.isRunning()) return;
    this.keys = keys;
    this.index = 0;
    this.finalKey = finalKey;
    this.startTime = this.scene.time.now;
    this.endTime = this.startTime + this.playAudio();

    if (!this.cursor) {
      this.cursor = this.scene.add
        .rectangle(0, 0, this.options.tileSize - 6, this.options.tileSize - 6)
        .setStrokeStyle(3, 0xff4d4f)
        .setFillStyle(0xffffff, 0)
        .setDepth(20)
        .setVisible(false);
    }

    this.timer = this.scene.time.addEvent({
      delay: 70,
      loop: true,
      callback: () => this.step(),
    });
  }

  stop() {
    if (this.timer) {
      this.timer.remove(false);
      this.timer = undefined;
    }
    this.keys = [];
    this.index = 0;
    this.startTime = 0;
    this.endTime = 0;
    this.finalKey = null;
    this.cursor?.setVisible(false);
  }

  isRunning(): boolean {
    return !!this.timer;
  }

  stopAudio() {
    if (!this.audio) return;
    try {
      this.audio.pause();
      this.audio.currentTime = 0;
    } catch {
      // ignore
    }
  }

  private step() {
    if (!this.timer || !this.finalKey || !this.keys.length) return;
    const now = this.scene.time.now;
    this.index = (this.index + 1) % this.keys.length;
    const currentKey = this.keys[this.index];
    this.positionCursor(currentKey);
    if (now >= this.endTime) {
      this.stop();
      this.positionCursor(this.finalKey);
      this.options.onSelect(this.finalKey);
    }
  }

  private positionCursor(tileKey: string) {
    const rect = this.options.getTileRect(tileKey);
    if (!rect || !this.cursor) return;
    this.cursor.setVisible(true).setPosition(rect.x, rect.y);
  }

  private playAudio(): number {
    const audio = this.ensureAudio();
    const runDuration = Math.max(1500, this.audioDurationMs - this.scrollLeadMs);
    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {
      // ignore
    }
    return runDuration;
  }

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const audio = new Audio(randomizerMusicUrl);
    audio.addEventListener("loadedmetadata", () => {
      if (!isNaN(audio.duration) && audio.duration > 0) {
        this.audioDurationMs = audio.duration * 1000;
        if (this.isRunning()) {
          this.endTime = this.startTime + Math.max(1500, this.audioDurationMs - this.scrollLeadMs);
        }
      }
    });
    audio.addEventListener("ended", () => {
      audio.currentTime = 0;
    });
    this.audio = audio;
    return audio;
  }

  private teardown() {
    this.stop();
    this.stopAudio();
  }
}
