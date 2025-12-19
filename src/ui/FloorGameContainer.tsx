import { useCallback, useEffect, useState } from "react";
import Phaser from "phaser";
import { createGameConfig } from "../game/config";
import { FloorGameScene } from "../game/scenes/FloorGameScene";

let game: Phaser.Game | null = null;

export function FloorGameContainer() {
  const [mode, setMode] = useState<"menu" | "playing">("menu");
  const [gridInput, setGridInput] = useState<string>("3");
  const [gridSize, setGridSize] = useState<number | null>(3);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmExit, setShowConfirmExit] = useState<boolean>(false);
  const [startEnabled, setStartEnabled] = useState<boolean>(false);
  const computeCanvasSize = useCallback(() => {
    if (typeof window === "undefined") return 600;
    // leave room for header/status/controls while keeping things centered
    const usableHeight = Math.max(260, window.innerHeight - 280);
    const usableWidth = Math.max(260, window.innerWidth - 40);
    const base = Math.min(usableHeight, usableWidth);
    return Math.max(300, Math.min(800, base));
  }, []);
  const [canvasSize, setCanvasSize] = useState<number>(() => computeCanvasSize());

  useEffect(() => {
    const update = () => setCanvasSize(computeCanvasSize());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [computeCanvasSize, mode]);

  function ensureGame(size: number) {
    if (!game) {
      game = new Phaser.Game(createGameConfig(size, size));
      try {
        game.scene.add("FloorGameScene", FloorGameScene, false);
      } catch (e) {
        console.warn("Failed to add FloorGameScene to game:", e);
      }
    }
  }

  useEffect(() => {
    // create the Phaser game once when the component mounts and register scenes
    ensureGame(canvasSize);

    // cleanup when unmounting: destroy game if present
    return () => {
      if (game) {
        game.destroy(true);
        game = null;
      }
    };
  }, []);

  useEffect(() => {
    const startStateHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled: boolean }>).detail;
      if (typeof detail?.enabled === "boolean") {
        setStartEnabled(detail.enabled);
      }
    };
    window.addEventListener("phaserStartButtonState", startStateHandler);
    return () => window.removeEventListener("phaserStartButtonState", startStateHandler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ gridSize?: number }>).detail;
      const sizeToUse = detail?.gridSize ?? gridSize ?? 3;

      const existingGame = game;
      if (existingGame) {
        try {
          existingGame.destroy(true);
        } catch (e) {
          console.warn("Error destroying game on reset request:", e);
        }
        game = null;
      }

      ensureGame(canvasSize);
      const newGame = game;
      if (!newGame) return;
      try {
        newGame.scene.start("FloorGameScene", { gridSize: sizeToUse });
        setMode("playing");
      } catch (e) {
        console.error("Failed to restart FloorGameScene on reset request:", e);
      }
    };

    window.addEventListener("phaserResetRequested", handler);
    return () => window.removeEventListener("phaserResetRequested", handler);
  }, [gridSize]);

  function validateAndSet(value: string) {
    if (!/^\d*$/.test(value)) return;
    setGridInput(value);
    if (value === "") {
      setGridSize(null);
      setError("Enter a number between 2 and 10");
      return;
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 2 || n > 10) {
      setGridSize(null);
      setError("Number must be an integer between 2 and 10");
    } else {
      setGridSize(n);
      setError(null);
    }
  }

  function startGame() {
    if (!gridSize) return;
    ensureGame(canvasSize);
    if (!game) return;

    // start the FloorGameScene with the requested grid size
    try {
      game.scene.start("FloorGameScene", { gridSize });
      setMode("playing");
    } catch (e) {
      console.error("Failed to start FloorGameScene:", e);
    }
  }

  function exitToMenu() {
    // show confirmation modal before exiting
    setShowConfirmExit(true);
  }

  function confirmExit() {
    // stop any in-progress randomizer audio
    window.dispatchEvent(new CustomEvent("phaserStopAudio"));

    // fully reset Phaser game so next start recreates the grid cleanly
    if (game) {
      try {
        game.destroy(true);
      } catch (e) {
        console.warn("Error destroying game on confirm exit:", e);
      }
      game = null;
    }
    window.dispatchEvent(new CustomEvent("battleCategoryChanged", { detail: { category: null } }));
    window.dispatchEvent(
      new CustomEvent("gameStatusChanged", { detail: { title: "Ready", hint: "Click Random Battle to begin." } })
    );
    setGridInput("3");
    setGridSize(3);
    setError(null);
    setShowConfirmExit(false);
    setMode("menu");
  }

  function cancelExit() {
    setShowConfirmExit(false);
  }

  function triggerRandomBattle() {
    window.dispatchEvent(new CustomEvent("phaserRandomBattleRequest"));
  }

  function triggerStartBattle() {
    window.dispatchEvent(new CustomEvent("phaserStartBattleRequest"));
  }

  // Always render the phaser container so the Phaser canvas remains attached to the same DOM node.
  // Render controls in a header area so Start and Exit occupy the same place.
  return (
    <div style={{ textAlign: "center", marginTop: "4px", overflow: "hidden" }}>
      <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
        {mode === "menu" ? (
          <>
            <label style={{ color: "#FFC542", marginRight: "8px" }}>Grid Size (2-10):</label>
            <input
              value={gridInput}
              onChange={(e) => validateAndSet(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  startGame();
                }
              }}
              style={{ width: "60px", padding: "6px", borderRadius: "4px" }}
              inputMode="numeric"
            />
            <button
              onClick={startGame}
              disabled={!gridSize}
              style={{
                marginLeft: "10px",
                padding: "6px 12px",
                background: "#1555e0",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: gridSize ? "pointer" : "not-allowed",
              }}
            >
              Start Game
            </button>
          </>
        ) : (
          <>
            <button
              onClick={exitToMenu}
              style={{
                padding: "6px 12px",
                background: "#ff4d4f",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Exit Game
            </button>
          </>
        )}

        {/* Confirmation modal overlay (shows when attempting to exit) */}
        {showConfirmExit && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
            <div style={{ background: "#0b0b0f", padding: "20px", borderRadius: "8px", border: "2px solid #333", minWidth: "320px", textAlign: "center" }}>
              <p style={{ color: "#fff", margin: "0 0 12px 0" }}>Are you sure you want to Exit the game?</p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button
                  onClick={confirmExit}
                  aria-label="Yes, exit"
                  style={{ background: "#28a745", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px" }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                      {/* black outline (thicker) */}
                      <path d="M4.5 12.5L9.5 17.5L19 7" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                      {/* green check (on top) */}
                      <path d="M4.5 12.5L9.5 17.5L19 7" stroke="#28a745" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>Yes</span>
                </button>

                <button
                  onClick={cancelExit}
                  aria-label="No, stay"
                  style={{ background: "#dc3545", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px" }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                      {/* black outline (thicker) */}
                      <path d="M6 6L18 18M6 18L18 6" stroke="#000" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                      {/* red X (on top) */}
                      <path d="M6 6L18 18M6 18L18 6" stroke="#ff0000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>No</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: "#ffcccb", marginTop: "6px" }}>{error}</div>
      )}

      <div style={{ position: "relative", width: `${canvasSize}px`, margin: "2px auto 0" }}>
        <div
          id="phaser-container"
          style={{
            width: `${canvasSize}px`,
            height: `${canvasSize}px`,
            border: "2px solid #444",
            background: "linear-gradient(180deg, #0B0B0F, #1A1F2E)",
            margin: "0 auto",
          }}
        />

        {mode === "menu" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ color: "#AAA", pointerEvents: "auto", textAlign: "center" }}>
              <h2 style={{ color: "#1555e0", margin: "0 0 8px 0" }}>The Floor</h2>
              <p style={{ margin: 0 }}>Enter the grid size and click Start Game to play.
                 <br/><em>(Ex. Entering 5 will create a 5x5 grid)</em></p>
            </div>
          </div>
        )}
      </div>

      {mode === "playing" && (
        <div style={{ marginTop: "10px", display: "flex", justifyContent: "center", gap: "12px" }}>
          <button
            onClick={triggerRandomBattle}
            style={{
              padding: "10px 14px",
              background: "#1555e0",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              minWidth: "140px",
              fontWeight: 700,
            }}
          >
            Randomizer!
          </button>
          <button
            onClick={triggerStartBattle}
            disabled={!startEnabled}
            style={{
              padding: "10px 14px",
              background: startEnabled ? "#28a745" : "#3a4a3d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: startEnabled ? "pointer" : "not-allowed",
              minWidth: "140px",
              fontWeight: 700,
              opacity: startEnabled ? 1 : 0.6,
            }}
          >
            Start Battle
          </button>
        </div>
      )}

      <div
        style={{
          maxWidth: "640px",
          color: "#d8d8e5",
          fontSize: "14px",
          lineHeight: 1.4,
          marginTop: "12px",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <strong style={{ color: "#ffc542" }}>How battles work:</strong>
        <div style={{ marginTop: "6px" }}>
          <div>1) Click <em>Randomizer!</em> to select a challenger tile that has not fought yet.</div>
          <div>2) Click an adjacent enemy tile to pick your opponent, then hit <em>Start Battle</em>.</div>
          <div>3) Challenger clock starts first. Defender clock does not run until the challenger answers correctly.</div>
          <div>4) Click a player’s “correct” button to freeze their timer and run the opponent’s. First to zero loses and the winner takes the floor and category.</div>
        </div>
      </div>
    </div>
  );
}
