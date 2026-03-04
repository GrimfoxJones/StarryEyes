import type { Vec2 } from '../simulation/types.ts';

export class Camera {
  // Camera center in simulation coordinates
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
  private panStartX = 0;
  private panStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;

  // Focus tracking
  focusTarget: string | null = null;

  get scale(): number {
    return Math.pow(this.zoomBase, this.zoomLevel);
  }

  /** Set initial zoom to show system (~2 AU across the viewport) */
  initForSystem(): void {
    // Show ~2e12 m across (a bit beyond Jupiter's orbit)
    const targetScale = this.viewportWidth / (2e12);
    this.zoomLevel = Math.log(targetScale) / Math.log(this.zoomBase);
  }

  resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /** Simulation → screen coordinates */
  simToScreen(simX: number, simY: number): { x: number; y: number } {
    return {
      x: (simX - this.x) * this.scale + this.viewportWidth / 2,
      y: -(simY - this.y) * this.scale + this.viewportHeight / 2, // flip Y
    };
  }

  /** Screen → simulation coordinates */
  screenToSim(screenX: number, screenY: number): Vec2 {
    return {
      x: (screenX - this.viewportWidth / 2) / this.scale + this.x,
      y: -(screenY - this.viewportHeight / 2) / this.scale + this.y,
    };
  }

  /** Handle mouse wheel zoom (toward cursor position) */
  zoom(delta: number, screenX: number, screenY: number): void {
    // Get sim position under cursor before zoom
    const simBefore = this.screenToSim(screenX, screenY);

    // Adjust zoom level
    this.zoomLevel += delta > 0 ? -3 : 3;

    // Clamp by actual scale value
    const minLevel = Math.log(this.minScale) / Math.log(this.zoomBase);
    const maxLevel = Math.log(this.maxScale) / Math.log(this.zoomBase);
    this.zoomLevel = Math.max(minLevel, Math.min(maxLevel, this.zoomLevel));

    // Get sim position under cursor after zoom
    const simAfter = this.screenToSim(screenX, screenY);

    // Adjust camera to keep cursor position stable
    this.x += simBefore.x - simAfter.x;
    this.y += simBefore.y - simAfter.y;
  }

  /** Start pan operation */
  startPan(screenX: number, screenY: number): void {
    this.isPanning = true;
    this.panStartX = screenX;
    this.panStartY = screenY;
    this.cameraStartX = this.x;
    this.cameraStartY = this.y;
    this.focusTarget = null;
  }

  /** Continue pan operation */
  movePan(screenX: number, screenY: number): void {
    if (!this.isPanning) return;
    const dx = screenX - this.panStartX;
    const dy = screenY - this.panStartY;
    this.x = this.cameraStartX - dx / this.scale;
    this.y = this.cameraStartY + dy / this.scale; // flip Y
  }

  /** End pan operation */
  endPan(): void {
    this.isPanning = false;
  }

  /** Focus camera on a simulation point */
  focusOn(simX: number, simY: number): void {
    this.x = simX;
    this.y = simY;
  }

  get panning(): boolean {
    return this.isPanning;
  }
}
