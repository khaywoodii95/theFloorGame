import Phaser from "phaser";
import type { PlayerState, TileData } from "../types";

type OverlayOptions = {
  winnerId: number;
  players: Map<number, PlayerState>;
  tiles: Map<string, TileData>;
  gridSize: number;
  onCategorySelected: (category: string) => void;
  onStartRound: (category: string) => void;
  onGoBack: () => void;
  hintLabel?: (message: string) => void;
  strokeColor: number;
};

export class CategoryOverlay {
  private container?: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private selectedCategory: string | null = null;
  private startButton?: Phaser.GameObjects.Rectangle;
  private startButtonText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(options: OverlayOptions) {
    this.hide();
    const { winnerId, players, tiles, gridSize, onCategorySelected, onGoBack, hintLabel, strokeColor } =
      options;
    const winner = players.get(winnerId);
    if (!winner) return;
    this.selectedCategory = null;

    const width = Number(this.scene.scale.width) || 600;
    const container = this.scene.add.container(width / 2, (Number(this.scene.scale.height) || 600) - 210);
    this.startButton = undefined;
    this.startButtonText = undefined;
    const bg = this.scene.add
      .rectangle(0, 0, width - 24, 170, 0x0b0b0f, 0.9)
      .setStrokeStyle(2, strokeColor);
    container.add(bg);

    const header = this.scene.add
      .text(
        0,
        -65,
        `${winner.name} won! Pick a bordering enemy category or go back to the floor.`,
        {
          fontSize: "15px",
          color: "#fff",
          align: "center",
          wordWrap: { width: width - 80 },
        }
      )
      .setOrigin(0.5);
    container.add(header);

    const categories = Array.from(this.collectBorderCategories(winnerId, players, tiles, gridSize)).filter(
      (cat) => cat !== winner.category
    );
    if (categories.length === 0) {
      hintLabel?.("No bordering categories to claim. Use Go back to the floor.");
    }

    const buttonWidth = 150;
    const buttonHeight = 32;
    const startX =
      categories.length > 0 ? (-Math.min(2, categories.length - 1) * (buttonWidth + 12)) / 2 : 0;
    categories.forEach((cat, idx) => {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const x = startX + col * (buttonWidth + 12);
      const y = -20 + row * (buttonHeight + 10);

      const btn = this.scene.add
        .rectangle(x, y, buttonWidth, buttonHeight, 0x1555e0, 0.95)
        .setStrokeStyle(2, strokeColor)
        .setInteractive();
      const label = this.scene.add
        .text(x, y, cat, { fontSize: "13px", color: "#fff", fontStyle: "bold" })
        .setOrigin(0.5);
      btn.on("pointerdown", () => {
        this.selectedCategory = cat;
        onCategorySelected(cat);
        this.enableStart(true);
      });
      container.add(btn);
      container.add(label);
    });

    const startBtn = this.scene.add
      .rectangle(-110, 55, 200, 34, 0x1555e0, 0.95)
      .setStrokeStyle(2, strokeColor)
      .setInteractive();
    const startText = this.scene.add
      .text(-110, 55, "Start Battle", { fontSize: "14px", color: "#fff", fontStyle: "bold" })
      .setOrigin(0.5);
    startBtn.on("pointerdown", () => {
      if (this.selectedCategory) {
        options.onStartRound(this.selectedCategory);
      }
    });
    this.startButton = startBtn;
    this.startButtonText = startText;
    this.enableStart(false);

    const goBackBtn = this.scene.add
      .rectangle(110, 55, 200, 34, 0x28a745, 0.95)
      .setStrokeStyle(2, strokeColor)
      .setInteractive();
    const goBackText = this.scene.add
      .text(110, 55, "Go back to the floor", { fontSize: "14px", color: "#0b0b0f", fontStyle: "bold" })
      .setOrigin(0.5);
    goBackBtn.on("pointerdown", onGoBack);
    container.add(startBtn);
    container.add(startText);
    container.add(goBackBtn);
    container.add(goBackText);

    this.container = container;
  }

  hide() {
    if (this.container) {
      this.container.destroy(true);
      this.container = undefined;
    }
  }

  private enableStart(enabled: boolean) {
    if (!this.startButton || !this.startButtonText) return;
    if (enabled) {
      this.startButton.setAlpha(1).setInteractive();
      this.startButtonText.setAlpha(1);
    } else {
      this.startButton.setAlpha(0.4).disableInteractive();
      this.startButtonText.setAlpha(0.6);
    }
  }

  private collectBorderCategories(
    winnerId: number,
    players: Map<number, PlayerState>,
    tiles: Map<string, TileData>,
    gridSize: number
  ): Set<string> {
    const categories = new Set<string>();
    const winner = players.get(winnerId);
    if (!winner) return categories;
    winner.tiles.forEach((key) => {
      const tile = tiles.get(key);
      if (!tile) return;
      this.getNeighborKeys(tile.row, tile.col, gridSize).forEach((neighborKey) => {
        const neighbor = tiles.get(neighborKey);
        if (!neighbor || neighbor.ownerId === winnerId || neighbor.ownerId === null) return;
        const owner = players.get(neighbor.ownerId);
        if (owner?.alive) {
          categories.add(owner.category);
        }
      });
    });
    return categories;
  }

  private getNeighborKeys(row: number, col: number, gridSize: number): string[] {
    const offsets = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const keys: string[] = [];
    offsets.forEach(([dr, dc]) => {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
        keys.push(`${r}-${c}`);
      }
    });
    return keys;
  }
}
