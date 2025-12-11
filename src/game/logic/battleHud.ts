import Phaser from "phaser";
import type { BattleUI, PlayerState } from "../types";

type Callbacks = {
  onAttackerCorrect: () => void;
  onDefenderCorrect: () => void;
  onPass: () => void;
};

const TIMER_FONT = "18px";

export function timerLine(player: PlayerState, timeLeft: number) {
  const cat = player.category.length > 16 ? `${player.category.slice(0, 15)}…` : player.category;
  return `${player.name}\n${cat}\n${timeLeft.toFixed(1)}s`;
}

export function applyTimerStyles(ui: BattleUI, attackerTime: number, defenderTime: number) {
  const atkColor = attackerTime <= 5 ? "#ff4d4f" : "#fff";
  const defColor = defenderTime <= 5 ? "#ff4d4f" : "#fff";
  ui.attackerTimerText.setStyle({ color: atkColor, fontSize: TIMER_FONT });
  ui.defenderTimerText.setStyle({ color: defColor, fontSize: TIMER_FONT });
}

export function createBattleUI(
  scene: Phaser.Scene,
  attacker: PlayerState,
  defender: PlayerState,
  maxTimer: number,
  borderColor: number,
  callbacks: Callbacks
): BattleUI {
  const width = Number(scene.scale.width) || 600;
  const container = scene.add
    .container(width / 2, (Number(scene.scale.height) || 600) - 120)
    .setDepth(60);
  const bg = scene.add
    .rectangle(0, 0, width - 24, 150, 0x0b0b0f, 0.9)
    .setStrokeStyle(2, borderColor);
  container.add(bg);

  const headerText = scene.add
    .text(0, -60, `Turn: ${attacker.name}`, {
      fontSize: "16px",
      color: "#fff",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  container.add(headerText);

  const attackerTimerText = scene.add
    .text(-width / 4, -20, timerLine(attacker, maxTimer), {
      fontSize: TIMER_FONT,
      color: "#fff",
    })
    .setOrigin(0.5);
  const defenderTimerText = scene.add
    .text(width / 4, -20, timerLine(defender, maxTimer), {
      fontSize: TIMER_FONT,
      color: "#fff",
    })
    .setOrigin(0.5);
  container.add(attackerTimerText);
  container.add(defenderTimerText);

  const attackerBtn = scene.add
    .rectangle(-width / 4, 40, 150, 36, attacker.color, 0.95)
    .setStrokeStyle(2, borderColor)
    .setInteractive();
  const attackerBtnText = scene.add
    .text(-width / 4, 40, `${attacker.name} correct`, {
      fontSize: "14px",
      color: "#0b0b0f",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  attackerBtn.on("pointerdown", callbacks.onAttackerCorrect);
  container.add(attackerBtn);
  container.add(attackerBtnText);

  const defenderBtn = scene.add
    .rectangle(width / 4, 40, 150, 36, defender.color, 0.95)
    .setStrokeStyle(2, borderColor)
    .setInteractive();
  const defenderBtnText = scene.add
    .text(width / 4, 40, `${defender.name} correct`, {
      fontSize: "14px",
      color: "#0b0b0f",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  defenderBtn.on("pointerdown", callbacks.onDefenderCorrect);
  container.add(defenderBtn);
  container.add(defenderBtnText);

  const passBtn = scene.add
    .rectangle(0, 95, 150, 34, 0xff4d4f, 0.95)
    .setStrokeStyle(2, borderColor)
    .setInteractive();
  const passLabel = scene.add
    .text(0, 95, "Pass", { fontSize: "14px", color: "#fff", fontStyle: "bold" })
    .setOrigin(0.5);
  passBtn.on("pointerdown", callbacks.onPass);
  container.add(passBtn);
  container.add(passLabel);

  applyTimerStyles({ attackerTimerText, defenderTimerText } as BattleUI, maxTimer, maxTimer);

  return {
    container,
    attackerTimerText,
    defenderTimerText,
    headerText,
    attackerBtn,
    defenderBtn,
    passBtn,
    passLabel,
  };
}
