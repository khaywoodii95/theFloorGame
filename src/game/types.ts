import Phaser from "phaser";

export type Mode = "idle" | "chooseTarget" | "battle" | "chooseCategory" | "finalReady" | "gameover";
export type BattleTimerFocus = "both" | "attacker" | "defender";

export type TileData = {
  key: string;
  row: number;
  col: number;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  ownerId: number | null;
  hasBattled: boolean;
};

export type PlayerState = {
  id: number;
  name: string;
  color: number;
  category: string;
  alive: boolean;
  tiles: Set<string>;
  hasBattled: boolean;
};

export type BattleUI = {
  container: Phaser.GameObjects.Container;
  attackerTimerText: Phaser.GameObjects.Text;
  defenderTimerText: Phaser.GameObjects.Text;
  headerText: Phaser.GameObjects.Text;
  attackerBtn: Phaser.GameObjects.Rectangle;
  defenderBtn: Phaser.GameObjects.Rectangle;
  passBtn: Phaser.GameObjects.Rectangle;
  passLabel: Phaser.GameObjects.Text;
};

export type BattleState = {
  attackerId: number;
  defenderId: number;
  attackerTile: string;
  defenderTile: string;
  attackerTime: number;
  defenderTime: number;
  active: BattleTimerFocus;
  timerEvent: Phaser.Time.TimerEvent;
  ui: BattleUI;
  roundCategory: string;
};

export type LastTwoSeriesState = {
  players: [number, number];
  scores: Record<number, number>;
  nextCategory: "defender" | "challenger" | "random";
};
