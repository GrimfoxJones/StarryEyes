import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import type { BodySnapshot } from '@starryeyes/shared';
import { computeOrbitalEllipse, MIN_BODY_PIXEL_RADIUS } from '@starryeyes/shared';
import type { Camera } from './camera.ts';

/** Below this screen-px distance to parent, moon is fully hidden */
const MOON_HIDE_PX = 20;
/** Between HIDE and FADE, moon alpha lerps 0→1 */
const MOON_FADE_PX = 40;

/** Returns true if a moon should be non-interactive (fully hidden at current zoom). */
export function isMoonHidden(
  body: BodySnapshot,
  bodies: readonly BodySnapshot[],
  camera: Camera,
): boolean {
  if ((body.type !== 'moon' && body.type !== 'station') || !body.parentId) return false;
  const parent = bodies.find(b => b.id === body.parentId);
  if (!parent) return false;
  const moonScreen = camera.simToScreen(body.position.x, body.position.y);
  const parentScreen = camera.simToScreen(parent.position.x, parent.position.y);
  const dx = moonScreen.x - parentScreen.x;
  const dy = moonScreen.y - parentScreen.y;
  return Math.sqrt(dx * dx + dy * dy) < MOON_HIDE_PX;
}

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

    // Build lookup for parent screen positions (needed for moon culling)
    const bodyById = new Map<string, BodySnapshot>();
    for (const b of bodies) bodyById.set(b.id, b);

    for (const body of bodies) {
      usedIds.add(body.id);

      // Moon visibility: fade out when close to parent on screen
      let moonAlpha = 1;
      if ((body.type === 'moon' || body.type === 'station') && body.parentId) {
        const parent = bodyById.get(body.parentId);
        if (parent) {
          const moonScreen = camera.simToScreen(body.position.x, body.position.y);
          const parentScreen = camera.simToScreen(parent.position.x, parent.position.y);
          const dx = moonScreen.x - parentScreen.x;
          const dy = moonScreen.y - parentScreen.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MOON_HIDE_PX) {
            moonAlpha = 0;
          } else if (dist < MOON_FADE_PX) {
            moonAlpha = (dist - MOON_HIDE_PX) / (MOON_FADE_PX - MOON_HIDE_PX);
          }
        }
      }

      // Render orbit ellipse (only for non-star bodies with elements)
      if (body.elements && body.type !== 'star') {
        let orbitGfx = this.orbitGraphics.get(body.id);
        if (!orbitGfx) {
          orbitGfx = new Graphics();
          this.container.addChild(orbitGfx);
          this.orbitGraphics.set(body.id, orbitGfx);
        }
        if (moonAlpha === 0) {
          orbitGfx.clear();
        } else {
          this.drawOrbitEllipse(orbitGfx, body, camera, bodyById, moonAlpha);
        }
      }

      // Render body circle
      let gfx = this.bodyGraphics.get(body.id);
      if (!gfx) {
        gfx = new Graphics();
        this.container.addChild(gfx);
        this.bodyGraphics.set(body.id, gfx);
      }
      if (moonAlpha === 0) {
        gfx.clear();
      } else {
        this.drawBody(gfx, body, camera, moonAlpha);
      }

      // Label (skip asteroids to reduce clutter)
      if (body.type !== 'asteroid') {
        let label = this.labelTexts.get(body.id);
        if (!label) {
          label = new Text({ text: body.name.toUpperCase(), style: LABEL_STYLE });
          label.alpha = 0.6;
          this.container.addChild(label);
          this.labelTexts.set(body.id, label);
        }
        if (moonAlpha === 0) {
          label.visible = false;
        } else {
          label.visible = true;
          label.alpha = 0.6 * moonAlpha;
          const screen = camera.simToScreen(body.position.x, body.position.y);
          label.x = screen.x + 8;
          label.y = screen.y - 4;
        }
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

  private drawBody(gfx: Graphics, body: BodySnapshot, camera: Camera, moonAlpha = 1): void {
    const screen = camera.simToScreen(body.position.x, body.position.y);

    // Minimum pixel radius for visibility
    const simRadius = body.radius * camera.scale;
    const pixelRadius = Math.max(simRadius, MIN_BODY_PIXEL_RADIUS);

    // Star gets a glow effect
    const baseAlpha = body.type === 'star' ? 1.0 :
                      body.type === 'asteroid' ? 0.6 : 0.9;
    const alpha = baseAlpha * moonAlpha;

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

  private drawOrbitEllipse(
    gfx: Graphics, body: BodySnapshot, camera: Camera,
    bodyById: Map<string, BodySnapshot>, moonAlpha = 1,
  ): void {
    if (!body.elements) return;

    // Skip orbits that are too large or too small on screen
    const orbitScreenRadius = body.elements.a * camera.scale;
    if (orbitScreenRadius < 5 || orbitScreenRadius > 100000) {
      gfx.clear();
      return;
    }

    const points = computeOrbitalEllipse(body.elements, 128);

    // Offset by parent body's heliocentric position (orbital ellipse points are parent-relative)
    let offsetX = 0;
    let offsetY = 0;
    if (body.parentId) {
      const parent = bodyById.get(body.parentId);
      if (parent) {
        offsetX = parent.position.x;
        offsetY = parent.position.y;
      }
    }

    gfx.clear();

    const baseAlpha = body.type === 'asteroid' ? 0.05 : 0.15;
    const alpha = baseAlpha * moonAlpha;

    let started = false;
    for (let i = 0; i < points.length; i++) {
      const p = camera.simToScreen(points[i].x + offsetX, points[i].y + offsetY);

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
