import Phaser from "phaser";
import { CATEGORY_NAMES } from "../logic/categoryAssets";
import { BattleSeriesManager } from "../logic/battleSeriesManager";
import { CategoryOverlay } from "../logic/categoryOverlay";
import { RandomizerController } from "../logic/randomizer";
import { CategoryImageManager } from "../logic/categoryImageManager";
import { BattleController, type BattleResult } from "../logic/battleController";
import type { Mode, PlayerState, TileData } from "../types";

const DEFAULT_GRID_SIZE = 3;
const MAX_TIMER = 25;
const TILE_BORDER = 0xffc542;
const TILE_STROKE_WIDTH = 1;
const COLORS = [
  0x1555e0,
  0xffc542,
  0x2ad4ff,
  0xff6b81,
  0x7dff6b,
  0xf28bff,
  0x4ae3b5,
  0xff9f1c,
  0x00c2a8,
  0xff2f92,
];
const CATEGORIES = CATEGORY_NAMES;

export class FloorGameScene extends Phaser.Scene {
  private gridSize: number = DEFAULT_GRID_SIZE;
  private tileSize: number = 60;
  private mode: Mode = "idle";
  private tiles: Map<string, TileData> = new Map();
  private players: Map<number, PlayerState> = new Map();
  private selectedTileKey: string | null = null;
  private neighborTargets: Set<string> = new Set();
  private pendingBattle: { attackerTile: string; defenderTile: string } | null = null;
  private battleSeriesManager = new BattleSeriesManager((exclude?: string[]) =>
    this.pickCategory(exclude)
  );
  private pendingDirectBattle: { attackerTile: string; defenderTile: string; category: string } | null = null;
  private categoryOverlay!: CategoryOverlay;
  private statusText!: Phaser.GameObjects.Text;
  private actionHint!: Phaser.GameObjects.Text;
  private randomButton?: Phaser.GameObjects.Rectangle;
  private startButton?: Phaser.GameObjects.Rectangle;
  private startButtonEnabled = false;
  private resetButton?: Phaser.GameObjects.Rectangle;
  private resetButtonLabel?: Phaser.GameObjects.Text;
  private startButtonLabel?: Phaser.GameObjects.Text;
  private randomButtonLabel?: Phaser.GameObjects.Text;
  private nextForcedCategory: string | null = null;
  private randomCursor?: Phaser.GameObjects.Rectangle;
  private categoryPool: string[] = [];
  private categoryImages!: CategoryImageManager;
  private keyHandler?: (event: KeyboardEvent) => void;
  private externalStartHandler?: () => void;
  private externalRandomHandler?: () => void;
  private stopAudioHandler?: () => void;
  private randomizer?: RandomizerController;
  private battleController!: BattleController;

  constructor() {
    super("FloorGameScene");
  }

  init(data?: { gridSize?: number }) {
    const requested = Number(data?.gridSize);
    if (Number.isInteger(requested)) {
      this.gridSize = Math.max(2, Math.min(10, requested));
    } else {
      this.gridSize = DEFAULT_GRID_SIZE;
    }
  }

  create() {
    this.mode = "idle";
    this.tiles.clear();
    this.players.clear();
    this.neighborTargets.clear();
    this.selectedTileKey = null;
    this.pendingBattle = null;
    this.pendingDirectBattle = null;
    this.startButtonEnabled = false;
    this.battleSeriesManager.reset();
    this.hideResetButton();
    this.nextForcedCategory = null;
    this.categoryOverlay = new CategoryOverlay(this);
    this.randomCursor?.destroy();
    this.randomCursor = undefined;
    this.updateBattleCategory(null);
    this.unregisterExternalControls();
    this.categoryPool = this.shuffleCategories();
    this.stopRandomizerAudio();
    this.registerExternalControls();
    this.registerStopAudioListener();
    this.bindHotkeys();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopRandomizerAudio());

    const gameWidth = Number(this.scale.width) || 600;
    this.tileSize = gameWidth / this.gridSize;

    this.randomizer = new RandomizerController(this, {
      tileSize: this.tileSize,
      getTileRect: (key) => this.tiles.get(key)?.rect ?? null,
      onSelect: (tileKey) => this.completeRandomSelection(tileKey),
      scrollLeadMs: 2500,
    });
    this.categoryImages = new CategoryImageManager(this);
    this.battleController = new BattleController(this, {
      maxTimer: MAX_TIMER,
      tileBorder: TILE_BORDER,
      categoryImages: this.categoryImages,
      getPlayer: (id) => this.players.get(id),
      onStatus: (title, hint) => this.setStatus(title, hint),
      onActionHint: (text) => this.actionHint.setText(text),
      onCategoryChange: (category) => this.updateBattleCategory(category),
      onBattleComplete: (result) => this.handleBattleOutcome(result),
      playTone: (freq, dur, vol, delay) => this.playTone(freq, dur, vol, delay),
    });

    this.createBoard();
    this.createHud();
    this.updateBattleCategory(null);
    this.setStatus("Click the Randomizer button to pick a challenger.", "Ready");
  }

  private createBoard() {
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const x = col * this.tileSize + this.tileSize / 2;
        const y = row * this.tileSize + this.tileSize / 2;
        const key = this.keyFor(row, col);
        const playerId = row * this.gridSize + col;

        const rect = this.add
          .rectangle(x, y, this.tileSize - 2, this.tileSize - 2, COLORS[playerId % COLORS.length])
          .setStrokeStyle(TILE_STROKE_WIDTH, TILE_BORDER)
          .setInteractive();

        rect.on("pointerdown", () => this.handleTileClick(key));

        const fontSize = Math.max(10, Math.min(18, Math.floor(this.tileSize * 0.22)));
        const category = this.getCategoryForIndex(playerId);
        const wrapped = this.tileLabelText(playerId, category, fontSize);
        const label = this.add.text(x, y, wrapped.text, wrapped.style).setOrigin(0.5);

        this.players.set(playerId, {
          id: playerId,
          name: `Player ${playerId + 1}`,
          color: COLORS[playerId % COLORS.length],
          category,
          alive: true,
          tiles: new Set([key]),
          hasBattled: false,
        });

        this.tiles.set(key, {
          key,
          row,
          col,
          rect,
          label,
          ownerId: playerId,
          hasBattled: false,
        });
      }
    }
  }

  private createHud() {
    this.statusText = this.add
      .text(-1000, -1000, "", { fontSize: "16px", color: "#fff", fontStyle: "bold" })
      .setVisible(false);

    this.actionHint = this.add
      .text(-1000, -1000, "", { fontSize: "14px", color: "#ffc542" })
      .setVisible(false);

    const buttonWidth = 180;
    const buttonHeight = 38;
    const centerX = (Number(this.scale.width) || 600) / 2;
    const y = (Number(this.scale.height) || 600) - 24;

    this.startButton = this.add
      .rectangle(centerX - 110, y, buttonWidth, buttonHeight, 0x28a745, 0.9)
      .setStrokeStyle(2, TILE_BORDER)
      .setInteractive();
    this.startButtonLabel = this.add
      .text(centerX - 110, y, "Start Battle", { fontSize: "16px", color: "#0b0b0f", fontStyle: "bold" })
      .setOrigin(0.5);

    this.randomButton = this.add
      .rectangle(centerX + 110, y, buttonWidth, buttonHeight, 0x1555e0, 0.9)
      .setStrokeStyle(2, TILE_BORDER)
      .setInteractive();
    this.randomButtonLabel = this.add
      .text(centerX + 110, y, "Random Battle", { fontSize: "16px", color: "#fff", fontStyle: "bold" })
      .setOrigin(0.5);

    this.randomButton.on("pointerdown", () => {
      if (this.mode === "idle" || this.mode === "finalReady") {
        this.startRandomBattle();
      }
    });

    this.startButton.on("pointerdown", () => {
      if (this.mode === "chooseTarget" && this.startButtonEnabled) {
        this.startPendingBattle();
      } else if (this.mode === "finalReady" && this.pendingDirectBattle) {
        const atk = this.tiles.get(this.pendingDirectBattle.attackerTile);
        const def = this.tiles.get(this.pendingDirectBattle.defenderTile);
        this.nextForcedCategory = this.pendingDirectBattle.category;
        this.pendingDirectBattle = null;
        if (atk && def) {
          this.beginBattle(atk, def);
        }
      }
    });

    this.setStartButtonEnabled(false);
    // hide in-canvas controls; external UI will trigger these actions
    this.startButton.setVisible(false).disableInteractive().setAlpha(0);
    this.randomButton.setVisible(false).disableInteractive().setAlpha(0);
    this.startButtonLabel?.setVisible(false);
    this.randomButtonLabel?.setVisible(false);

    // Reset button (shown when gameover)
    this.resetButton = this.add
      .rectangle(centerX, y - 48, buttonWidth, buttonHeight, 0xff4d4f, 0.9)
      .setStrokeStyle(2, TILE_BORDER)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });
    this.resetButtonLabel = this.add
      .text(centerX, y - 48, "Reset Game", { fontSize: "16px", color: "#fff", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(50);
    this.resetButton.on("pointerdown", () => {
      window.dispatchEvent(
        new CustomEvent("phaserResetRequested", { detail: { gridSize: this.gridSize } })
      );
    });
    this.hideResetButton();
  }

  private handleTileClick(tileKey: string) {
    if (this.mode !== "chooseTarget") return;
    if (!this.neighborTargets.has(tileKey) || !this.selectedTileKey) return;

    this.pendingBattle = { attackerTile: this.selectedTileKey, defenderTile: tileKey };
    this.setStartButtonEnabled(true);

    // re-highlight so the chosen defender is emphasized
    this.clearHighlights();
    this.highlightSelection(this.selectedTileKey);
    this.neighborTargets.forEach((t) => this.highlightNeighbor(t));
    this.highlightPendingDefender(tileKey);

    const attacker = this.tiles.get(this.selectedTileKey)?.ownerId ?? null;
    const defender = this.tiles.get(tileKey)?.ownerId ?? null;
    const attackerPlayer = attacker != null ? this.players.get(attacker) : null;
    const defenderPlayer = defender != null ? this.players.get(defender) : null;
    this.setStatus(
      `${attackerPlayer?.name ?? "Challenger"} locked on ${defenderPlayer?.name ?? "Defender"}.`,
      "Press Start Battle. Challenger’s clock starts first; defender waits until challenger answers correctly."
    );
  }

  private startRandomBattle() {
    if (this.battleController?.isActive() || this.mode === "chooseCategory" || this.randomizer?.isRunning())
      return;

    const aliveIds = this.getAlivePlayerIds();
    this.battleSeriesManager.ensureSeries(aliveIds);
    if (aliveIds.length === 2 && this.battleSeriesManager.isActive()) {
      this.prepareLastTwoRound();
      return;
    }

    const finalKey = this.pickRandomCandidateKey();
    if (!finalKey) {
      this.setStatus("No available tiles with neighbors to battle.", "Add more players or reset.");
      return;
    }

    const candidateKeys = this.findBattleCandidates();
    this.randomizer?.start(candidateKeys, finalKey);
  }

  private findBattleCandidates(): string[] {
    const alivePlayers = Array.from(this.players.values()).filter((p) => p.alive);
    const unbattledPlayers = alivePlayers.filter((p) => !p.hasBattled);
    const pools = unbattledPlayers.length > 0 ? unbattledPlayers : alivePlayers;

    const candidates: string[] = [];
    pools.forEach((player) => {
      player.tiles.forEach((key) => {
        const tile = this.tiles.get(key);
        if (!tile || tile.ownerId === null) return;
        if (this.getEnemyNeighborKeys(tile.key).length > 0) {
          candidates.push(tile.key);
        }
      });
    });
    return candidates;
  }

  private pickRandomCandidateKey(): string | null {
    const candidates = this.findBattleCandidates();
    const validKeys = candidates.filter((key) => {
      const tile = this.tiles.get(key);
      if (!tile || tile.ownerId === null) return false;
      const owner = this.players.get(tile.ownerId);
      return !!owner?.alive;
    });
    if (!validKeys.length) return null;
    return Phaser.Utils.Array.GetRandom(validKeys);
  }

  private startPendingBattle() {
    if (!this.pendingBattle) return;
    const attackerTile = this.tiles.get(this.pendingBattle.attackerTile);
    const defenderTile = this.tiles.get(this.pendingBattle.defenderTile);
    if (!attackerTile || !defenderTile) return;
    if (attackerTile.ownerId === null || defenderTile.ownerId === null) return;
    this.beginBattle(attackerTile, defenderTile);
  }

  private completeRandomSelection(key: string): void {
    const tile = this.tiles.get(key);
    const owner = tile?.ownerId != null ? this.players.get(tile.ownerId) : null;
    if (!tile || !owner || !owner.alive) {
      // fallback: attempt a fresh random pick
      const retryKey = this.pickRandomCandidateKey();
      if (retryKey && retryKey !== key) {
        return this.completeRandomSelection(retryKey);
      }
      this.setStatus("No valid challenger found.", "Try Random Battle again.");
      return;
    }

    this.selectedTileKey = key;
    this.mode = "chooseTarget";
    this.highlightSelection(key);
    this.pendingBattle = null;
    this.setStartButtonEnabled(false);
    this.setStatus(
      `${owner.name} is up!`,
      `Click an adjacent enemy tile to challenge. Category will use defender's (${owner.category}) or challenger’s choice.`
    );

    const targets = key ? this.getEnemyNeighborKeys(key) : [];
    this.neighborTargets = new Set(targets);
    targets.forEach((t) => this.highlightNeighbor(t));
  }

  private findBattlePairForCategory(
    winnerId: number,
    category: string
  ): { attackerTile: string; defenderTile: string } | null {
    const winner = this.players.get(winnerId);
    if (!winner) return null;

    for (const atkKey of winner.tiles) {
      const atkTile = this.tiles.get(atkKey);
      if (!atkTile) continue;
      const neighbors = this.getNeighborKeys(atkTile.row, atkTile.col);
      for (const nKey of neighbors) {
        const neighbor = this.tiles.get(nKey);
        if (!neighbor || neighbor.ownerId === null || neighbor.ownerId === winnerId) continue;
        const owner = this.players.get(neighbor.ownerId);
        if (owner?.alive && owner.category === category) {
          return { attackerTile: atkKey, defenderTile: nKey };
        }
      }
    }
    return null;
  }

  private beginBattle(attackerTile: TileData, defenderTile: TileData) {
    const attacker = attackerTile.ownerId != null ? this.players.get(attackerTile.ownerId) : null;
    const defender = defenderTile.ownerId != null ? this.players.get(defenderTile.ownerId) : null;
    if (!attacker || !defender) return;

    this.randomizer?.stop();

    const aliveIds = this.getAlivePlayerIds();
    this.battleSeriesManager.ensureSeries(aliveIds);

    this.mode = "battle";
    this.clearHighlights();
    this.neighborTargets.clear();
    this.pendingBattle = null;
    this.setStartButtonEnabled(false);

    attackerTile.hasBattled = true;
    defenderTile.hasBattled = true;
    attacker.hasBattled = true;
    defender.hasBattled = true;

    const roundCategory = this.nextForcedCategory ?? defender.category;
    this.nextForcedCategory = null;

    this.battleController.startBattle(attackerTile, defenderTile, roundCategory);
  }

  private transferTiles(fromPlayerId: number, toPlayerId: number) {
    this.tiles.forEach((tile) => {
      if (tile.ownerId !== fromPlayerId) return;
      tile.ownerId = toPlayerId;
      tile.rect.setFillStyle(this.players.get(toPlayerId)?.color ?? 0x444444);
      const wrapped = this.tileLabelText(
        toPlayerId,
        this.players.get(toPlayerId)?.category ?? "Category"
      );
      tile.label.setText(wrapped.text).setStyle(wrapped.style);

      const fromPlayer = this.players.get(fromPlayerId);
      const toPlayer = this.players.get(toPlayerId);
      fromPlayer?.tiles.delete(tile.key);
      toPlayer?.tiles.add(tile.key);
    });
  }

  private refreshLabelsForPlayer(playerId: number) {
    const player = this.players.get(playerId);
    if (!player) return;
    const wrapped = this.tileLabelText(playerId, player.category);
    player.tiles.forEach((key) => {
      const tile = this.tiles.get(key);
      if (tile) {
        tile.label.setText(wrapped.text).setStyle(wrapped.style);
      }
    });
  }

  private handleBattleOutcome(result: BattleResult) {
    // ensure any active battle visuals are cleared
    this.categoryImages.clear();
    this.selectedTileKey = null;
    this.updateBattleCategory(null);
    this.mode = "chooseCategory";

    const winner = this.players.get(result.winnerId);
    const loser = this.players.get(result.loserId);
    if (!winner || !loser) return;

    const aliveIds = this.getAlivePlayerIds();
    const isLastTwoActive = this.battleSeriesManager.isActive() && aliveIds.length === 2;
    if (isLastTwoActive) {
      const seriesResult = this.battleSeriesManager.handleResult(winner, loser);
      if (seriesResult?.championId !== undefined && seriesResult.defeatedId !== undefined) {
        const champion = this.players.get(seriesResult.championId);
        const defeated = this.players.get(seriesResult.defeatedId);
        if (champion && defeated) {
          defeated.alive = false;
          this.transferTiles(defeated.id, champion.id);
          this.mode = "gameover";
          this.setStatus(seriesResult.status, seriesResult.hint);
          this.showResetButton();
          this.updateBattleCategory(null);
          return;
        }
      }

      if (seriesResult) {
        this.mode = "idle";
        this.setStatus(seriesResult.status, seriesResult.hint);
        this.updateBattleCategory(null);
        return;
      }
    }

    loser.alive = false;
    this.transferTiles(loser.id, winner.id);

    const winnerIsChallenger = result.winnerWasAttacker;
    if (!winnerIsChallenger) {
      // Defender inherits the challenger's category when the challenger is defeated
      winner.category = loser.category;
      this.refreshLabelsForPlayer(winner.id);
    }

    const remaining = Array.from(this.players.values()).filter((p) => p.alive);
    if (remaining.length === 1) {
      this.mode = "gameover";
      this.setStatus(`${winner.name} wins the floor!`, "Reset the scene to play again.");
      this.showResetButton();
      this.battleSeriesManager.reset();
      this.updateBattleCategory(null);
    } else if (remaining.length === 2) {
      this.battleSeriesManager.ensureSeries(remaining.map((p) => p.id));
      this.mode = "idle";
      this.setStatus(
        `${winner.name} wins and eliminates ${loser.name}. Best-of-3 begins for the final two.`,
        "Next battle uses the defender's category."
      );
      this.updateBattleCategory(null);
    } else {
      this.presentCategoryChoice(winner.id);
    }
  }

  private setStatus(title: string, hint?: string) {
    this.statusText.setText(title);
    this.actionHint.setText(hint ?? "");
    window.dispatchEvent(new CustomEvent("gameStatusChanged", { detail: { title, hint: hint ?? "" } }));
  }

  private highlightSelection(tileKey: string) {
    const tile = this.tiles.get(tileKey);
    if (!tile) return;
    tile.rect.setStrokeStyle(4, TILE_BORDER);
    tile.rect.setAlpha(1);
  }

  private highlightNeighbor(tileKey: string) {
    const tile = this.tiles.get(tileKey);
    if (!tile) return;
    tile.rect.setStrokeStyle(3, 0xff4d4f);
    tile.rect.setAlpha(0.9);
  }

  private clearHighlights() {
    this.tiles.forEach((tile) => {
      tile.rect.setStrokeStyle(TILE_STROKE_WIDTH, TILE_BORDER);
      tile.rect.setAlpha(1);
    });
  }

  private highlightPendingDefender(tileKey: string) {
    const tile = this.tiles.get(tileKey);
    if (!tile) return;
    tile.rect.setStrokeStyle(4, 0xff4d4f);
    tile.rect.setAlpha(1);
  }

  private getEnemyNeighborKeys(tileKey: string): string[] {
    const tile = this.tiles.get(tileKey);
    if (!tile || tile.ownerId === null) return [];
    const neighbors = this.getNeighborKeys(tile.row, tile.col);
    return neighbors.filter((key) => {
      const neighbor = this.tiles.get(key);
      if (!neighbor || neighbor.ownerId === null) return false;
      if (neighbor.ownerId === tile.ownerId) return false;
      const owner = this.players.get(neighbor.ownerId);
      return !!owner?.alive;
    });
  }

  private getNeighborKeys(row: number, col: number): string[] {
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
      if (r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize) {
        keys.push(this.keyFor(r, c));
      }
    });
    return keys;
  }

  private keyFor(row: number, col: number) {
    return `${row}-${col}`;
  }

  private tileLabelText(playerId: number, category: string, fontSize = 14) {
    const maxWidth = this.tileSize - 8;
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: `${fontSize}px`,
      color: "#f4f7ff",
      align: "center",
      fontStyle: "bold",
      wordWrap: { width: maxWidth },
      lineSpacing: -2,
    };
    const lines = [`P${playerId + 1}`, category];
    return { text: lines.join("\n"), style };
  }

  private presentCategoryChoice(winnerId: number) {
    this.categoryOverlay.show({
      winnerId,
      players: this.players,
      tiles: this.tiles,
      gridSize: this.gridSize,
      strokeColor: TILE_BORDER,
      onCategorySelected: (cat) => {
        const winner = this.players.get(winnerId);
        if (!winner) return;
        this.setStatus(
          `${winner.name} selected "${cat}".`,
          "Press Start Battle to continue or go back to the floor."
        );
      },
      onStartRound: (cat) => {
        const winner = this.players.get(winnerId);
        if (!winner || !cat) return;
        const pair = this.findBattlePairForCategory(winnerId, cat);
        if (!pair) {
          this.setStatus("No adjacent tile with that category.", "Pick another category or go back to the floor.");
          return;
        }
        this.nextForcedCategory = cat;
        this.categoryOverlay.hide();
        this.mode = "idle";
        const attackerTile = this.tiles.get(pair.attackerTile);
        const defenderTile = this.tiles.get(pair.defenderTile);
        if (attackerTile && defenderTile) {
          this.beginBattle(attackerTile, defenderTile);
        } else {
          this.setStatus("Battle could not start.", "Pick another category or go back to the floor.");
        }
      },
      onGoBack: () => {
        this.categoryOverlay.hide();
        this.mode = "idle";
        this.setStatus("Pick a new challenger.", "Click Random Battle to select another player.");
      },
      hintLabel: (message) => this.actionHint.setText(message),
    });
  }

  private setStartButtonEnabled(enabled: boolean) {
    this.startButtonEnabled = enabled;
    if (this.startButton) {
      if (enabled) {
        this.startButton.setAlpha(1).setInteractive();
      } else {
        this.startButton.setAlpha(0.35).disableInteractive();
      }
    }
    window.dispatchEvent(new CustomEvent("phaserStartButtonState", { detail: { enabled } }));
  }

  private showResetButton() {
    this.resetButton?.setVisible(true).setInteractive({ useHandCursor: true }).setAlpha(1);
    this.resetButtonLabel?.setVisible(true);
  }

  private hideResetButton() {
    this.resetButton?.setVisible(false).disableInteractive().setAlpha(0);
    this.resetButtonLabel?.setVisible(false);
  }

  private getAlivePlayerIds(): number[] {
    return Array.from(this.players.values())
      .filter((p) => p.alive)
      .map((p) => p.id);
  }

  private updateBattleCategory(category: string | null) {
    window.dispatchEvent(new CustomEvent("battleCategoryChanged", { detail: { category } }));
  }

  private findAdjacentTilePair(
    attackerId: number,
    defenderId: number
  ): { attackerTile: string; defenderTile: string } | null {
    const attacker = this.players.get(attackerId);
    if (!attacker) return null;
    for (const atkKey of attacker.tiles) {
      const atkTile = this.tiles.get(atkKey);
      if (!atkTile) continue;
      const neighbors = this.getNeighborKeys(atkTile.row, atkTile.col);
      for (const nKey of neighbors) {
        const neighbor = this.tiles.get(nKey);
        if (neighbor?.ownerId === defenderId) {
          return { attackerTile: atkKey, defenderTile: nKey };
        }
      }
    }
    return null;
  }

  private prepareLastTwoRound() {
    const aliveIds = this.getAlivePlayerIds();
    this.battleSeriesManager.ensureSeries(aliveIds);
    const plan = this.battleSeriesManager.getNextRoundPlan(this.players);
    if (!plan) {
      this.setStatus("Could not start final series round.", "Try again.");
      return;
    }
    const pair = this.findAdjacentTilePair(plan.attackerId, plan.defenderId);
    if (!pair) {
      this.setStatus("No adjacent tiles for the finalists.", "Try again or reset.");
      return;
    }

    this.pendingDirectBattle = {
      attackerTile: pair.attackerTile,
      defenderTile: pair.defenderTile,
      category: plan.category,
    };
    this.mode = "finalReady";
    this.setStartButtonEnabled(true);
    const attacker = this.players.get(plan.attackerId);
    const defender = this.players.get(plan.defenderId);
    const categoryLabel = plan.category;
    const attackerName = attacker?.name ?? "Challenger";
    const defenderName = defender?.name ?? "Defender";
    this.setStatus(
      `Best-of-3: ${attackerName} starts vs ${defenderName}`,
      `Category: ${categoryLabel}. Press Start Game to begin this round.`
    );
  }

  private pickCategory(exclude: string[] = []): string {
    const pool = CATEGORIES.filter((c) => !exclude.includes(c));
    return Phaser.Utils.Array.GetRandom(pool.length ? pool : CATEGORIES);
  }

  private shuffleCategories(): string[] {
    return Phaser.Utils.Array.Shuffle([...CATEGORIES]);
  }

  private getCategoryForIndex(idx: number): string {
    if (!this.categoryPool.length) {
      this.categoryPool = this.shuffleCategories();
    }
    return this.categoryPool[idx % this.categoryPool.length];
  }

  private bindHotkeys() {
    if (!this.input.keyboard) return;
    if (this.keyHandler) {
      this.input.keyboard.off("keydown", this.keyHandler);
    }
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.code === "Enter" || event.code === "NumpadEnter") {
        event.preventDefault();
        this.battleController.handleCorrectHotkey();
      } else if (event.code === "Space") {
        event.preventDefault();
        this.battleController.handlePassHotkey();
      }
    };
    this.input.keyboard.on("keydown", this.keyHandler);
    this.events.once("shutdown", () => {
      if (this.keyHandler) {
        this.input.keyboard?.off("keydown", this.keyHandler);
      }
    });
  }

  private registerExternalControls() {
    this.unregisterExternalControls();
    this.externalStartHandler = () => {
      if (this.mode === "chooseTarget" && this.startButtonEnabled) {
        this.startPendingBattle();
      } else if (this.mode === "finalReady" && this.pendingDirectBattle) {
        const atk = this.tiles.get(this.pendingDirectBattle.attackerTile);
        const def = this.tiles.get(this.pendingDirectBattle.defenderTile);
        this.nextForcedCategory = this.pendingDirectBattle.category;
        this.pendingDirectBattle = null;
        if (atk && def) {
          this.beginBattle(atk, def);
        }
      }
    };
    this.externalRandomHandler = () => {
      if (this.mode === "idle" || this.mode === "finalReady") {
        this.startRandomBattle();
      }
    };
    window.addEventListener("phaserStartBattleRequest", this.externalStartHandler);
    window.addEventListener("phaserRandomBattleRequest", this.externalRandomHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unregisterExternalControls());
  }

  private unregisterExternalControls() {
    if (this.externalStartHandler) {
      window.removeEventListener("phaserStartBattleRequest", this.externalStartHandler);
      this.externalStartHandler = undefined;
    }
    if (this.externalRandomHandler) {
      window.removeEventListener("phaserRandomBattleRequest", this.externalRandomHandler);
      this.externalRandomHandler = undefined;
    }
    if (this.stopAudioHandler) {
      window.removeEventListener("phaserStopAudio", this.stopAudioHandler);
      this.stopAudioHandler = undefined;
    }
  }

  private registerStopAudioListener() {
    this.stopAudioHandler = () => {
      this.randomizer?.stopAudio();
      this.randomizer?.stop();
    };
    window.addEventListener("phaserStopAudio", this.stopAudioHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.stopAudioHandler) {
        window.removeEventListener("phaserStopAudio", this.stopAudioHandler);
        this.stopAudioHandler = undefined;
      }
    });
  }

  private playTone(frequency: number, durationMs: number, volume = 0.15, startDelayMs = 0) {
    const webAudio = this.sound as Phaser.Sound.WebAudioSoundManager;
    const ctx: AudioContext | undefined = (webAudio as Phaser.Sound.WebAudioSoundManager).context;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime + startDelayMs / 1000;
    osc.start(now);
    osc.stop(now + durationMs / 1000);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private stopRandomizerAudio() {
    this.randomizer?.stopAudio();
    this.randomizer?.stop();
  }
}
