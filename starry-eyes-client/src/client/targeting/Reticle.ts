import { Graphics, Container } from 'pixi.js';

const ACCENT = 0x00d4ff;
const BRACKET_LENGTH = 10;
const BRACKET_THICKNESS = 1.5;
const GLOW_THICKNESS = 4;
const GLOW_ALPHA = 0.15;
const MARGIN = 6;

/**
 * Four L-shaped corner brackets forming a targeting reticle.
 * Drawn in screen space at a given position and radius.
 */
export class Reticle {
  readonly container = new Container();
  private glow = new Graphics();
  private main = new Graphics();

  constructor() {
    this.container.addChild(this.glow);
    this.container.addChild(this.main);
    this.container.visible = false;
  }

  /**
   * Draw the reticle centered at (0,0) of the container.
   * Position the container externally via container.x/y.
   * @param bodyPixelRadius - visible pixel radius of the body
   * @param scale - animation scale (2x→1x during snap)
   * @param alpha - overall alpha (for pulse/fade)
   */
  draw(bodyPixelRadius: number, scale: number, alpha: number): void {
    this.container.visible = true;
    this.glow.clear();
    this.main.clear();

    const r = (bodyPixelRadius + MARGIN) * scale;
    const len = BRACKET_LENGTH * scale;

    // Draw 4 L-brackets (each corner)
    const corners = [
      { sx: -1, sy: -1 }, // top-left
      { sx: 1, sy: -1 },  // top-right
      { sx: 1, sy: 1 },   // bottom-right
      { sx: -1, sy: 1 },  // bottom-left
    ];

    for (const { sx, sy } of corners) {
      const cx = sx * r;
      const cy = sy * r;

      // Horizontal arm
      this.drawLine(this.glow, cx, cy, cx - sx * len, cy, GLOW_THICKNESS, ACCENT, GLOW_ALPHA * alpha);
      this.drawLine(this.main, cx, cy, cx - sx * len, cy, BRACKET_THICKNESS, ACCENT, alpha);

      // Vertical arm
      this.drawLine(this.glow, cx, cy, cx, cy - sy * len, GLOW_THICKNESS, ACCENT, GLOW_ALPHA * alpha);
      this.drawLine(this.main, cx, cy, cx, cy - sy * len, BRACKET_THICKNESS, ACCENT, alpha);
    }
  }

  hide(): void {
    this.container.visible = false;
    this.glow.clear();
    this.main.clear();
  }

  private drawLine(
    gfx: Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
    width: number, color: number, alpha: number,
  ): void {
    gfx.moveTo(x1, y1);
    gfx.lineTo(x2, y2);
    gfx.stroke({ width, color, alpha });
  }
}
