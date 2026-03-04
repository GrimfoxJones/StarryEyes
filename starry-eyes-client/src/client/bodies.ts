import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import type { BodySnapshot } from '../simulation/types.ts';
import { computeOrbitalEllipse } from '../simulation/kepler.ts';
import { MIN_BODY_PIXEL_RADIUS } from '../simulation/constants.ts';
import type { Camera } from './camera.ts';

const LABEL_STYLE = new TextStyle({
  fontFamily: 'Consolas, Courier New, monospace',
  fontSize: 10,
  fill: '#88aacc',
  letterSpacing: 1,
});

export class BodyRenderer {
  private bodyGraphics: Map<string, Graphics> = new Map();
  private orbitGraphics: Map<string, Graphics> = new Map();
  private labelTexts: Map<string, Text> = new Map();
  private container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  update(bodies: readonly BodySnapshot[], camera: Camera): void {
    const usedIds = new Set<string>();

    for (const body of bodies) {
      usedIds.add(body.id);

      // Render orbit ellipse (only for non-star bodies with elements)
      if (body.elements && body.type !== 'star') {
        let orbitGfx = this.orbitGraphics.get(body.id);
        if (!orbitGfx) {
          orbitGfx = new Graphics();
          this.container.addChild(orbitGfx);
          this.orbitGraphics.set(body.id, orbitGfx);
        }
        this.drawOrbitEllipse(orbitGfx, body, camera);
      }

      // Render body circle
      let gfx = this.bodyGraphics.get(body.id);
      if (!gfx) {
        gfx = new Graphics();
        this.container.addChild(gfx);
        this.bodyGraphics.set(body.id, gfx);
      }
      this.drawBody(gfx, body, camera);

      // Label (skip asteroids to reduce clutter)
      if (body.type !== 'asteroid') {
        let label = this.labelTexts.get(body.id);
        if (!label) {
          label = new Text({ text: body.name.toUpperCase(), style: LABEL_STYLE });
          label.alpha = 0.6;
          this.container.addChild(label);
          this.labelTexts.set(body.id, label);
        }
        const screen = camera.simToScreen(body.position.x, body.position.y);
        label.x = screen.x + 8;
        label.y = screen.y - 4;
      }
    }

    // Cleanup removed bodies
    for (const [id, gfx] of this.bodyGraphics) {
      if (!usedIds.has(id)) {
        this.container.removeChild(gfx);
        gfx.destroy();
        this.bodyGraphics.delete(id);
      }
    }
  }

  private drawBody(gfx: Graphics, body: BodySnapshot, camera: Camera): void {
    const screen = camera.simToScreen(body.position.x, body.position.y);

    // Minimum pixel radius for visibility
    const simRadius = body.radius * camera.scale;
    const pixelRadius = Math.max(simRadius, MIN_BODY_PIXEL_RADIUS);

    // Star gets a glow effect
    const alpha = body.type === 'star' ? 1.0 :
                  body.type === 'asteroid' ? 0.6 : 0.9;

    gfx.clear();
    gfx.circle(0, 0, pixelRadius);
    gfx.fill({ color: body.color, alpha });

    // Star glow
    if (body.type === 'star') {
      gfx.circle(0, 0, pixelRadius * 2);
      gfx.fill({ color: body.color, alpha: 0.15 });
    }

    gfx.x = screen.x;
    gfx.y = screen.y;
  }

  private drawOrbitEllipse(gfx: Graphics, body: BodySnapshot, camera: Camera): void {
    if (!body.elements) return;

    // Skip orbits that are too large or too small on screen
    const orbitScreenRadius = body.elements.a * camera.scale;
    if (orbitScreenRadius < 5 || orbitScreenRadius > 100000) {
      gfx.clear();
      return;
    }

    const points = computeOrbitalEllipse(body.elements, 128);

    gfx.clear();

    const alpha = body.type === 'asteroid' ? 0.05 : 0.15;

    let started = false;
    for (let i = 0; i < points.length; i++) {
      const p = camera.simToScreen(points[i].x, points[i].y);

      if (!started) {
        gfx.moveTo(p.x, p.y);
        started = true;
      } else {
        gfx.lineTo(p.x, p.y);
      }
    }

    gfx.stroke({ width: 1, color: body.color, alpha });
  }

  destroy(): void {
    for (const gfx of this.bodyGraphics.values()) gfx.destroy();
    for (const gfx of this.orbitGraphics.values()) gfx.destroy();
    for (const txt of this.labelTexts.values()) txt.destroy();
    this.bodyGraphics.clear();
    this.orbitGraphics.clear();
    this.labelTexts.clear();
  }
}
