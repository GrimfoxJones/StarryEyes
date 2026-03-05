import type {
  PlayerCommand,
  SystemSnapshot,
  ShipSnapshot,
  BodySnapshot,
  CelestialBody,
  Vec2,
} from '@starryeyes/shared';
import {
  vec2, vec2Add, vec2Scale, Vec2Zero,
  keplerPositionAtTime,
  transitPositionAtTime,
  ORBIT_VISUAL_RADIUS,
  ORBIT_VISUAL_SPEED,
  vec2Length,
  vec2Normalize,
  sampleRouteAhead,
  buildSOITable,
  determineSOIParent,
} from '@starryeyes/shared';
import type { SOIEntry } from '@starryeyes/shared';
import type { ISimulationBridge } from './bridge.ts';

interface JoinResponse {
  sessionToken: string;
  shipId: string;
  playerId: string;
  playerName: string;
  gameTime: number;
  timeCompression: number;
}

interface BodiesResponse {
  bodies: CelestialBody[];
}

export class RemoteBridge implements ISimulationBridge {
  private ws: WebSocket | null = null;
  private latestSnapshot: SystemSnapshot | null = null;
  private snapshotCallbacks = new Set<(s: SystemSnapshot) => void>();
  private serverUrl: string;
  private sessionToken = '';
  private shipId = '';
  private bodies: CelestialBody[] = [];
  private lastServerGameTime = 0;
  private lastSnapshotRealTime = 0;
  private timeCompression = 1000;
  private lastShips: readonly ShipSnapshot[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatIntervalMs: number;
  private soiTable: SOIEntry[] = [];
  private _soiParentId = 'sol';

  constructor(serverUrl = '', heartbeatIntervalMs = 1000) {
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.serverUrl = serverUrl;
  }

  getMyShipId(): string {
    return this.shipId;
  }

  getLatestSnapshot(): SystemSnapshot | null {
    return this.latestSnapshot;
  }

  getBodies(): CelestialBody[] {
    return this.bodies;
  }

  getSessionToken(): string {
    return this.sessionToken;
  }

  get soiParentId(): string {
    return this._soiParentId;
  }

  onSnapshot(cb: (s: SystemSnapshot) => void): () => void {
    this.snapshotCallbacks.add(cb);
    return () => { this.snapshotCallbacks.delete(cb); };
  }

  async connect(): Promise<void> {
    // 1. Join
    const joinRes = await fetch(`${this.serverUrl}/api/auth/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: `Player_${Date.now().toString(36)}` }),
    });
    const join: JoinResponse = await joinRes.json();
    this.sessionToken = join.sessionToken;
    this.shipId = join.shipId;
    this.lastServerGameTime = join.gameTime;
    this.timeCompression = join.timeCompression;
    this.lastSnapshotRealTime = performance.now();

    // 2. Fetch body definitions
    const bodiesRes = await fetch(`${this.serverUrl}/api/bodies`);
    const bodiesData: BodiesResponse = await bodiesRes.json();
    this.bodies = bodiesData.bodies;

    // Build SOI table for reference frame determination
    this.soiTable = buildSOITable(this.bodies);

    // 3. Open WebSocket
    await this.openWebSocket();

    // 4. Start heartbeat sync
    this.startHeartbeat();
  }

  disconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async sendCommand(cmd: PlayerCommand): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.sessionToken}`,
    };

    switch (cmd.type) {
      case 'SET_DESTINATION':
        await fetch(`${this.serverUrl}/api/commands/set-destination`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ destination: cmd.destination }),
        });
        break;
      case 'CANCEL_ROUTE':
        await fetch(`${this.serverUrl}/api/commands/cancel-route`, {
          method: 'POST',
          headers,
        });
        break;
      case 'UNDOCK':
        await fetch(`${this.serverUrl}/api/commands/undock`, {
          method: 'POST',
          headers,
        });
        break;
    }
  }

  // ── Local interpolation ──────────────────────────────────────────

  interpolate(): SystemSnapshot | null {
    if (this.lastShips.length === 0 && !this.latestSnapshot) return null;

    const now = performance.now();
    const elapsedReal = (now - this.lastSnapshotRealTime) / 1000;
    const localGameTime = this.lastServerGameTime + elapsedReal * this.timeCompression;

    // Compute body positions locally
    const bodySnapshots: BodySnapshot[] = this.bodies.map(b => ({
      id: b.id,
      name: b.name,
      type: b.type,
      position: this.bodyPositionAtTime(b.id, localGameTime),
      radius: b.radius,
      color: b.color,
      elements: b.elements,
      parentId: b.parentId,
    }));

    // Interpolate ship positions
    const ships: ShipSnapshot[] = this.lastShips.map(ship => {
      let position = ship.position;
      let velocity = ship.velocity;
      let heading = ship.heading;
      let isDecelerating = ship.isDecelerating;
      let fuel = ship.fuel;

      if (ship.mode === 'transit' && ship.route) {
        // Check for arrival clamp
        const routeEnd = ship.route.startTime + ship.route.totalTime;
        // Interpolate fuel consumption
        const routeElapsed = Math.min(localGameTime - ship.route.startTime, ship.route.totalTime);
        fuel = ship.route.fuelAtRouteStart - ship.route.fuelConsumptionRate * routeElapsed;

        if (localGameTime >= routeEnd) {
          // Clamp to destination, wait for server confirmation
          position = ship.route.interceptPos;
          velocity = Vec2Zero;
        } else {
          const result = transitPositionAtTime(ship.route, localGameTime);
          position = result.position;
          velocity = result.velocity;
          heading = result.heading;
          isDecelerating = result.isDecelerating;
        }
      } else if (ship.mode === 'orbit' && ship.orbitBodyId) {
        const realDtSinceSnapshot = elapsedReal;
        const bodyPos = this.bodyPositionAtTime(ship.orbitBodyId, localGameTime);
        // Approximate orbit angle advance using real time
        const baseAngle = Math.atan2(
          ship.position.y - this.bodyPositionAtTime(ship.orbitBodyId, this.lastServerGameTime).y,
          ship.position.x - this.bodyPositionAtTime(ship.orbitBodyId, this.lastServerGameTime).x,
        );
        const angle = baseAngle + ORBIT_VISUAL_SPEED * realDtSinceSnapshot;
        position = vec2Add(bodyPos, vec2(
          ORBIT_VISUAL_RADIUS * Math.cos(angle),
          ORBIT_VISUAL_RADIUS * Math.sin(angle),
        ));
        velocity = Vec2Zero;
      } else if (ship.mode === 'drift') {
        const gameTimeSinceSnapshot = localGameTime - this.lastServerGameTime;
        position = vec2Add(ship.position, vec2Scale(ship.velocity, gameTimeSinceSnapshot));
      }

      // Recompute derived fields
      const speed = vec2Length(velocity);
      if (ship.mode === 'drift' && speed > 1e-6) {
        heading = vec2Normalize(velocity);
      }

      let eta = ship.eta;
      if (ship.route) {
        eta = Math.max(0, ship.route.totalTime - (localGameTime - ship.route.startTime));
      }

      const routeLine = ship.route ? sampleRouteAhead(ship.route, localGameTime, 20) : null;

      return {
        ...ship,
        position,
        velocity,
        heading,
        isDecelerating,
        fuel,
        speed,
        eta,
        routeLine,
      };
    });

    // Determine SOI parent for the player ship
    const myShip = ships.find(s => s.id === this.shipId);
    if (myShip && this.soiTable.length > 0) {
      const bodyPositions = new Map<string, Vec2>();
      for (const b of bodySnapshots) {
        bodyPositions.set(b.id, b.position);
      }
      this._soiParentId = determineSOIParent(
        myShip.position,
        this._soiParentId,
        this.soiTable,
        bodyPositions,
      );
    }

    return {
      gameTime: localGameTime,
      timeCompression: this.timeCompression,
      bodies: bodySnapshots,
      ships,
    };
  }

  // ── WebSocket ────────────────────────────────────────────────────

  private openWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = this.serverUrl || `${protocol}//${window.location.host}`;
      const wsUrl = `${host.replace(/^http/, 'ws')}/ws?token=${this.sessionToken}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectDelay = 1000;
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data as string);
      };

      this.ws.onclose = () => {
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        reject(new Error('WebSocket connection failed'));
      };
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openWebSocket().catch(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        this.scheduleReconnect();
      });
    }, this.reconnectDelay);
  }

  private handleMessage(raw: string): void {
    const msg = JSON.parse(raw) as { type: string; gameTime: number; data: unknown };

    switch (msg.type) {
      case 'INITIAL_STATE': {
        const state = msg.data as SystemSnapshot;
        this.applyServerSnapshot(state);
        break;
      }

      case 'SHIP_ROUTE_CHANGED':
      case 'SHIP_ARRIVED':
      case 'SHIP_CANCELLED': {
        const data = msg.data as { ship: ShipSnapshot };
        // Re-anchor time to server's gameTime to prevent drift
        this.lastServerGameTime = msg.gameTime;
        this.lastSnapshotRealTime = performance.now();
        this.lastShips = this.lastShips.map(s =>
          s.id === data.ship.id ? data.ship : s,
        );
        this.pushInterpolatedSnapshot();
        break;
      }

      case 'PLAYER_JOINED': {
        const data = msg.data as { shipId: string; ship: ShipSnapshot | null };
        if (data.ship) {
          this.lastShips = [...this.lastShips, data.ship];
          this.pushInterpolatedSnapshot();
        }
        break;
      }

      case 'PLAYER_LEFT': {
        const data = msg.data as { shipId: string };
        this.lastShips = this.lastShips.filter(s => s.id !== data.shipId);
        this.pushInterpolatedSnapshot();
        break;
      }
    }
  }

  private applyServerSnapshot(state: SystemSnapshot): void {
    this.lastServerGameTime = state.gameTime;
    this.lastSnapshotRealTime = performance.now();
    this.timeCompression = state.timeCompression;
    this.lastShips = state.ships;
    this.latestSnapshot = state;
    this.notifyCallbacks(state);
  }

  private notifyCallbacks(snapshot: SystemSnapshot): void {
    for (const cb of this.snapshotCallbacks) {
      cb(snapshot);
    }
  }

  private pushInterpolatedSnapshot(): void {
    const snapshot = this.interpolate();
    if (snapshot) {
      this.latestSnapshot = snapshot;
      this.notifyCallbacks(snapshot);
    }
  }

  // ── Heartbeat sync ─────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => this.heartbeat(), this.heartbeatIntervalMs);
  }

  private async heartbeat(): Promise<void> {
    try {
      const res = await fetch(`${this.serverUrl}/api/sync`, {
        headers: { 'Authorization': `Bearer ${this.sessionToken}` },
      });
      if (!res.ok) return;

      const data = await res.json() as { gameTime: number; ship: ShipSnapshot | null };

      // Re-anchor time to server
      this.lastServerGameTime = data.gameTime;
      this.lastSnapshotRealTime = performance.now();

      // Update our ship state
      if (data.ship) {
        this.lastShips = this.lastShips.map(s =>
          s.id === data.ship!.id ? data.ship! : s,
        );
      }

      this.pushInterpolatedSnapshot();
    } catch {
      // Network hiccup — skip this beat
    }
  }

  // ── Body position helpers (client-side Kepler) ───────────────────

  private bodyPositionAtTime(bodyId: string, t: number): Vec2 {
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
}
