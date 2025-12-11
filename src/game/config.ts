import Phaser from "phaser";
// Scene classes are added dynamically by the UI container so we don't import them here to avoid auto-start

export const GAME_WIDTH = 600;
export const GAME_HEIGHT = 600;

export function createGameConfig(width: number = GAME_WIDTH, height: number = GAME_HEIGHT): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width,
    height,
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    // Register no scenes here so we can add/start/stop them dynamically
    scene: [],
    parent: "phaser-container", // this matches the React container's div id
    backgroundColor: "#111111",
  };
}
