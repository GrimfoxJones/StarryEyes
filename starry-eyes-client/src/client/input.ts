import type { Camera } from './camera.ts';
import type { StarSystem } from '../simulation/system.ts';
import { vec2Normalize, vec2Sub } from '../simulation/types.ts';

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

  // Right-click → set heading toward click point
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const ship = system.ships[0];
    if (!ship) return;

    const simPos = camera.screenToSim(e.offsetX, e.offsetY);
    const dir = vec2Normalize(vec2Sub(simPos, ship.position));

    system.command({ type: 'SET_HEADING', shipId: 'player', heading: dir });
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
    const ship = system.ships[0];
    if (!ship) return;

    // 0-9 for thrust
    if (e.key >= '0' && e.key <= '9') {
      const level = parseInt(e.key) / 10;
      system.command({ type: 'SET_THRUST', shipId: 'player', level });
      return;
    }

    switch (e.key) {
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
