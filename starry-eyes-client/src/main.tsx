import { Application } from 'pixi.js';
import { createRoot } from 'react-dom/client';
import { StarSystem } from './simulation/system.ts';
import { GameRenderer } from './client/renderer.ts';
import { setupInput } from './client/input.ts';
import { TrailRecorder } from './client/trails.ts';
import { HudOverlay } from './client/hud/HudOverlay.tsx';
import { useGameStore } from './client/hud/store.ts';
import type { SystemSnapshot, Vec2 } from './simulation/types.ts';

async function boot() {
  // PixiJS setup
  const app = new Application();
  await app.init({
    background: 0x050510,
    resizeTo: window,
    antialias: true,
  });

  const pixiContainer = document.getElementById('pixi-container')!;
  pixiContainer.appendChild(app.canvas);

  // Simulation
  const system = new StarSystem();

  // Renderer
  const renderer = new GameRenderer(app);

  // Trail recorder
  const trail = new TrailRecorder();

  // Input
  setupInput(app.canvas, renderer.camera, system);

  // React HUD
  const hudRoot = document.getElementById('hud-root')!;
  const root = createRoot(hudRoot);
  root.render(<HudOverlay />);

  // Handle resize
  window.addEventListener('resize', () => {
    renderer.handleResize();
  });

  // Game loop
  let lastSnapshot: SystemSnapshot = system.snapshot();
  let predictionPoints: Vec2[] = [];
  let predictionFrame = 0;

  app.ticker.add(() => {
    const realDt = app.ticker.deltaMS / 1000;

    // Clamp to prevent spiral of death
    const clampedRealDt = Math.min(realDt, 0.1);
    const gameDt = clampedRealDt * system.timeCompression;

    // Tick simulation
    lastSnapshot = system.tick(gameDt);

    // Record trail
    const playerShip = system.ships[0];
    if (playerShip) {
      trail.record(playerShip.position, system.gameTime);
    }

    // Update prediction every few frames (performance)
    predictionFrame++;
    if (predictionFrame % 5 === 0) {
      predictionPoints = system.predictTrajectory('player');
    }

    // Track focus target
    if (renderer.camera.focusTarget) {
      const target = lastSnapshot.bodies.find(b => b.id === renderer.camera.focusTarget);
      if (target) {
        renderer.camera.focusOn(target.position.x, target.position.y);
      }
    }

    // Render
    renderer.render(lastSnapshot);
    renderer.renderPrediction(predictionPoints);
    renderer.renderTrail(trail.getPoints());

    // Update HUD store
    useGameStore.getState().update(lastSnapshot);
  });
}

boot();
