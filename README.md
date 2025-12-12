# The Floor — Multiplayer Tile Battle

A Phaser + React (Vite) game where players battle across a grid of tiles. Each tile belongs to a player with a “home” trivia category. Randomize a challenger, pick an adjacent defender, then race timers with category images and sound cues. Final two face a best‑of‑3 with a neutral tiebreaker category that hasn’t been played yet.

## Quick start
- Prereqs: Node 18+ and npm.
- Install: `npm install`
- Run dev server: `npm run dev` (Vite on http://localhost:5173 by default).
- Production build: `npm run build`
- Preview built assets: `npm run preview`

## How to play
1) From the start screen, choose a grid size (defaults to 3x3) and click **Start Game**.  
2) Click **Randomizer!** to pick a challenger. A highlight scrolls tiles while music plays; selection stops near the end of the track.  
3) The challenger clicks a neighboring enemy tile to pick a defender, then hits **Start Battle**.  
4) Countdown 3‑2‑1‑GO with beeps, then the challenger’s 25s clock starts. Defender’s clock waits until the challenger answers correctly.  
5) During battle:  
   - **Correct** (or Enter) pauses your clock and starts the opponent’s.  
   - **Pass** (or Space) triggers a 3s lockout and shows the next image.  
   - Category images fade in centered; the floor dims behind.  
   - The first timer to hit 0 loses; winner claims the defeated tiles and category.  
6) After a win: the winner may choose an adjacent category to continue battling or go back to floor randomization.  
7) Final two players: best‑of‑3. Round 1 uses defender’s category, round 2 the other player’s, and if tied 1‑1 the final is a random category never used in the game and not owned by either player. First to 2 wins takes the floor.  
8) **Reset Game** or **Exit Game** clears the session and restarts with the same grid size.

## Controls & hotkeys
- Randomizer: **Randomizer!** button.  
- Start battle: **Start Battle** button (enabled after selecting a defender).  
- During battle:  
  - Challenger/defender correct: click respective button or press **Enter** (active player only).  
  - Pass: click **Pass** or press **Space** (3s cooldown).  
- Exit/Reset: **Exit Game** (with confirmation) or **Reset Game** when shown.

## Project structure (selected)
- `src/ui/FloorGameContainer.tsx` — React shell, sizing, menu/start/exit buttons.  
- `src/game/config.ts` — Phaser game config factory.  
- `src/game/scenes/FloorGameScene.ts` — main scene wiring board, battles, randomizer hookup.  
- `src/game/logic/randomizer.ts` — random challenger scroll + music.  
- `src/game/logic/battleController.ts` — battle lifecycle, timers, countdown, input handling.  
- `src/game/logic/battleHud.ts` — battle UI elements/timer styling.  
- `src/game/logic/battleSeriesManager.ts` — best‑of‑3 flow for final two (tracks played categories).  
- `src/game/logic/categoryOverlay.ts` — post‑win category chooser/go-back dialog.  
- `src/game/logic/categoryImageManager.ts` — fade overlay and category image rotation.  
- `src/game/logic/categoryAssets.ts` — category definitions and image manifests.  
- `src/categoryImages/` — per-category image assets.  
- `src/FloorMusic/` — randomizer music track.

## Notes
- Timers are 25s per player by default.  
- Tile labels auto-wrap to fit longer category names.  
- Randomizer prefers players who haven’t battled; once all have, any alive player can be picked.  
- Sounds: beeps for countdown/GO, dual-tone for correct answers, pass lockout tone, randomizer music.  
- Input handling prevents spacebar scrolling during battles.
