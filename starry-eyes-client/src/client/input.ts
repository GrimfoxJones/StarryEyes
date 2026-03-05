import type { Camera } from './camera.ts';
import type { BodyType } from '@starryeyes/shared';
import { BODY_CLICK_THRESHOLD_PX } from '@starryeyes/shared';
import { useGameStore } from './hud/store.ts';
import type { TargetDisplay } from './targeting/TargetDisplay.ts';
import { bodyTypeToObjectType } from './targeting/infoContent.ts';
import { isMoonHidden } from './bodies.ts';
import type { ISimulationBridge } from '../bridge.ts';

export function setupInput(
  canvas: HTMLCanvasElement,
  camera: Camera,
  bridge: ISimulationBridge,
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
        handleLeftClick(e.offsetX, e.offsetY, camera, bridge, targetDisplay);
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

    const clickX = e.offsetX;
    const clickY = e.offsetY;

    const snapshot = bridge.getLatestSnapshot();
    if (!snapshot) return;

    // Check each body's screen distance from click
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
      const body = snapshot.bodies.find(b => b.id === nearestBodyId);
      const store = useGameStore.getState();
      store.showTravelDialog({
        destination: { type: 'body', bodyId: nearestBodyId },
        targetName: body?.name ?? nearestBodyId,
        accelerationG: 1.0,
      });
    } else {
      const simPos = camera.screenToSim(clickX, clickY);
      bridge.sendCommand({
        type: 'SET_DESTINATION',
        shipId: bridge.getMyShipId(),
        destination: { type: 'point', position: simPos },
      });
    }
  });

  // Double-click → focus on nearest body
  canvas.addEventListener('dblclick', (e) => {
    const simPos = camera.screenToSim(e.offsetX, e.offsetY);
    let closest: string | null = null;
    let closestDist = Infinity;

    const snapshot = bridge.getLatestSnapshot();
    if (!snapshot) return;

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
      camera.resetFocusPan();
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
        // Priority chain: modal → travel dialog → target → left panel → cancel route
        if (store.modal) {
          store.dismissModal();
        } else if (store.travelDialog) {
          store.dismissTravelDialog();
        } else if (targetDisplay.active) {
          targetDisplay.dismiss();
        } else if (store.leftPanelOpen) {
          store.closeLeftPanel();
        } else {
          bridge.sendCommand({ type: 'CANCEL_ROUTE', shipId: bridge.getMyShipId() });
        }
        break;

    }
  });
}

/** Handle left-click: hit-test bodies for targeting, dismiss if empty space */
function handleLeftClick(
  clickX: number,
  clickY: number,
  camera: Camera,
  bridge: ISimulationBridge,
  targetDisplay: TargetDisplay,
): void {
  const store = useGameStore.getState();
  const snapshot = bridge.getLatestSnapshot();
  if (!snapshot) return;

  // Close left panel on map click
  if (store.leftPanelOpen) {
    store.closeLeftPanel();
  }

  // Hit-test bodies
  let nearestBodyId: string | null = null;
  let nearestBodyType: BodyType | null = null;
  let nearestDist = Infinity;

  for (const body of snapshot.bodies) {
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
