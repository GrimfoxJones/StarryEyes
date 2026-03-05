import { Application } from 'pixi.js';
import { createRoot } from 'react-dom/client';
import { GameRenderer } from './client/renderer.ts';
import { setupInput } from './client/input.ts';
import { TrailRecorder } from './client/trails.ts';
import { HudOverlay } from './client/hud/HudOverlay.tsx';
import { useGameStore } from './client/hud/store.ts';
import { RemoteBridge } from './RemoteBridge.ts';
import type { Vec2 } from '@starryeyes/shared';
import { sampleRouteAhead } from '@starryeyes/shared';

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

  // Connect to server
  const bridge = new RemoteBridge();
  await bridge.connect();

  // Renderer
  const renderer = new GameRenderer(app);

  // Trail recorder
  const trail = new TrailRecorder();

  // Input
  setupInput(app.canvas, renderer.camera, bridge, renderer.targetDisplay);

  // React HUD
  const hudRoot = document.getElementById('hud-root')!;
  const root = createRoot(hudRoot);
  root.render(<HudOverlay />);

  // Handle resize
  window.addEventListener('resize', () => {
    renderer.handleResize();
  });

  // Game loop
  let predictionPoints: Vec2[] = [];
  let predictionFrame = 0;

  app.ticker.add(() => {
    // Interpolate from last server snapshot
    const snapshot = bridge.interpolate();
    if (!snapshot) return;

    // Find our ship
    const myShipId = bridge.getMyShipId();
    const myShip = snapshot.ships.find(s => s.id === myShipId);

    // Record trail
    if (myShip) {
      trail.record(myShip.position, snapshot.gameTime);
    }

    // Update prediction every few frames
    predictionFrame++;
    if (predictionFrame % 5 === 0 && myShip?.route) {
      predictionPoints = sampleRouteAhead(myShip.route, snapshot.gameTime, 30);
    } else if (!myShip?.route) {
      predictionPoints = [];
    }

    // Track focus target
    if (renderer.camera.focusTarget) {
      const target = snapshot.bodies.find(b => b.id === renderer.camera.focusTarget);
      if (target) {
        renderer.camera.focusOn(target.position.x, target.position.y);
      }
    }

    // Render
    renderer.render(snapshot);
    renderer.renderPrediction(predictionPoints);
    renderer.renderTrail(trail.getPoints());

    // Update targeting display
    renderer.targetDisplay.update(snapshot, app.ticker.deltaMS);

    // Update HUD store
    useGameStore.getState().update(snapshot);
  });
}

boot().catch((err) => {
  console.error('Failed to boot:', err);
});
