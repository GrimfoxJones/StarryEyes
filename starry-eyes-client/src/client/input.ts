import type { Camera } from './camera.ts';
import type { StarSystem } from '../simulation/system.ts';
import type { BodySnapshot, BodyType } from '../simulation/types.ts';
import { useGameStore } from './hud/store.ts';
import { BODY_CLICK_THRESHOLD_PX } from '../simulation/constants.ts';
import type { TargetDisplay } from './targeting/TargetDisplay.ts';
import { bodyTypeToObjectType } from './targeting/infoContent.ts';
import { isMoonHidden } from './bodies.ts';

export function setupInput(
  canvas: HTMLCanvasElement,
  camera: Camera,
  system: StarSystem,
  targetDisplay: TargetDisplay,
): void {
  // Track mouse down position for click-vs-drag detection
  let mouseDownPos: { x: number; y: number } | null = null;

  // Mouse wheel → zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.zoom(e.deltaY, e.offsetX, e.offsetY);
  }, { passive: false });

  // Mouse drag → pan + track mousedown for click detection
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouseDownPos = { x: e.offsetX, y: e.offsetY };
      camera.startPan(e.offsetX, e.offsetY);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    camera.movePan(e.offsetX, e.offsetY);
  });

  canvas.addEventListener('mouseup', (e) => {
    camera.endPan();

    // Left-click detection (not drag)
    if (e.button === 0 && mouseDownPos) {
      const dx = e.offsetX - mouseDownPos.x;
      const dy = e.offsetY - mouseDownPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      mouseDownPos = null;

      if (dist < 5) {
        handleLeftClick(e.offsetX, e.offsetY, camera, system, targetDisplay);
      }
    }
  });

  canvas.addEventListener('mouseleave', () => {
    camera.endPan();
    mouseDownPos = null;
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
      if (isMoonHidden(body, snapshot.bodies, camera)) continue;
      const screenPos = camera.simToScreen(body.position.x, body.position.y);
      const ddx = screenPos.x - clickX;
      const ddy = screenPos.y - clickY;
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < nearestDist) {
        nearestDist = d;
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
      if (isMoonHidden(body, snapshot.bodies, camera)) continue;
      const ddx = body.position.x - simPos.x;
      const ddy = body.position.y - simPos.y;
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < closestDist) {
        closestDist = d;
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
    const store = useGameStore.getState();

    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        store.toggleLeftPanel();
        break;

      case 'Escape':
        // Priority chain: modal → target → left panel → cancel route
        if (store.modal) {
          // Modal handles its own Escape via capture listener
          // but if it somehow gets here, dismiss it
          store.dismissModal();
        } else if (targetDisplay.active) {
          targetDisplay.dismiss();
        } else if (store.leftPanelOpen) {
          store.closeLeftPanel();
        } else {
          system.command({ type: 'CANCEL_ROUTE', shipId: 'player' });
        }
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

/** Handle left-click: hit-test bodies for targeting, dismiss if empty space */
function handleLeftClick(
  clickX: number,
  clickY: number,
  camera: Camera,
  system: StarSystem,
  targetDisplay: TargetDisplay,
): void {
  const store = useGameStore.getState();
  const snapshot = system.snapshot();

  // Close left panel on map click
  if (store.leftPanelOpen) {
    store.closeLeftPanel();
  }

  // Hit-test bodies
  let nearestBodyId: string | null = null;
  let nearestBodyType: BodyType | null = null;
  let nearestDist = Infinity;

  for (const body of snapshot.bodies) {
    if (body.type === 'star') continue;
    if (isMoonHidden(body, snapshot.bodies, camera)) continue;
    const screenPos = camera.simToScreen(body.position.x, body.position.y);
    const dx = screenPos.x - clickX;
    const dy = screenPos.y - clickY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestBodyId = body.id;
      nearestBodyType = body.type;
    }
  }

  if (nearestBodyId && nearestBodyType && nearestDist < BODY_CLICK_THRESHOLD_PX) {
    targetDisplay.acquire(nearestBodyId, bodyTypeToObjectType(nearestBodyType));
  } else {
    targetDisplay.dismiss();
  }
}
