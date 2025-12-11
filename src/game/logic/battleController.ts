import Phaser from "phaser";
import { CategoryImageManager } from "./categoryImageManager";
import { applyTimerStyles, createBattleUI, timerLine } from "./battleHud";
import type { BattleState, PlayerState, TileData } from "../types";

export type BattleResult = {
  winnerId: number;
  loserId: number;
  attackerId: number;
  defenderId: number;
  attackerTile: string;
  defenderTile: string;
  roundCategory: string;
  winnerWasAttacker: boolean;
};

type BattleControllerDeps = {
  maxTimer: number;
  tileBorder: number;
  categoryImages: CategoryImageManager;
  getPlayer: (id: number) => PlayerState | undefined;
  onStatus: (title: string, hint?: string) => void;
  onActionHint: (text: string) => void;
  onCategoryChange: (category: string | null) => void;
  onBattleComplete: (result: BattleResult) => void;
  playTone: (frequency: number, durationMs: number, volume?: number, delayMs?: number) => void;
};

export class BattleController {
  private scene: Phaser.Scene;
  private deps: BattleControllerDeps;
  private battleState: BattleState | null = null;
  private passCooldown?: Phaser.Time.TimerEvent;
  private battleCountdownText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, deps: BattleControllerDeps) {
    this.scene = scene;
    this.deps = deps;
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  startBattle(attackerTile: TileData, defenderTile: TileData, roundCategory: string) {
    const attacker =
      attackerTile.ownerId != null ? this.deps.getPlayer(attackerTile.ownerId) : undefined;
    const defender =
      defenderTile.ownerId != null ? this.deps.getPlayer(defenderTile.ownerId) : undefined;
    if (!attacker || !defender) return;

    // build battle state and paused timer loop
    const battleState: BattleState = {
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerTile: attackerTile.key,
      defenderTile: defenderTile.key,
      attackerTime: this.deps.maxTimer,
      defenderTime: this.deps.maxTimer,
      active: "attacker",
      timerEvent: this.scene.time.addEvent({
        delay: 250,
        loop: true,
        paused: true,
        callback: () => this.tickBattle(0.25),
      }),
      ui: createBattleUI(
        this.scene,
        attacker,
        defender,
        this.deps.maxTimer,
        this.deps.tileBorder,
        {
          onAttackerCorrect: () => this.markCorrect("attacker"),
          onDefenderCorrect: () => this.markCorrect("defender"),
          onPass: () => this.handlePass(),
        }
      ),
      roundCategory,
    };

    this.battleState = battleState;
    this.setCorrectButtonsInteractive(false);
    this.deps.onCategoryChange(roundCategory);
    this.deps.onStatus(
      `${attacker.name} vs ${defender.name}`,
      `Battle category: ${roundCategory}. Challenger timer starts; defender waits until challenger answers correctly.`
    );
    this.runBattleCountdown();
  }

  isActive() {
    return !!this.battleState;
  }

  handleCorrectHotkey() {
    if (!this.battleState || this.battleState.timerEvent.paused) return;
    if (this.battleState.active === "attacker") {
      this.markCorrect("attacker");
    } else if (this.battleState.active === "defender") {
      this.markCorrect("defender");
    }
  }

  handlePassHotkey() {
    if (!this.battleState || this.battleState.timerEvent.paused) return;
    this.handlePass();
  }

  private tickBattle(deltaSeconds: number) {
    if (!this.battleState) return;
    const battle = this.battleState;

    if (battle.active === "both") {
      battle.attackerTime -= deltaSeconds;
      battle.defenderTime -= deltaSeconds;
    } else if (battle.active === "attacker") {
      battle.attackerTime -= deltaSeconds;
    } else if (battle.active === "defender") {
      battle.defenderTime -= deltaSeconds;
    }

    battle.attackerTime = Math.max(0, battle.attackerTime);
    battle.defenderTime = Math.max(0, battle.defenderTime);
    this.updateBattleUI(battle);

    if (battle.attackerTime <= 0 || battle.defenderTime <= 0) {
      this.resolveBattle(battle);
    }
  }

  private resolveBattle(battle: BattleState) {
    const attacker = this.deps.getPlayer(battle.attackerId);
    const defender = this.deps.getPlayer(battle.defenderId);
    if (!attacker || !defender) return;

    battle.timerEvent.remove(false);
    battle.ui.container.destroy(true);
    this.battleState = null;
    this.deps.onCategoryChange(null);
    this.battleCountdownText?.destroy();
    this.battleCountdownText = undefined;
    this.clearCategoryImageCycle();
    this.passCooldown?.remove(false);
    this.passCooldown = undefined;
    this.deps.playTone(220, 400, 0.25);

    const winner = battle.attackerTime <= 0 ? defender : attacker;
    const loser = winner.id === attacker.id ? defender : attacker;
    this.deps.onBattleComplete({
      winnerId: winner.id,
      loserId: loser.id,
      winnerWasAttacker: winner.id === attacker.id,
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerTile: battle.attackerTile,
      defenderTile: battle.defenderTile,
      roundCategory: battle.roundCategory,
    });
  }

  private markCorrect(side: "attacker" | "defender") {
    if (!this.battleState) return;
    if (side === "attacker") {
      this.battleState.active = "defender";
    } else {
      this.battleState.active = "attacker";
    }
    // play G then B as quick 16th notes
    this.deps.playTone(392, 110, 0.22);
    this.deps.playTone(494, 110, 0.22, 120);
    if (this.battleState) {
      this.setCorrectButtonsInteractive(true);
      this.setPassButtonState(true);
      this.showNextCategoryImage();
    }
    const playerName =
      side === "attacker"
        ? this.deps.getPlayer(this.battleState?.attackerId ?? -1)?.name
        : this.deps.getPlayer(this.battleState?.defenderId ?? -1)?.name;
    this.deps.onActionHint(`${playerName ?? "Player"} answered correctly. Their clock is paused.`);
  }

  private updateBattleUI(battle: BattleState) {
    const attacker = this.deps.getPlayer(battle.attackerId);
    const defender = this.deps.getPlayer(battle.defenderId);
    if (!attacker || !defender) return;

    battle.ui.attackerTimerText.setText(timerLine(attacker, battle.attackerTime));
    battle.ui.defenderTimerText.setText(timerLine(defender, battle.defenderTime));
    applyTimerStyles(battle.ui, battle.attackerTime, battle.defenderTime);

    const active =
      battle.active === "both"
        ? "Both timers running."
        : battle.active === "attacker"
        ? `${attacker.name}'s turn`
        : `${defender.name}'s turn`;
    battle.ui.headerText.setText(active);
    this.setCorrectButtonsInteractive(true);
    this.setPassButtonState(true);
  }

  private setCorrectButtonsInteractive(allowActiveOnly: boolean) {
    if (!this.battleState) return;
    const battle = this.battleState;
    if (!battle.ui.attackerBtn || !battle.ui.defenderBtn) return;
    const inCooldown = !!this.passCooldown;
    if (!allowActiveOnly || inCooldown) {
      battle.ui.attackerBtn.disableInteractive().setAlpha(0.45);
      battle.ui.defenderBtn.disableInteractive().setAlpha(0.45);
      return;
    }
    const attackerActive = battle.active === "attacker" || battle.active === "both";
    const defenderActive = battle.active === "defender" || battle.active === "both";
    if (attackerActive) {
      battle.ui.attackerBtn.setInteractive({ useHandCursor: true }).setAlpha(1);
    } else {
      battle.ui.attackerBtn.disableInteractive().setAlpha(0.45);
    }
    if (defenderActive) {
      battle.ui.defenderBtn.setInteractive({ useHandCursor: true }).setAlpha(1);
    } else {
      battle.ui.defenderBtn.disableInteractive().setAlpha(0.45);
    }
  }

  private setPassButtonState(enabled: boolean) {
    if (!this.battleState) return;
    const { passBtn, passLabel } = this.battleState.ui;
    if (!passBtn || !passLabel) return;
    if (enabled && !this.passCooldown) {
      passBtn.setInteractive({ useHandCursor: true }).setAlpha(1);
      passLabel.setAlpha(1);
    } else {
      passBtn.disableInteractive().setAlpha(0.5);
      passLabel.setAlpha(0.5);
    }
  }

  private showNextCategoryImage() {
    this.deps.categoryImages.next();
  }

  private clearCategoryImageCycle() {
    this.deps.categoryImages.clear();
  }

  private handlePass() {
    if (!this.battleState) return;
    if (this.passCooldown) return;
    this.deps.playTone(180, 200, 0.25);
    this.setCorrectButtonsInteractive(false);
    this.setPassButtonState(false);
    this.passCooldown = this.scene.time.addEvent({
      delay: 3000,
      callback: () => {
        this.passCooldown = undefined;
        this.showNextCategoryImage();
        if (this.battleState) {
          this.setCorrectButtonsInteractive(true);
          this.setPassButtonState(true);
        }
      },
    });
  }

  private runBattleCountdown() {
    if (!this.battleState) return;
    const { width, height } = this.scene.scale;
    this.battleCountdownText?.destroy();
    this.battleCountdownText = this.scene.add
      .text(width / 2, height * 0.5, "", { fontSize: "64px", color: "#ffc542", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(40);

    const steps: { label: string; high?: boolean }[] = [
      { label: "3" },
      { label: "2" },
      { label: "1" },
      { label: "GO!", high: true },
    ];
    const timers: Phaser.Time.TimerEvent[] = [];

    steps.forEach((step, idx) => {
      const evt = this.scene.time.delayedCall(idx * 800, () => {
        this.battleCountdownText?.setText(step.label);
        this.deps.playTone(step.high ? 740 : 440, 180, 0.24);
        if (idx === steps.length - 1) {
          const finishEvt = this.scene.time.delayedCall(600, () => {
            this.battleCountdownText?.destroy();
            this.battleCountdownText = undefined;
            if (this.battleState) {
              this.battleState.timerEvent.paused = false;
              this.deps.categoryImages.start(this.battleState.roundCategory);
              this.deps.categoryImages.next();
              this.setCorrectButtonsInteractive(true);
              this.setPassButtonState(true);
            }
          });
          timers.push(finishEvt);
        }
      });
      timers.push(evt);
    });

    this.scene.events.once("shutdown", () => timers.forEach((t) => t.remove(false)));
  }

  cleanup() {
    this.battleCountdownText?.destroy();
    this.battleCountdownText = undefined;
    this.passCooldown?.remove(false);
    this.passCooldown = undefined;
    this.clearCategoryImageCycle();
    if (this.battleState) {
      this.battleState.timerEvent.remove(false);
      this.battleState.ui.container.destroy(true);
      this.battleState = null;
    }
  }
}
