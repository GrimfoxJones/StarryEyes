import { Graphics, Container } from 'pixi.js';

const ACCENT = 0x00d4ff;
const LINE_THICKNESS = 1;
const GLOW_THICKNESS = 4;
const GLOW_ALPHA = 0.12;

/**
 * Diagonal line from reticle to info box, with a 90° elbow.
 * All coordinates are in screen space (absolute).
 */
export class ConnectorLine {
  readonly container = new Container();
  private glow = new Graphics();
  private main = new Graphics();

  constructor() {
    this.container.addChild(this.glow);
    this.container.addChild(this.main);
    this.container.visible = false;
  }

  /**
   * Draw the connector.
   * @param startX/Y - reticle center (screen coords)
   * @param elbowX/Y - where the line turns vertical
   * @param endX/Y - info box anchor
   * @param progress - 0→1 how much of the line to draw
   * @param alpha - overall alpha
   */
  draw(
    startX: number, startY: number,
    elbowX: number, elbowY: number,
    endX: number, endY: number,
    progress: number, alpha: number,
  ): void {
    this.container.visible = true;
    this.glow.clear();
    this.main.clear();

    if (progress <= 0 || alpha <= 0) {
      this.container.visible = false;
      return;
    }

    // Total path: start→elbow + elbow→end
    const seg1Dx = elbowX - startX;
    const seg1Dy = elbowY - startY;
    const seg1Len = Math.sqrt(seg1Dx * seg1Dx + seg1Dy * seg1Dy);

    const seg2Dx = endX - elbowX;
    const seg2Dy = endY - elbowY;
    const seg2Len = Math.sqrt(seg2Dx * seg2Dx + seg2Dy * seg2Dy);

    const totalLen = seg1Len + seg2Len;
    const drawnLen = totalLen * progress;

    if (drawnLen <= 0) return;

    // Segment 1
    const seg1Drawn = Math.min(drawnLen, seg1Len);
    const seg1T = seg1Len > 0 ? seg1Drawn / seg1Len : 1;
    const mid1X = startX + seg1Dx * seg1T;
    const mid1Y = startY + seg1Dy * seg1T;

    this.drawSegment(this.glow, startX, startY, mid1X, mid1Y, GLOW_THICKNESS, GLOW_ALPHA * alpha);
    this.drawSegment(this.main, startX, startY, mid1X, mid1Y, LINE_THICKNESS, alpha);

    // Segment 2 (if we've passed the elbow)
    if (drawnLen > seg1Len && seg2Len > 0) {
      const seg2Drawn = Math.min(drawnLen - seg1Len, seg2Len);
      const seg2T = seg2Drawn / seg2Len;
      const mid2X = elbowX + seg2Dx * seg2T;
      const mid2Y = elbowY + seg2Dy * seg2T;

      this.drawSegment(this.glow, elbowX, elbowY, mid2X, mid2Y, GLOW_THICKNESS, GLOW_ALPHA * alpha);
      this.drawSegment(this.main, elbowX, elbowY, mid2X, mid2Y, LINE_THICKNESS, alpha);
    }
  }

  hide(): void {
    this.container.visible = false;
    this.glow.clear();
    this.main.clear();
  }

  private drawSegment(
    gfx: Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
    width: number, alpha: number,
  ): void {
    gfx.moveTo(x1, y1);
    gfx.lineTo(x2, y2);
    gfx.stroke({ width, color: ACCENT, alpha });
  }
}
