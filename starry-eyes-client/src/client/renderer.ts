import { Application, Container, Graphics } from 'pixi.js';
import type { SystemSnapshot } from '@starryeyes/shared';
import { Camera } from './camera.ts';
import { BodyRenderer } from './bodies.ts';
import { TargetDisplay } from './targeting/TargetDisplay.ts';

export class GameRenderer {
  app: Application;
  camera: Camera;

  // Containers
  worldContainer: Container;
  uiContainer: Container;

  // Sub-renderers
  bodyRenderer: BodyRenderer;
  targetDisplay: TargetDisplay;

  private shipGraphics: Graphics;
  private predictionGraphics: Graphics;
  private trailGraphics: Graphics;
  private starfieldGraphics: Graphics;

  constructor(app: Application) {
    this.app = app;
    this.camera = new Camera();

    // World container (camera-transformed)
    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    // UI container (screen-space, always on top)
    this.uiContainer = new Container();
    this.app.stage.addChild(this.uiContainer);

    // Starfield background (screen-space, behind everything)
    this.starfieldGraphics = new Graphics();
    this.app.stage.addChildAt(this.starfieldGraphics, 0);

    // Sub-renderers
    this.bodyRenderer = new BodyRenderer(this.worldContainer);
    this.targetDisplay = new TargetDisplay(this.camera);
    this.uiContainer.addChild(this.targetDisplay.container);

    // Ship graphics
    this.shipGraphics = new Graphics();
    this.worldContainer.addChild(this.shipGraphics);

    // Prediction and trail (drawn in world space)
    this.predictionGraphics = new Graphics();
    this.worldContainer.addChild(this.predictionGraphics);
    this.trailGraphics = new Graphics();
    this.worldContainer.addChild(this.trailGraphics);

    // Initial sizing
    this.handleResize();
    this.camera.initForSystem();
    this.drawStarfield();
  }

  handleResize(): void {
    this.camera.resize(this.app.screen.width, this.app.screen.height);
    this.drawStarfield();
  }

  private drawStarfield(): void {
    this.starfieldGraphics.clear();
  }

  render(snapshot: SystemSnapshot): void {
    // Update body rendering
    this.bodyRenderer.update(snapshot.bodies, this.camera);

    // Update ship rendering
    this.renderShips(snapshot);
  }

  renderPrediction(points: ReadonlyArray<{ readonly x: number; readonly y: number }>): void {
    this.predictionGraphics.clear();
    if (points.length < 2) return;

    const dashLen = 8;
    const gapLen = 6;
    let drawing = true;
    let segmentDist = 0;

    const first = this.camera.simToScreen(points[0].x, points[0].y);
    let prevX = first.x;
    let prevY = first.y;

    this.predictionGraphics.moveTo(prevX, prevY);

    for (let i = 1; i < points.length; i++) {
      const screen = this.camera.simToScreen(points[i].x, points[i].y);

      // Skip points with extreme coordinates
      if (Math.abs(screen.x) > 1e6 || Math.abs(screen.y) > 1e6) {
        prevX = screen.x;
        prevY = screen.y;
        drawing = true;
        segmentDist = 0;
        continue;
      }

      const dx = screen.x - prevX;
      const dy = screen.y - prevY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Skip very small segments
      if (dist < 0.5) {
        prevX = screen.x;
        prevY = screen.y;
        continue;
      }

      let remaining = dist;
      const ux = dx / dist;
      const uy = dy / dist;
      let cx = prevX;
      let cy = prevY;

      while (remaining > 0) {
        const threshold = drawing ? dashLen : gapLen;
        const step = Math.min(remaining, threshold - segmentDist);

        cx += ux * step;
        cy += uy * step;
        remaining -= step;
        segmentDist += step;

        if (drawing) {
          this.predictionGraphics.lineTo(cx, cy);
        } else {
          this.predictionGraphics.moveTo(cx, cy);
        }

        if (segmentDist >= threshold) {
          drawing = !drawing;
          segmentDist = 0;
        }
      }

      prevX = screen.x;
      prevY = screen.y;
    }

    this.predictionGraphics.stroke({ width: 1.5, color: 0x00ccff, alpha: 0.4 });
  }

  renderTrail(points: ReadonlyArray<{ readonly x: number; readonly y: number }>): void {
    this.trailGraphics.clear();
    if (points.length < 2) return;

    // Draw as a single polyline with uniform alpha (much cheaper than per-segment stroke)
    const first = this.camera.simToScreen(points[0].x, points[0].y);
    this.trailGraphics.moveTo(first.x, first.y);

    for (let i = 1; i < points.length; i++) {
      const p = this.camera.simToScreen(points[i].x, points[i].y);
      if (Math.abs(p.x) > 1e6 || Math.abs(p.y) > 1e6) continue;
      this.trailGraphics.lineTo(p.x, p.y);
    }

    this.trailGraphics.stroke({ width: 1, color: 0x00ccff, alpha: 0.4 });
  }

  private renderShips(snapshot: SystemSnapshot): void {
    this.shipGraphics.clear();

    for (const ship of snapshot.ships) {
      const screen = this.camera.simToScreen(ship.position.x, ship.position.y);
      const headingAngle = Math.atan2(ship.heading.y, ship.heading.x);

      // Draw directional triangle (chevron shape)
      const size = 10;
      const angle1 = headingAngle + Math.PI * 0.8;
      const angle2 = headingAngle - Math.PI * 0.8;

      const tipX = screen.x + Math.cos(headingAngle) * size;
      const tipY = screen.y - Math.sin(headingAngle) * size; // flip Y
      const leftX = screen.x + Math.cos(angle1) * size * 0.7;
      const leftY = screen.y - Math.sin(angle1) * size * 0.7;
      const rightX = screen.x + Math.cos(angle2) * size * 0.7;
      const rightY = screen.y - Math.sin(angle2) * size * 0.7;

      this.shipGraphics.moveTo(tipX, tipY);
      this.shipGraphics.lineTo(leftX, leftY);
      this.shipGraphics.lineTo(screen.x, screen.y);
      this.shipGraphics.lineTo(rightX, rightY);
      this.shipGraphics.closePath();
      this.shipGraphics.fill({ color: 0x00ffcc, alpha: 0.9 });

      // Thrust flame
      if (ship.mode === 'transit') {
        const flameAngle = headingAngle + Math.PI; // opposite to heading
        const flameLen = size * 0.8;
        const flameTipX = screen.x + Math.cos(flameAngle) * flameLen;
        const flameTipY = screen.y - Math.sin(flameAngle) * flameLen;
        const flameSpread = Math.PI * 0.15;

        const fl1X = screen.x + Math.cos(flameAngle + flameSpread) * size * 0.3;
        const fl1Y = screen.y - Math.sin(flameAngle + flameSpread) * size * 0.3;
        const fl2X = screen.x + Math.cos(flameAngle - flameSpread) * size * 0.3;
        const fl2Y = screen.y - Math.sin(flameAngle - flameSpread) * size * 0.3;

        this.shipGraphics.moveTo(fl1X, fl1Y);
        this.shipGraphics.lineTo(flameTipX, flameTipY);
        this.shipGraphics.lineTo(fl2X, fl2Y);
        this.shipGraphics.fill({ color: 0xff6600, alpha: 0.8 });
      }
    }
  }
}

