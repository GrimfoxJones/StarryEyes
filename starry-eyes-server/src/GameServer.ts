import type {
  CelestialBody,
  ShipState,
  ShipSnapshot,
  SystemSnapshot,
  PlayerCommand,
  Vec2,
  Route,
} from '@starryeyes/shared';
import {
  vec2, vec2Add, vec2Length, vec2Normalize, Vec2Zero,
  keplerPositionAtTime,
  transitPositionAtTime, sampleRouteAhead,
  computeRoute, brachistochroneFuelCost,
  createDefaultBodies, createPlayerShip,
  SHIP_FUEL_CAPACITY,
  ORBIT_VISUAL_RADIUS,
  ORBIT_VISUAL_SPEED,
} from '@starryeyes/shared';
import { TICK_RATE_MS, DEFAULT_TIME_COMPRESSION } from './config.js';
import type { SessionStore } from './session.js';
import {
  EVENT_SHIP_ROUTE_CHANGED,
  EVENT_SHIP_ARRIVED,
  EVENT_SHIP_CANCELLED,
} from './ws/events.js';

export class GameServer {
  bodies: CelestialBody[];
  ships: ShipState[] = [];
  gameTime = 0;
  timeCompression = DEFAULT_TIME_COMPRESSION;
  bodyPositions: Map<string, Vec2> = new Map();

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime = 0;
  private broadcastFn: (message: string) => void;

  constructor(_sessions: SessionStore, broadcastFn: (message: string) => void) {
    this.broadcastFn = broadcastFn;
    this.bodies = createDefaultBodies();
    this.updateBodyPositions();
  }

  start(): void {
    this.lastTickTime = performance.now();
    this.tickInterval = setInterval(() => this.tick(), TICK_RATE_MS);
    console.log(`Game loop started (target ${1000 / TICK_RATE_MS}Hz)`);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  // ── Ship management ──────────────────────────────────────────────

  addShip(shipId: string): ShipState {
    const ship = createPlayerShip(this.bodies, this.gameTime, shipId);
    this.ships.push(ship);
    return ship;
  }

  removeShip(shipId: string): void {
    this.ships = this.ships.filter(s => s.id !== shipId);
  }

  // ── Body position helpers ────────────────────────────────────────

  getBodyPosition(bodyId: string): Vec2 {
    if (bodyId === 'sol') return Vec2Zero;
    return this.bodyPositions.get(bodyId) ?? Vec2Zero;
  }

  bodyPositionAtTime(bodyId: string, t: number): Vec2 {
    if (bodyId === 'sol') return Vec2Zero;
    const body = this.bodies.find(b => b.id === bodyId);
    if (!body || !body.elements) return Vec2Zero;

    if (body.parentId && body.parentId !== 'sol') {
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

  // ── Commands ─────────────────────────────────────────────────────

  processCommand(cmd: PlayerCommand): { ship?: ShipSnapshot; route?: Route | null; fuelConsumed?: number; fuelRemaining?: number } {
    switch (cmd.type) {
      case 'SET_DESTINATION': {
        const ship = this.ships.find(s => s.id === cmd.shipId);
        if (!ship) return {};

        const route = computeRoute(
          ship,
          cmd.destination,
          this.gameTime,
          this.bodies,
          (bodyId, t) => this.bodyPositionAtTime(bodyId, t),
        );
        if (!route) return {};

        const fuelCost = brachistochroneFuelCost(route.totalTime, ship.fuelConsumptionRate);
        if (fuelCost > ship.fuel) return {};

        ship.route = {
          ...route,
          fuelAtRouteStart: ship.fuel,
          fuelConsumptionRate: ship.fuelConsumptionRate,
        };
        ship.mode = 'transit';
        ship.orbitBodyId = null;

        this.broadcast(EVENT_SHIP_ROUTE_CHANGED, {
          ship: this.shipSnapshot(ship),
        });

        return {
          ship: this.shipSnapshot(ship),
          route,
          fuelConsumed: fuelCost,
          fuelRemaining: ship.fuel,
        };
      }

      case 'CANCEL_ROUTE': {
        const ship = this.ships.find(s => s.id === cmd.shipId);
        if (!ship) return {};

        if (ship.mode === 'transit' && ship.route) {
          // Settle fuel at cancellation time
          const elapsed = this.gameTime - ship.route.startTime;
          ship.fuel = ship.route.fuelAtRouteStart - ship.route.fuelConsumptionRate * elapsed;
          const result = transitPositionAtTime(ship.route, this.gameTime);
          ship.position = result.position;
          ship.velocity = result.velocity;
          ship.route = null;
          ship.mode = 'drift';
          ship.orbitBodyId = null;
        } else if (ship.mode === 'drift') {
          ship.velocity = Vec2Zero;
          ship.mode = 'drift';
        } else {
          ship.route = null;
          ship.mode = 'drift';
          ship.orbitBodyId = null;
        }

        this.broadcast(EVENT_SHIP_CANCELLED, {
          ship: this.shipSnapshot(ship),
        });

        return { ship: this.shipSnapshot(ship) };
      }

      case 'UNDOCK': {
        const ship = this.ships.find(s => s.id === cmd.shipId);
        if (!ship) return {};
        if (ship.mode === 'orbit') {
          ship.mode = 'drift';
          ship.velocity = Vec2Zero;
          ship.orbitBodyId = null;
        }
        return { ship: this.shipSnapshot(ship) };
      }

    }
  }

  // ── Tick loop ────────────────────────────────────────────────────

  private tick(): void {
    const now = performance.now();
    const realDt = (now - this.lastTickTime) / 1000; // actual seconds elapsed
    this.lastTickTime = now;

    const gameDt = realDt * this.timeCompression;
    this.gameTime += gameDt;
    this.updateBodyPositions();

    for (const ship of this.ships) {
      // Update orbiting ships
      if (ship.mode === 'orbit' && ship.orbitBodyId) {
        ship.orbitAngle += ORBIT_VISUAL_SPEED * realDt;
        const bodyPos = this.getBodyPosition(ship.orbitBodyId);
        ship.position = vec2Add(bodyPos, vec2(
          ORBIT_VISUAL_RADIUS * Math.cos(ship.orbitAngle),
          ORBIT_VISUAL_RADIUS * Math.sin(ship.orbitAngle),
        ));
      }

      if (ship.mode === 'transit') {
        if (!ship.route) {
          ship.mode = 'drift';
          continue;
        }

        const elapsed = this.gameTime - ship.route.startTime;

        // Continuous fuel consumption
        ship.fuel = ship.route.fuelAtRouteStart - ship.route.fuelConsumptionRate * elapsed;

        if (elapsed >= ship.route.totalTime) {
          // Final fuel value at end of route
          ship.fuel = ship.route.fuelAtRouteStart - ship.route.fuelConsumptionRate * ship.route.totalTime;
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

          this.broadcast(EVENT_SHIP_ARRIVED, {
            ship: this.shipSnapshot(ship),
          });
        }
      }
    }
  }

  // ── Snapshots ────────────────────────────────────────────────────

  shipSnapshot(ship: ShipState): ShipSnapshot {
    let isDecelerating = false;
    let heading: Vec2 = vec2(1, 0);

    if (ship.route) {
      const result = transitPositionAtTime(ship.route, this.gameTime);
      heading = result.heading;
      isDecelerating = result.isDecelerating;
    } else if (ship.mode === 'drift' && vec2Length(ship.velocity) > 1e-6) {
      heading = vec2Normalize(ship.velocity);
    }

    let destinationName: string | null = null;
    if (ship.route) {
      if (ship.route.targetBodyId) {
        const body = this.bodies.find(b => b.id === ship.route!.targetBodyId);
        destinationName = body ? body.name : ship.route.targetBodyId;
      } else {
        destinationName = 'SPACE';
      }
    }

    let eta: number | null = null;
    if (ship.route) {
      eta = Math.max(0, ship.route.totalTime - (this.gameTime - ship.route.startTime));
    }

    const routeLine = ship.route ? sampleRouteAhead(ship.route, this.gameTime, 20) : null;

    return {
      id: ship.id,
      position: ship.position,
      velocity: ship.velocity,
      heading,
      mode: ship.mode,
      fuel: ship.fuel,
      maxFuel: SHIP_FUEL_CAPACITY,
      fuelConsumptionRate: ship.fuelConsumptionRate,
      speed: vec2Length(ship.velocity),
      destinationName,
      eta,
      routeLine,
      isDecelerating,
      route: ship.route,
      orbitBodyId: ship.orbitBodyId,
    };
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
      ships: this.ships.map(s => this.shipSnapshot(s)),
    };
  }

  private broadcast(type: string, data: unknown): void {
    const message = JSON.stringify({ type, gameTime: this.gameTime, data });
    this.broadcastFn(message);
  }
}
