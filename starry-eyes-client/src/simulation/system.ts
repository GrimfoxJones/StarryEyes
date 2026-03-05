import type {
  CelestialBody,
  ShipState,
  SystemSnapshot,
  PlayerCommand,
  Vec2,
} from '@starryeyes/shared';
import {
  vec2, vec2Add, vec2Length, vec2Normalize, vec2Scale, Vec2Zero,
  keplerPositionAtTime,
  transitPositionAtTime, sampleRouteAhead,
  SHIP_FUEL_CAPACITY,
  ORBIT_VISUAL_RADIUS,
  ORBIT_VISUAL_SPEED,
  createDefaultBodies,
  createPlayerShip,
  processCommand,
} from '@starryeyes/shared';

// ── StarSystem ──────────────────────────────────────────────────────

export class StarSystem {
  bodies: CelestialBody[];
  ships: ShipState[];
  gameTime: number;
  timeCompression: number;

  bodyPositions: Map<string, Vec2> = new Map();

  constructor() {
    this.bodies = createDefaultBodies();
    this.gameTime = 0;
    this.timeCompression = 1000;
    this.updateBodyPositions();
    this.ships = [createPlayerShip(this.bodies, this.gameTime)];
  }

  getBodyPosition(bodyId: string): Vec2 {
    if (bodyId === 'sol') return Vec2Zero;
    return this.bodyPositions.get(bodyId) ?? Vec2Zero;
  }

  /** Compute global position of any body at arbitrary future time. */
  bodyPositionAtTime(bodyId: string, t: number): Vec2 {
    if (bodyId === 'sol') return Vec2Zero;
    const body = this.bodies.find(b => b.id === bodyId);
    if (!body || !body.elements) return Vec2Zero;

    if (body.parentId && body.parentId !== 'sol') {
      // Moon: parent position at time t + local orbital position
      const parentPos = this.bodyPositionAtTime(body.parentId, t);
      const localPos = keplerPositionAtTime(body.elements, t);
      return vec2Add(parentPos, localPos);
    }

    return keplerPositionAtTime(body.elements, t);
  }

  private updateBodyPositions(): void {
    for (const body of this.bodies) {
      if (body.elements === null) {
        this.bodyPositions.set(body.id, Vec2Zero);
      } else if (body.parentId && body.parentId !== 'sol') {
        const parentPos = this.bodyPositions.get(body.parentId) ?? Vec2Zero;
        const localPos = keplerPositionAtTime(body.elements, this.gameTime);
        this.bodyPositions.set(body.id, vec2Add(parentPos, localPos));
      } else {
        this.bodyPositions.set(body.id, keplerPositionAtTime(body.elements, this.gameTime));
      }
    }
  }

  command(cmd: PlayerCommand): void {
    processCommand(this, cmd);
  }

  tick(dt: number): SystemSnapshot {
    this.gameTime += dt;
    this.updateBodyPositions();

    for (const ship of this.ships) {
      switch (ship.mode) {
        case 'transit': {
          if (!ship.route) {
            ship.mode = 'drift';
            break;
          }

          const elapsed = this.gameTime - ship.route.startTime;

          if (elapsed >= ship.route.totalTime) {
            // Arrival
            if (ship.route.targetBodyId) {
              const bodyPos = this.getBodyPosition(ship.route.targetBodyId);
              ship.position = vec2Add(bodyPos, vec2(ORBIT_VISUAL_RADIUS, 0));
              ship.mode = 'orbit';
              ship.orbitBodyId = ship.route.targetBodyId;
              ship.orbitAngle = 0;
            } else {
              ship.position = ship.route.interceptPos;
              ship.mode = 'drift';
            }
            ship.velocity = Vec2Zero;
            ship.route = null;
          } else {
            const result = transitPositionAtTime(ship.route, this.gameTime);
            ship.position = result.position;
            ship.velocity = result.velocity;
          }
          break;
        }

        case 'orbit': {
          if (!ship.orbitBodyId) {
            ship.mode = 'drift';
            break;
          }

          // Use real dt for smooth visual rotation regardless of time compression
          const realDt = dt / this.timeCompression;
          ship.orbitAngle += ORBIT_VISUAL_SPEED * realDt;

          const bodyPos = this.getBodyPosition(ship.orbitBodyId);
          ship.position = vec2Add(bodyPos, vec2(
            ORBIT_VISUAL_RADIUS * Math.cos(ship.orbitAngle),
            ORBIT_VISUAL_RADIUS * Math.sin(ship.orbitAngle),
          ));
          ship.velocity = Vec2Zero;
          break;
        }

        case 'drift': {
          ship.position = vec2Add(ship.position, vec2Scale(ship.velocity, dt));
          break;
        }
      }
    }

    return this.snapshot();
  }

  snapshot(): SystemSnapshot {
    return {
      gameTime: this.gameTime,
      timeCompression: this.timeCompression,
      bodies: this.bodies.map(b => ({
        id: b.id,
        name: b.name,
        type: b.type,
        position: this.bodyPositions.get(b.id) ?? Vec2Zero,
        radius: b.radius,
        color: b.color,
        elements: b.elements,
        parentId: b.parentId,
      })),
      ships: this.ships.map(s => {
        let isDecelerating = false;
        let heading: Vec2 = vec2(1, 0);

        if (s.route) {
          const result = transitPositionAtTime(s.route, this.gameTime);
          heading = result.heading;
          isDecelerating = result.isDecelerating;
        } else if (s.mode === 'drift' && vec2Length(s.velocity) > 1e-6) {
          heading = vec2Normalize(s.velocity);
        }

        // Destination name
        let destinationName: string | null = null;
        if (s.route) {
          if (s.route.targetBodyId) {
            const body = this.bodies.find(b => b.id === s.route!.targetBodyId);
            destinationName = body ? body.name : s.route.targetBodyId;
          } else {
            destinationName = 'SPACE';
          }
        }

        // ETA
        let eta: number | null = null;
        if (s.route) {
          eta = Math.max(0, s.route.totalTime - (this.gameTime - s.route.startTime));
        }

        // Route line: sample the Bézier curve ahead
        const routeLine = s.route ? sampleRouteAhead(s.route, this.gameTime, 20) : null;

        return {
          id: s.id,
          position: s.position,
          velocity: s.velocity,
          heading,
          mode: s.mode,
          fuel: s.fuel,
          maxFuel: SHIP_FUEL_CAPACITY,
          fuelConsumptionRate: s.fuelConsumptionRate,
          speed: vec2Length(s.velocity),
          destinationName,
          eta,
          routeLine,
          isDecelerating,
          route: s.route,
          orbitBodyId: s.orbitBodyId,
        };
      }),
    };
  }

  predictTrajectory(shipId: string): Vec2[] {
    const ship = this.ships.find(s => s.id === shipId);
    if (!ship || !ship.route) return [];
    return sampleRouteAhead(ship.route, this.gameTime, 30);
  }
}
