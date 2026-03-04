import type { Camera } from './camera.ts';
import type { StarSystem } from '../simulation/system.ts';
import { BODY_CLICK_THRESHOLD_PX } from '../simulation/constants.ts';

export function setupInput(
  canvas: HTMLCanvasElement,
  camera: Camera,
  system: StarSystem,
): void {
  // Mouse wheel → zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.zoom(e.deltaY, e.offsetX, e.offsetY);
  }, { passive: false });

  // Mouse drag → pan
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      camera.startPan(e.offsetX, e.offsetY);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    camera.movePan(e.offsetX, e.offsetY);
  });

  canvas.addEventListener('mouseup', () => {
    camera.endPan();
  });

  canvas.addEventListener('mouseleave', () => {
    camera.endPan();
  });

  // Right-click → set destination
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const ship = system.ships[0];
    if (!ship) return;

    const clickX = e.offsetX;
    const clickY = e.offsetY;

    // Check each body's screen distance from click
    const snapshot = system.snapshot();
    let nearestBodyId: string | null = null;
    let nearestDist = Infinity;

    for (const body of snapshot.bodies) {
      if (body.type === 'star') continue; // can't fly to the star
      const screenPos = camera.simToScreen(body.position.x, body.position.y);
      const dx = screenPos.x - clickX;
      const dy = screenPos.y - clickY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestBodyId = body.id;
      }
    }

    if (nearestBodyId && nearestDist < BODY_CLICK_THRESHOLD_PX) {
      system.command({
        type: 'SET_DESTINATION',
        shipId: 'player',
        destination: { type: 'body', bodyId: nearestBodyId },
      });
    } else {
      const simPos = camera.screenToSim(clickX, clickY);
      system.command({
        type: 'SET_DESTINATION',
        shipId: 'player',
        destination: { type: 'point', position: simPos },
      });
    }
  });

  // Double-click → focus on nearest body
  canvas.addEventListener('dblclick', (e) => {
    const simPos = camera.screenToSim(e.offsetX, e.offsetY);
    let closest: string | null = null;
    let closestDist = Infinity;

    const snapshot = system.snapshot();
    for (const body of snapshot.bodies) {
      const dx = body.position.x - simPos.x;
      const dy = body.position.y - simPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = body.id;
      }
    }

    if (closest) {
      camera.focusTarget = closest;
      const body = snapshot.bodies.find(b => b.id === closest);
      if (body) {
        camera.focusOn(body.position.x, body.position.y);
      }
    }
  });

  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'Escape':
        system.command({ type: 'CANCEL_ROUTE', shipId: 'player' });
        break;
      case ' ':
        e.preventDefault();
        if (system.paused) {
          system.command({ type: 'RESUME' });
        } else {
          system.command({ type: 'PAUSE' });
        }
        break;
      case '+':
      case '=': {
        const steps = [1, 10, 100, 1000, 5000, 10000, 50000, 100000];
        const idx = steps.indexOf(system.timeCompression);
        if (idx < steps.length - 1) {
          system.command({ type: 'SET_TIME_COMPRESSION', multiplier: steps[idx + 1] });
        }
        break;
      }
      case '-': {
        const steps = [1, 10, 100, 1000, 5000, 10000, 50000, 100000];
        const idx = steps.indexOf(system.timeCompression);
        if (idx > 0) {
          system.command({ type: 'SET_TIME_COMPRESSION', multiplier: steps[idx - 1] });
        }
        break;
      }
    }
  });
}
