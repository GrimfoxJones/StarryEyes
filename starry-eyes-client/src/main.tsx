import { Application } from 'pixi.js';
import { createRoot } from 'react-dom/client';
import { GameRenderer } from './client/renderer.ts';
import { setupInput } from './client/input.ts';
import { TrailRecorder } from './client/trails.ts';
import { HudOverlay } from './client/hud/HudOverlay.tsx';
import { useGameStore } from './client/hud/store.ts';
import { RemoteBridge } from './RemoteBridge.ts';
import type { Vec2 } from '@starryeyes/shared';
import { sampleRouteAhead, buildSOITable } from '@starryeyes/shared';
import type { SOIEntry } from '@starryeyes/shared';

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

  // Build SOI table (planets only) for camera reference frame
  const allSOIs = buildSOITable(bridge.getBodies());
  const planetSOIs: SOIEntry[] = allSOIs.filter(e => e.body.type === 'planet');

  // Renderer
  const renderer = new GameRenderer(app);

  // Trail recorder
  const trail = new TrailRecorder();
  let lastRefBodyId = 'sol';

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

    // Update camera reference frame based on what the camera is looking at
    renderer.camera.updateReferenceFrame(snapshot.bodies, planetSOIs);

    // Clear trail when reference body changes
    if (renderer.camera.referenceBodyId !== lastRefBodyId) {
      trail.clear();
      lastRefBodyId = renderer.camera.referenceBodyId;
    }

    // Record trail (relative to reference body)
    if (myShip) {
      const refOff = renderer.camera.referenceOffset;
      trail.record(
        {
          x: myShip.position.x - refOff.x,
          y: myShip.position.y - refOff.y,
        },
        snapshot.gameTime,
      );
    }

    // Update prediction points (only for non-body destinations)
    predictionFrame++;
    if (myShip?.route && !myShip.route.targetBodyId) {
      if (predictionFrame % 5 === 0) {
        predictionPoints = sampleRouteAhead(myShip.route, snapshot.gameTime, 30);
      }
    } else {
      predictionPoints = [];
    }

    // Auto-lock onto planets near screen center
    if (!renderer.camera.focusTarget) {
      const cx = renderer.camera.viewportWidth / 2;
      const cy = renderer.camera.viewportHeight / 2;
      let nearestId: string | null = null;
      let nearestDist = Infinity;
      for (const body of snapshot.bodies) {
        if (body.type !== 'planet') continue;
        const screen = renderer.camera.simToScreen(body.position.x, body.position.y);
        const dx = screen.x - cx;
        const dy = screen.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = body.id;
        }
      }
      if (nearestId && nearestDist < 50) {
        renderer.camera.focusTarget = nearestId;
        renderer.camera.resetFocusPan();
      }
    }

    // Track focus target (heliocentric — focusOn converts to local)
    if (renderer.camera.focusTarget) {
      const target = snapshot.bodies.find(b => b.id === renderer.camera.focusTarget);
      if (target) {
        renderer.camera.focusOn(target.position.x, target.position.y);
      }
    }

    // Render
    renderer.render(snapshot);

    // Draw destination indicator: straight line to body, or Bezier prediction for points
    if (myShip?.route?.targetBodyId) {
      const targetBody = snapshot.bodies.find(b => b.id === myShip.route!.targetBodyId);
      if (targetBody) {
        renderer.renderDestinationLine(myShip.position, targetBody.position);
      }
    } else {
      renderer.renderPrediction(predictionPoints);
    }
    // Trail points are reference-frame-local; add referenceOffset so simToScreen
    // (which subtracts referenceOffset) renders them in the correct frame
    const refOff = renderer.camera.referenceOffset;
    const trailHelio = trail.getPoints().map(p => ({
      x: p.x + refOff.x,
      y: p.y + refOff.y,
    }));
    renderer.renderTrail(trailHelio);

    // Update targeting display
    renderer.targetDisplay.update(snapshot, app.ticker.deltaMS);

    // Update HUD store
    useGameStore.getState().update(snapshot);
  });
}

boot().catch((err) => {
  console.error('Failed to boot:', err);
});
