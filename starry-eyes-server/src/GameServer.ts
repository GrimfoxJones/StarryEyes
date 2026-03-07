import type {
  CelestialBody,
  ShipState,
  ShipSnapshot,
  SystemSnapshot,
  PlayerCommand,
  Vec2,
  Route,
  SubsystemCommand,
  CargoManifest,
  CommodityId,
  TradeResult,
} from '@starryeyes/shared';
import {
  vec2, vec2Add, vec2Length, vec2Normalize, Vec2Zero,
  keplerPositionAtTime,
  bodyVelocityAtTime as bodyVelocityAtTimeHelper,
  transitPositionAtTime, sampleRouteAhead,
  computeRoute, brachistochroneFuelCost,
  DARTER_MASS,
  ORBIT_VISUAL_RADIUS,
  ORBIT_VISUAL_SPEED,
  generateSystem, systemToBodies, findStartingBody,
  getSystemSeed, getGateConnections, getGateConnectionInfo,
  TIME_COMPRESSION,
  COMMODITY_DEFS,
} from '@starryeyes/shared';
import type { GeneratedSystem, GateConnectionInfo } from '@starryeyes/shared';
import { EconomySimulator } from './economy/EconomySimulator.js';
import { TICK_RATE_MS } from './config.js';
import { SubsystemSimulator } from './subsystems/SubsystemSimulator.js';
import { EVENT_SUBSYSTEM_UPDATE } from './ws/events.js';
import type { SessionStore } from './session.js';
import {
  EVENT_SHIP_ROUTE_CHANGED,
  EVENT_SHIP_ARRIVED,
  EVENT_SHIP_CANCELLED,
  EVENT_PLAYER_JOINED,
  EVENT_PLAYER_LEFT,
} from './ws/events.js';

interface CachedSystem {
  system: GeneratedSystem;
  bodies: CelestialBody[];
}

export class GameServer {
  ships: ShipState[] = [];
  gameTime = 0;

  // Per-system state
  worldSeed: number = 42;
  private systemCache = new Map<number, CachedSystem>();
  playerSystems = new Map<string, number>(); // shipId → system index
  private bodyPositionsPerSystem = new Map<number, Map<string, Vec2>>();

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime = 0;
  private broadcastFn: (message: string) => void;
  private sessions: SessionStore;
  private shipSubsystems = new Map<string, SubsystemSimulator>();
  private subsystemTickCounter = 0;

  // Economy
  private economyPerSystem = new Map<number, EconomySimulator>();
  shipCargo = new Map<string, CargoManifest>();
  playerCredits = new Map<string, number>();
  playerCostBasis = new Map<string, Partial<Record<CommodityId, number>>>();
  private static STARTING_CREDITS = 10000;
  private economyTickAccumulator = 0;
  private static ECONOMY_TICK_INTERVAL = 3600; // game-seconds per economy tick (1 game-hour)

  constructor(sessions: SessionStore, broadcastFn: (message: string) => void) {
    this.broadcastFn = broadcastFn;
    this.sessions = sessions;
    // Initialize default system at index 0
    this.getOrGenerateSystem(0);
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

  // ── System management ──────────────────────────────────────────────

  getOrGenerateSystem(index: number): CachedSystem {
    let cached = this.systemCache.get(index);
    if (cached) return cached;

    const seed = getSystemSeed(this.worldSeed, index);
    const system = generateSystem(seed, index);
    const bodies = systemToBodies(system, this.gameTime);
    cached = { system, bodies };
    this.systemCache.set(index, cached);

    // Initialize body positions
    const positions = new Map<string, Vec2>();
    this.bodyPositionsPerSystem.set(index, positions);
    this.updateBodyPositionsForSystem(index);

    // Initialize economy simulator for this system
    if (!this.economyPerSystem.has(index) && Object.keys(system.stations).length > 0) {
      this.economyPerSystem.set(index, new EconomySimulator(system.stations, system, index));
    }

    return cached;
  }

  getBodiesForSystem(systemIndex: number): CelestialBody[] {
    return this.getOrGenerateSystem(systemIndex).bodies;
  }

  getGeneratedSystemFor(systemIndex: number): GeneratedSystem {
    return this.getOrGenerateSystem(systemIndex).system;
  }

  private getSystemIndexForShip(shipId: string): number {
    return this.playerSystems.get(shipId) ?? 0;
  }

  getEconomy(systemIndex: number): EconomySimulator | undefined {
    return this.economyPerSystem.get(systemIndex);
  }

  getCargoMass(shipId: string): number {
    const cargo = this.shipCargo.get(shipId);
    if (!cargo) return 0;
    let total = 0;
    for (const [cid, qty] of Object.entries(cargo)) {
      total += (qty as number) * COMMODITY_DEFS[cid as CommodityId].baseMass;
    }
    return total;
  }

  // ── Ship management ──────────────────────────────────────────────

  addShip(shipId: string, systemIndex = 0): ShipState {
    this.playerSystems.set(shipId, systemIndex);
    const cached = this.getOrGenerateSystem(systemIndex);
    const startBodyId = findStartingBody(cached.system);
    const ship = this.createShipAtBody(shipId, startBodyId, systemIndex);
    this.ships.push(ship);
    this.shipSubsystems.set(shipId, new SubsystemSimulator());
    this.shipCargo.set(shipId, {});
    this.playerCredits.set(shipId, GameServer.STARTING_CREDITS);
    this.playerCostBasis.set(shipId, {});
    return ship;
  }

  private createShipAtBody(shipId: string, bodyId: string | null, systemIndex: number): ShipState {
    let position: Vec2;
    let mode: 'orbit' | 'drift' = 'drift';
    let orbitBodyId: string | null = null;

    if (bodyId) {
      const bodyPos = this.getBodyPosition(bodyId, systemIndex);
      position = vec2Add(bodyPos, vec2(ORBIT_VISUAL_RADIUS, 0));
      mode = 'orbit';
      orbitBodyId = bodyId;
    } else {
      const dist = 2 * 1.496e11;
      position = vec2(dist, 0);
    }

    return {
      id: shipId,
      position,
      velocity: Vec2Zero,
      maxAcceleration: DARTER_MASS.maxAcceleration,
      fuel: DARTER_MASS.maxPropellant,
      fuelConsumptionRate: DARTER_MASS.fuelConsumptionRate,
      mode,
      route: null,
      orbitBodyId,
      orbitAngle: 0,
    };
  }

  removeShip(shipId: string): void {
    this.ships = this.ships.filter(s => s.id !== shipId);
    this.playerSystems.delete(shipId);
    this.shipSubsystems.delete(shipId);
    this.shipCargo.delete(shipId);
    this.playerCredits.delete(shipId);
    this.playerCostBasis.delete(shipId);
  }

  // ── Body position helpers ────────────────────────────────────────

  getBodyPosition(bodyId: string, systemIndex: number): Vec2 {
    const bodies = this.getBodiesForSystem(systemIndex);
    const body = bodies.find(b => b.id === bodyId);
    if (body && body.type === 'star') return Vec2Zero;
    const positions = this.bodyPositionsPerSystem.get(systemIndex);
    return positions?.get(bodyId) ?? Vec2Zero;
  }

  bodyPositionAtTime(bodyId: string, t: number, systemIndex: number): Vec2 {
    const bodies = this.getBodiesForSystem(systemIndex);
    const body = bodies.find(b => b.id === bodyId);
    if (!body || !body.elements) return Vec2Zero;

    if (body.parentId) {
      const parent = bodies.find(b => b.id === body.parentId);
      if (parent && parent.type !== 'star') {
        const parentPos = this.bodyPositionAtTime(body.parentId, t, systemIndex);
        const localPos = keplerPositionAtTime(body.elements, t);
        return vec2Add(parentPos, localPos);
      }
    }

    return keplerPositionAtTime(body.elements, t);
  }

  bodyVelocityAtTime(bodyId: string, t: number, systemIndex: number): Vec2 {
    const bodies = this.getBodiesForSystem(systemIndex);
    return bodyVelocityAtTimeHelper(bodyId, t, bodies, (id, time) => this.bodyPositionAtTime(id, time, systemIndex));
  }

  private updateBodyPositionsForSystem(systemIndex: number): void {
    const cached = this.systemCache.get(systemIndex);
    if (!cached) return;
    let positions = this.bodyPositionsPerSystem.get(systemIndex);
    if (!positions) {
      positions = new Map();
      this.bodyPositionsPerSystem.set(systemIndex, positions);
    }

    for (const body of cached.bodies) {
      if (body.elements === null) {
        positions.set(body.id, Vec2Zero);
      } else if (body.parentId) {
        const parent = cached.bodies.find(b => b.id === body.parentId);
        if (parent && parent.type !== 'star') {
          const parentPos = positions.get(body.parentId) ?? Vec2Zero;
          const localPos = keplerPositionAtTime(body.elements, this.gameTime);
          positions.set(body.id, vec2Add(parentPos, localPos));
        } else {
          positions.set(body.id, keplerPositionAtTime(body.elements, this.gameTime));
        }
      }
    }
  }

  private updateAllActiveBodyPositions(): void {
    // Only update systems that have players
    const activeSystems = new Set<number>();
    for (const sysIndex of this.playerSystems.values()) {
      activeSystems.add(sysIndex);
    }
    for (const sysIndex of activeSystems) {
      this.updateBodyPositionsForSystem(sysIndex);
    }
  }

  // ── System randomization ────────────────────────────────────────

  randomizeSystem(seed?: number): { seed: number; starName: string; planetCount: number; bodies: CelestialBody[] } {
    this.worldSeed = seed ?? Math.floor(Math.random() * 0xFFFFFFFF);
    this.systemCache.clear();
    this.bodyPositionsPerSystem.clear();
    this.economyPerSystem.clear();

    // Reset all players to system 0
    for (const ship of this.ships) {
      this.playerSystems.set(ship.id, 0);
    }

    const cached = this.getOrGenerateSystem(0);
    const startBodyId = findStartingBody(cached.system);

    for (const ship of this.ships) {
      if (startBodyId) {
        const bodyPos = this.getBodyPosition(startBodyId, 0);
        ship.position = vec2Add(bodyPos, vec2(ORBIT_VISUAL_RADIUS, 0));
        ship.mode = 'orbit';
        ship.orbitBodyId = startBodyId;
        ship.orbitAngle = 0;
      } else {
        const dist = 2 * 1.496e11 * Math.sqrt(cached.system.star.luminositySolar);
        ship.position = vec2(dist, 0);
        ship.mode = 'drift';
        ship.orbitBodyId = null;
      }
      ship.velocity = Vec2Zero;
      ship.route = null;
      ship.fuel = DARTER_MASS.maxPropellant;
    }

    // Broadcast full refresh to all
    this.broadcast('SYSTEM_CHANGED', {
      seed: this.worldSeed,
      snapshot: this.snapshotForSystem(0),
    });

    return {
      seed: this.worldSeed,
      starName: cached.system.star.name,
      planetCount: cached.system.planets.length,
      bodies: cached.bodies,
    };
  }

  // ── Gate connections ────────────────────────────────────────────

  getGateConnectionsForSystem(systemIndex: number): GateConnectionInfo[] {
    return getGateConnectionInfo(this.worldSeed, systemIndex);
  }

  // ── Commands ─────────────────────────────────────────────────────

  processCommand(cmd: PlayerCommand): { ship?: ShipSnapshot; route?: Route | null; fuelConsumed?: number; fuelRemaining?: number; tradeResult?: TradeResult; refuelResult?: { success: boolean; amount: number; cost: number; error?: string } } {
    switch (cmd.type) {
      case 'SET_DESTINATION': {
        const ship = this.ships.find(s => s.id === cmd.shipId);
        if (!ship) return {};
        const sysIndex = this.getSystemIndexForShip(cmd.shipId);
        const bodies = this.getBodiesForSystem(sysIndex);

        // If orbiting, inject body velocity so computeRoute sees initial speed
        const savedVelocity = ship.velocity;
        if (ship.mode === 'orbit' && ship.orbitBodyId) {
          ship.velocity = this.bodyVelocityAtTime(ship.orbitBodyId, this.gameTime, sysIndex);
        }

        const route = computeRoute(
          ship,
          cmd.destination,
          this.gameTime,
          bodies,
          (bodyId, t) => this.bodyPositionAtTime(bodyId, t, sysIndex),
          cmd.acceleration,
        );
        if (!route) {
          ship.velocity = savedVelocity;
          return {};
        }

        const accelRatio = (cmd.acceleration ?? ship.maxAcceleration) / ship.maxAcceleration;
        const scaledFuelRate = ship.fuelConsumptionRate * accelRatio;
        const fuelCost = brachistochroneFuelCost(route.totalTime, scaledFuelRate);
        if (fuelCost > ship.fuel) {
          ship.velocity = savedVelocity;
          return {};
        }

        ship.route = {
          ...route,
          fuelAtRouteStart: ship.fuel,
          fuelConsumptionRate: scaledFuelRate,
        };
        ship.mode = 'transit';
        ship.orbitBodyId = null;

        this.broadcastToSystem(sysIndex, EVENT_SHIP_ROUTE_CHANGED, {
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
        const sysIndex = this.getSystemIndexForShip(cmd.shipId);

        if (ship.mode === 'transit' && ship.route) {
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

        this.broadcastToSystem(sysIndex, EVENT_SHIP_CANCELLED, {
          ship: this.shipSnapshot(ship),
        });

        return { ship: this.shipSnapshot(ship) };
      }

      case 'UNDOCK': {
        const ship = this.ships.find(s => s.id === cmd.shipId);
        if (!ship) return {};
        const sysIndex = this.getSystemIndexForShip(cmd.shipId);
        if (ship.mode === 'orbit' && ship.orbitBodyId) {
          ship.mode = 'drift';
          ship.velocity = this.bodyVelocityAtTime(ship.orbitBodyId, this.gameTime, sysIndex);
          ship.orbitBodyId = null;
        }
        return { ship: this.shipSnapshot(ship) };
      }

      case 'JUMP_GATE': {
        return this.processJumpGate(cmd.shipId, cmd.targetSystemIndex);
      }

      case 'BUY_COMMODITY':
      case 'SELL_COMMODITY': {
        return this.processTrade(cmd);
      }

      case 'REFUEL': {
        return this.processRefuel(cmd.shipId, cmd.amount);
      }
    }
  }

  static REFUEL_PRICE_PER_KG = 5; // credits per kg of propellant

  private processRefuel(shipId: string, requestedAmount: number): { refuelResult?: { success: boolean; amount: number; cost: number; error?: string } } {
    const ship = this.ships.find(s => s.id === shipId);
    if (!ship) return { refuelResult: { success: false, amount: 0, cost: 0, error: 'Ship not found' } };

    // Must be orbiting a station
    if (ship.mode !== 'orbit' || !ship.orbitBodyId) {
      return { refuelResult: { success: false, amount: 0, cost: 0, error: 'Not docked at a station' } };
    }

    const sysIndex = this.getSystemIndexForShip(shipId);
    const cached = this.getOrGenerateSystem(sysIndex);
    const station = cached.system.stations[ship.orbitBodyId];
    if (!station) {
      return { refuelResult: { success: false, amount: 0, cost: 0, error: 'No station here' } };
    }

    const maxRefuel = DARTER_MASS.maxPropellant - ship.fuel;
    const amount = Math.min(requestedAmount, maxRefuel);
    if (amount <= 0) {
      return { refuelResult: { success: false, amount: 0, cost: 0, error: 'Tanks already full' } };
    }

    const cost = Math.round(amount * GameServer.REFUEL_PRICE_PER_KG);
    const credits = this.playerCredits.get(shipId) ?? 0;
    if (credits < cost) {
      // Refuel as much as they can afford
      const affordableAmount = Math.floor(credits / GameServer.REFUEL_PRICE_PER_KG);
      if (affordableAmount <= 0) {
        return { refuelResult: { success: false, amount: 0, cost: 0, error: 'Insufficient credits' } };
      }
      const actualCost = Math.round(affordableAmount * GameServer.REFUEL_PRICE_PER_KG);
      ship.fuel += affordableAmount;
      this.playerCredits.set(shipId, credits - actualCost);
      return { refuelResult: { success: true, amount: affordableAmount, cost: actualCost } };
    }

    ship.fuel += amount;
    this.playerCredits.set(shipId, credits - cost);
    return { refuelResult: { success: true, amount, cost } };
  }

  private processTrade(cmd: PlayerCommand & { type: 'BUY_COMMODITY' | 'SELL_COMMODITY' }): { tradeResult?: TradeResult } {
    const ship = this.ships.find(s => s.id === cmd.shipId);
    if (!ship) return { tradeResult: { success: false, commodityId: cmd.commodityId as CommodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: 'Ship not found' } };

    // Must be orbiting the station
    if (ship.mode !== 'orbit' || ship.orbitBodyId !== cmd.stationId) {
      return { tradeResult: { success: false, commodityId: cmd.commodityId as CommodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: 'Not docked at this station' } };
    }

    const sysIndex = this.getSystemIndexForShip(cmd.shipId);
    const economy = this.economyPerSystem.get(sysIndex);
    if (!economy) {
      return { tradeResult: { success: false, commodityId: cmd.commodityId as CommodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: 'No economy in this system' } };
    }

    const isBuy = cmd.type === 'BUY_COMMODITY';
    const commodityId = cmd.commodityId as CommodityId;
    const cargo = this.shipCargo.get(cmd.shipId) ?? {};

    const credits = this.playerCredits.get(cmd.shipId) ?? 0;
    const costBasis = this.playerCostBasis.get(cmd.shipId) ?? {};

    if (isBuy) {
      // Check cargo capacity
      const cargoMass = this.getCargoMass(cmd.shipId);
      const addedMass = cmd.quantity * COMMODITY_DEFS[commodityId].baseMass;
      if (cargoMass + addedMass > DARTER_MASS.maxCargo) {
        return { tradeResult: { success: false, commodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: 'Cargo capacity exceeded' } };
      }
    } else {
      // Check player has enough to sell
      const held = cargo[commodityId] ?? 0;
      if (held < cmd.quantity) {
        return { tradeResult: { success: false, commodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: 'Insufficient cargo' } };
      }
    }

    // Pre-check: get the price from economy to validate credits for buy
    const listings = economy.getMarketListings(cmd.stationId);
    const listing = listings.find(l => l.commodityId === commodityId);
    if (isBuy && listing) {
      const totalCost = listing.price * cmd.quantity;
      if (credits < totalCost) {
        return { tradeResult: { success: false, commodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: 'Insufficient credits' } };
      }
    }

    const result = economy.executeTrade(cmd.stationId, commodityId, cmd.quantity, isBuy);
    if (!result.success) {
      return { tradeResult: result };
    }

    // Update credits and cargo
    if (isBuy) {
      this.playerCredits.set(cmd.shipId, credits - result.totalPrice);
      // Update cost basis (weighted average)
      const oldQty = cargo[commodityId] ?? 0;
      const oldAvg = costBasis[commodityId] ?? 0;
      const newAvg = (oldAvg * oldQty + result.unitPrice * cmd.quantity) / (oldQty + cmd.quantity);
      costBasis[commodityId] = newAvg;
      cargo[commodityId] = oldQty + cmd.quantity;
    } else {
      this.playerCredits.set(cmd.shipId, credits + result.totalPrice);
      cargo[commodityId] = (cargo[commodityId] ?? 0) - cmd.quantity;
      if (cargo[commodityId]! <= 0) {
        delete cargo[commodityId];
        delete costBasis[commodityId];
      }
    }
    this.shipCargo.set(cmd.shipId, cargo);
    this.playerCostBasis.set(cmd.shipId, costBasis);

    // Broadcast market update to subscribers
    this.broadcastMarketUpdate(sysIndex, cmd.stationId);

    return { tradeResult: result };
  }

  private processJumpGate(shipId: string, targetSystemIndex: number): { ship?: ShipSnapshot } {
    const ship = this.ships.find(s => s.id === shipId);
    if (!ship) return {};

    const currentIndex = this.getSystemIndexForShip(shipId);
    const currentBodies = this.getBodiesForSystem(currentIndex);

    // Verify ship is orbiting the gate
    const gateBody = currentBodies.find(b => b.type === 'gate');
    if (!gateBody || ship.orbitBodyId !== gateBody.id) {
      return {}; // Not at gate
    }

    // Verify target is a valid connection
    const connections = getGateConnections(this.worldSeed, currentIndex);
    if (!connections.includes(targetSystemIndex)) {
      return {}; // Invalid destination
    }

    // Generate/cache target system
    const targetCached = this.getOrGenerateSystem(targetSystemIndex);
    const targetGate = targetCached.bodies.find(b => b.type === 'gate');

    // Place ship at target gate
    if (targetGate) {
      const gatePos = this.getBodyPosition(targetGate.id, targetSystemIndex);
      ship.position = vec2Add(gatePos, vec2(ORBIT_VISUAL_RADIUS, 0));
      ship.orbitBodyId = targetGate.id;
    } else {
      ship.position = vec2(2 * 1.496e11, 0);
      ship.orbitBodyId = null;
    }
    ship.mode = 'orbit';
    ship.velocity = Vec2Zero;
    ship.route = null;
    ship.orbitAngle = 0;

    // Broadcast PLAYER_LEFT to old system
    this.broadcastToSystem(currentIndex, EVENT_PLAYER_LEFT, {
      shipId,
    });

    // Update system tracking
    this.playerSystems.set(shipId, targetSystemIndex);

    // Send SYSTEM_CHANGED to jumping player only
    this.sendToPlayer(shipId, 'SYSTEM_CHANGED', {
      seed: getSystemSeed(this.worldSeed, targetSystemIndex),
      systemIndex: targetSystemIndex,
      snapshot: this.snapshotForSystem(targetSystemIndex),
    });

    // Broadcast PLAYER_JOINED to new system
    this.broadcastToSystem(targetSystemIndex, EVENT_PLAYER_JOINED, {
      shipId,
      ship: this.shipSnapshot(ship),
    });

    return { ship: this.shipSnapshot(ship) };
  }

  /** Debug-only: teleport a ship to any system, skipping gate/connection checks. */
  debugJumpToSystem(shipId: string, targetSystemIndex: number): { ship?: ShipSnapshot } {
    const ship = this.ships.find(s => s.id === shipId);
    if (!ship) return {};

    const currentIndex = this.getSystemIndexForShip(shipId);

    // Generate/cache target system
    const targetCached = this.getOrGenerateSystem(targetSystemIndex);
    const targetGate = targetCached.bodies.find(b => b.type === 'gate');

    // Place ship at target gate
    if (targetGate) {
      const gatePos = this.getBodyPosition(targetGate.id, targetSystemIndex);
      ship.position = vec2Add(gatePos, vec2(ORBIT_VISUAL_RADIUS, 0));
      ship.orbitBodyId = targetGate.id;
    } else {
      ship.position = vec2(2 * 1.496e11, 0);
      ship.orbitBodyId = null;
    }
    ship.mode = 'orbit';
    ship.velocity = Vec2Zero;
    ship.route = null;
    ship.orbitAngle = 0;

    // Broadcast PLAYER_LEFT to old system
    this.broadcastToSystem(currentIndex, EVENT_PLAYER_LEFT, { shipId });

    // Update system tracking
    this.playerSystems.set(shipId, targetSystemIndex);

    // Send SYSTEM_CHANGED to jumping player only
    this.sendToPlayer(shipId, 'SYSTEM_CHANGED', {
      seed: getSystemSeed(this.worldSeed, targetSystemIndex),
      systemIndex: targetSystemIndex,
      snapshot: this.snapshotForSystem(targetSystemIndex),
    });

    // Broadcast PLAYER_JOINED to new system
    this.broadcastToSystem(targetSystemIndex, EVENT_PLAYER_JOINED, {
      shipId,
      ship: this.shipSnapshot(ship),
    });

    return { ship: this.shipSnapshot(ship) };
  }

  // ── Tick loop ────────────────────────────────────────────────────

  private tick(): void {
    const now = performance.now();
    const realDt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    const gameDt = realDt * TIME_COMPRESSION;
    this.gameTime += gameDt;
    this.updateAllActiveBodyPositions();

    for (const ship of this.ships) {
      const sysIndex = this.getSystemIndexForShip(ship.id);

      // Update orbiting ships
      if (ship.mode === 'orbit' && ship.orbitBodyId) {
        ship.orbitAngle += ORBIT_VISUAL_SPEED * realDt;
        const bodyPos = this.getBodyPosition(ship.orbitBodyId, sysIndex);
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
          ship.fuel = ship.route.fuelAtRouteStart - ship.route.fuelConsumptionRate * ship.route.totalTime;
          if (ship.route.targetBodyId) {
            const bodyPos = this.getBodyPosition(ship.route.targetBodyId, sysIndex);
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

          this.broadcastToSystem(sysIndex, EVENT_SHIP_ARRIVED, {
            ship: this.shipSnapshot(ship),
          });
        }
      }
    }

    // Subsystem updates at ~1Hz (every 20 ticks at 20Hz)
    this.subsystemTickCounter++;
    if (this.subsystemTickCounter >= 20) {
      this.subsystemTickCounter = 0;
      this.tickSubsystems(gameDt * 20);
    }

    // Economy tick every game-hour
    this.economyTickAccumulator += gameDt;
    if (this.economyTickAccumulator >= GameServer.ECONOMY_TICK_INTERVAL) {
      const hours = this.economyTickAccumulator / 3600;
      this.economyTickAccumulator = 0;
      for (const [sysIndex, economy] of this.economyPerSystem) {
        economy.tick(hours);
        // Broadcast market updates to subscribers
        this.broadcastEconomyUpdates(sysIndex);
      }
    }
  }

  private tickSubsystems(gameDt: number): void {
    for (const session of this.sessions.allConnected()) {
      if (!session.subsystemsSubscribed) continue;
      const sim = this.shipSubsystems.get(session.shipId);
      const ship = this.ships.find(s => s.id === session.shipId);
      if (!sim || !ship) continue;

      const sysIndex = this.getSystemIndexForShip(session.shipId);
      const bodies = this.getBodiesForSystem(sysIndex);
      const bodyName = (id: string) => bodies.find(b => b.id === id)?.name ?? id;
      sim.tick(gameDt, ship, this.gameTime, bodyName);
      const snapshot = sim.snapshot(this.gameTime);

      if (session.ws && session.ws.readyState === 1) {
        session.ws.send(JSON.stringify({
          type: EVENT_SUBSYSTEM_UPDATE,
          gameTime: this.gameTime,
          data: snapshot,
        }));
      }
    }
  }

  handleSubsystemCommand(shipId: string, data: unknown): void {
    const sim = this.shipSubsystems.get(shipId);
    if (!sim || !data) return;
    sim.applyCommand(data as SubsystemCommand);
  }

  // ── Market broadcasts ──────────────────────────────────────────

  private broadcastEconomyUpdates(systemIndex: number): void {
    const economy = this.economyPerSystem.get(systemIndex);
    if (!economy) return;

    for (const session of this.sessions.allConnected()) {
      if (!session.marketSubscription) continue;
      const shipSysIndex = this.playerSystems.get(session.shipId) ?? 0;
      if (shipSysIndex !== systemIndex) continue;

      const listings = economy.getMarketListings(session.marketSubscription);
      if (listings.length === 0) continue;

      if (session.ws && session.ws.readyState === 1) {
        session.ws.send(JSON.stringify({
          type: 'MARKET_UPDATE',
          gameTime: this.gameTime,
          data: { stationId: session.marketSubscription, listings },
        }));
      }
    }
  }

  broadcastMarketUpdate(systemIndex: number, stationId: string): void {
    const economy = this.economyPerSystem.get(systemIndex);
    if (!economy) return;

    const listings = economy.getMarketListings(stationId);
    for (const session of this.sessions.allConnected()) {
      if (session.marketSubscription !== stationId) continue;
      if (session.ws && session.ws.readyState === 1) {
        session.ws.send(JSON.stringify({
          type: 'MARKET_UPDATE',
          gameTime: this.gameTime,
          data: { stationId, listings },
        }));
      }
    }
  }

  // ── Snapshots ────────────────────────────────────────────────────

  shipSnapshot(ship: ShipState): ShipSnapshot {
    const sysIndex = this.getSystemIndexForShip(ship.id);
    const bodies = this.getBodiesForSystem(sysIndex);

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
        const body = bodies.find(b => b.id === ship.route!.targetBodyId);
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
      maxFuel: DARTER_MASS.maxPropellant,
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

  snapshotForSystem(systemIndex: number): SystemSnapshot {
    const cached = this.getOrGenerateSystem(systemIndex);
    const positions = this.bodyPositionsPerSystem.get(systemIndex) ?? new Map();

    const systemShips = this.ships.filter(s =>
      (this.playerSystems.get(s.id) ?? 0) === systemIndex
    );

    return {
      gameTime: this.gameTime,
      bodies: cached.bodies.map(b => {
        const station = cached.system.stations[b.id];
        return {
          id: b.id,
          name: b.name,
          type: b.type,
          mass: b.mass,
          position: positions.get(b.id) ?? Vec2Zero,
          radius: b.radius,
          color: b.color,
          elements: b.elements,
          parentId: b.parentId,
          planetClass: b.planetClass,
          ...(station ? { hasStation: true, stationArchetype: station.archetype } : {}),
          ...(cached.system.settledBodies[b.id] ? { isSettled: true } : {}),
          ...(b.type === 'star' ? {
            starInfo: {
              spectralClass: cached.system.star.spectralClass,
              spectralSubclass: cached.system.star.spectralSubclass,
              luminosityClass: cached.system.star.luminosityClass,
              surfaceTemperature: cached.system.star.surfaceTemperature,
              luminositySolar: cached.system.star.luminositySolar,
              massSolar: cached.system.star.mass / 1.989e30,
              age: cached.system.star.age,
            },
          } : {}),
        };
      }),
      ships: systemShips.map(s => this.shipSnapshot(s)),
    };
  }

  // Legacy snapshot: uses player's system or system 0
  snapshot(): SystemSnapshot {
    return this.snapshotForSystem(0);
  }

  snapshotForPlayer(shipId: string): SystemSnapshot {
    const sysIndex = this.getSystemIndexForShip(shipId);
    return this.snapshotForSystem(sysIndex);
  }

  // ── Broadcasting ──────────────────────────────────────────────────

  private broadcast(type: string, data: unknown): void {
    const message = JSON.stringify({ type, gameTime: this.gameTime, data });
    this.broadcastFn(message);
  }

  broadcastToSystem(systemIndex: number, type: string, data: unknown): void {
    const message = JSON.stringify({ type, gameTime: this.gameTime, data });
    for (const session of this.sessions.allConnected()) {
      const shipSysIndex = this.playerSystems.get(session.shipId) ?? 0;
      if (shipSysIndex === systemIndex && session.ws && session.ws.readyState === 1) {
        session.ws.send(message);
      }
    }
  }

  private sendToPlayer(shipId: string, type: string, data: unknown): void {
    const message = JSON.stringify({ type, gameTime: this.gameTime, data });
    for (const session of this.sessions.allConnected()) {
      if (session.shipId === shipId && session.ws && session.ws.readyState === 1) {
        session.ws.send(message);
        break;
      }
    }
  }
}
