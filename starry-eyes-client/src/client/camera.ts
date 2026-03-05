import type { Vec2, BodySnapshot } from '@starryeyes/shared';
import type { SOIEntry } from '@starryeyes/shared';

export class Camera {
  // Camera center in local (reference-frame) coordinates
  x = 0;
  y = 0;

  // Logarithmic zoom: actual scale = BASE^zoomLevel
  // scale = pixels per meter. At system view (~2e11m across 800px): ~4e-9
  // At close-up (~1e7m across 800px): ~8e-5
  private zoomLevel = 0;
  private readonly zoomBase = 1.05;
  private readonly minScale = 1e-10;  // full system view
  private readonly maxScale = 1e-3;   // very close zoom

  // Viewport size
  viewportWidth = 800;
  viewportHeight = 600;

  // Pan state
  private isPanning = false;
  private lastPanScreenX = 0;
  private lastPanScreenY = 0;

  // Focus tracking with pan offset
  focusTarget: string | null = null;
  private focusPanX = 0;
  private focusPanY = 0;

  // Reference frame: heliocentric position of the reference body
  referenceOffset: Vec2 = { x: 0, y: 0 };
  referenceBodyId = 'sol';

  get scale(): number {
    return Math.pow(this.zoomBase, this.zoomLevel);
  }

  /** Set initial zoom to show system (~2 AU across the viewport) */
  initForSystem(): void {
    const targetScale = this.viewportWidth / (2e12);
    this.zoomLevel = Math.log(targetScale) / Math.log(this.zoomBase);
  }

  resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /** Simulation → screen coordinates (subtracts referenceOffset for local frame) */
  simToScreen(simX: number, simY: number): { x: number; y: number } {
    return {
      x: (simX - this.referenceOffset.x - this.x) * this.scale + this.viewportWidth / 2,
      y: -(simY - this.referenceOffset.y - this.y) * this.scale + this.viewportHeight / 2,
    };
  }

  /** Screen → simulation coordinates (adds referenceOffset back) */
  screenToSim(screenX: number, screenY: number): Vec2 {
    return {
      x: (screenX - this.viewportWidth / 2) / this.scale + this.x + this.referenceOffset.x,
      y: -(screenY - this.viewportHeight / 2) / this.scale + this.y + this.referenceOffset.y,
    };
  }

  /**
   * Update the camera's reference frame based on what the camera is looking at.
   * Only planets can be reference bodies.
   */
  updateReferenceFrame(
    bodies: readonly BodySnapshot[],
    planetSOIs: readonly SOIEntry[],
  ): void {
    // Compute heliocentric position of camera center
    const helioX = this.x + this.referenceOffset.x;
    const helioY = this.y + this.referenceOffset.y;

    // Determine the star ID (fallback for "no planet SOI")
    const starId = bodies.find(b => b.type === 'star')?.id ?? this.referenceBodyId;

    // Find which planet SOI the camera center is inside
    let newRefId = starId;
    for (const entry of planetSOIs) {
      const body = bodies.find(b => b.id === entry.bodyId);
      if (!body) continue;

      const dx = helioX - body.position.x;
      const dy = helioY - body.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const isCurrentRef = entry.bodyId === this.referenceBodyId;
      const threshold = isCurrentRef ? entry.soiRadius * 1.2 : entry.soiRadius;

      if (dist < threshold) {
        newRefId = entry.bodyId;
        break;
      }
    }

    const isNewRefStar = bodies.find(b => b.id === newRefId)?.type === 'star';

    if (newRefId === this.referenceBodyId) {
      // Same reference body — update its position (it moves each frame)
      if (!isNewRefStar) {
        const body = bodies.find(b => b.id === newRefId);
        if (body) {
          const dx = body.position.x - this.referenceOffset.x;
          const dy = body.position.y - this.referenceOffset.y;
          this.x -= dx;
          this.y -= dy;
          this.referenceOffset = body.position;
        }
      }
      return;
    }

    // Reference body changed — adjust camera so the view doesn't jump
    const newOffset = isNewRefStar
      ? { x: 0, y: 0 }
      : (bodies.find(b => b.id === newRefId)?.position ?? { x: 0, y: 0 });

    this.x = helioX - newOffset.x;
    this.y = helioY - newOffset.y;
    this.referenceOffset = newOffset;
    this.referenceBodyId = newRefId;
  }

  /** Handle mouse wheel zoom (toward cursor position) */
  zoom(delta: number, screenX: number, screenY: number): void {
    const simBefore = this.screenToSim(screenX, screenY);

    this.zoomLevel += delta > 0 ? -3 : 3;

    const minLevel = Math.log(this.minScale) / Math.log(this.zoomBase);
    const maxLevel = Math.log(this.maxScale) / Math.log(this.zoomBase);
    this.zoomLevel = Math.max(minLevel, Math.min(maxLevel, this.zoomLevel));

    const simAfter = this.screenToSim(screenX, screenY);

    this.x += simBefore.x - simAfter.x;
    this.y += simBefore.y - simAfter.y;
  }

  /** Start pan operation */
  startPan(screenX: number, screenY: number): void {
    this.isPanning = true;
    this.lastPanScreenX = screenX;
    this.lastPanScreenY = screenY;
  }

  /** Continue pan operation (incremental — no snap issues on state changes) */
  movePan(screenX: number, screenY: number): void {
    if (!this.isPanning) return;
    const dx = screenX - this.lastPanScreenX;
    const dy = screenY - this.lastPanScreenY;
    this.lastPanScreenX = screenX;
    this.lastPanScreenY = screenY;

    if (this.focusTarget) {
      this.focusPanX -= dx / this.scale;
      this.focusPanY += dy / this.scale;
    } else {
      this.x -= dx / this.scale;
      this.y += dy / this.scale;
    }
  }

  /** End pan operation */
  endPan(): void {
    this.isPanning = false;
  }

  /** Focus camera on a simulation point (in heliocentric coords).
   *  Applies accumulated pan offset. Breaks focus if body scrolls off screen. */
  focusOn(simX: number, simY: number): void {
    const bodyLocalX = simX - this.referenceOffset.x;
    const bodyLocalY = simY - this.referenceOffset.y;

    // Where would the body appear on screen with current pan offset?
    const bodyScreenX = -this.focusPanX * this.scale + this.viewportWidth / 2;
    const bodyScreenY = this.focusPanY * this.scale + this.viewportHeight / 2;
    const margin = 100;
    if (bodyScreenX < -margin || bodyScreenX > this.viewportWidth + margin ||
        bodyScreenY < -margin || bodyScreenY > this.viewportHeight + margin) {
      // Body is off screen — break focus, camera stays where it is
      this.x = bodyLocalX + this.focusPanX;
      this.y = bodyLocalY + this.focusPanY;
      this.focusTarget = null;
      this.focusPanX = 0;
      this.focusPanY = 0;
      return;
    }

    this.x = bodyLocalX + this.focusPanX;
    this.y = bodyLocalY + this.focusPanY;
  }

  /** Clear focus pan offset (call when setting a new focus target) */
  resetFocusPan(): void {
    this.focusPanX = 0;
    this.focusPanY = 0;
  }

  get panning(): boolean {
    return this.isPanning;
  }
}
