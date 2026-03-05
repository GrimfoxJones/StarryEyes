// ── Vec2 ─────────────────────────────────────────────────────────────

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export const Vec2Zero: Vec2 = { x: 0, y: 0 };

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vec2Length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vec2LengthSq(v: Vec2): number {
  return v.x * v.x + v.y * v.y;
}

export function vec2Normalize(v: Vec2): Vec2 {
  const len = vec2Length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function vec2Dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** 2D cross product (scalar): a.x*b.y - a.y*b.x */
export function vec2Cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function vec2Rotate(v: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

export function vec2Angle(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

export function vec2Dist(a: Vec2, b: Vec2): number {
  return vec2Length(vec2Sub(a, b));
}

// ── Orbital Elements ────────────────────────────────────────────────

export interface OrbitalElements {
  readonly a: number;          // semi-major axis (m)
  readonly e: number;          // eccentricity
  readonly omega: number;      // argument of periapsis (rad)
  readonly M0: number;         // mean anomaly at epoch (rad)
  readonly epoch: number;      // reference time (game seconds)
  readonly mu: number;         // gravitational parameter of parent (m³/s²)
  readonly direction: 1 | -1;  // 1 = prograde (CCW), -1 = retrograde (CW)
}

// ── Celestial Body ──────────────────────────────────────────────────

export type BodyType = 'star' | 'planet' | 'moon' | 'asteroid' | 'station';

export interface CelestialBody {
  readonly id: string;
  readonly name: string;
  readonly mass: number;       // kg
  readonly radius: number;     // m (for rendering)
  readonly elements: OrbitalElements | null; // null for star
  readonly parentId: string | null;
  readonly type: BodyType;
  readonly color: number;      // hex color for rendering
  readonly planetClass?: string;
}

// ── Nav Computer Types ──────────────────────────────────────────────

export type ShipMode = 'drift' | 'transit' | 'orbit';

export interface Route {
  readonly startPos: Vec2;           // P0
  readonly controlPoint: Vec2;       // P1 (Bézier control point)
  readonly interceptPos: Vec2;       // P2 (destination)
  readonly startTime: number;
  readonly initialSpeed: number;     // ship speed at route start (0 if from rest)
  readonly arcLength: number;        // total distance along curve
  readonly totalTime: number;        // transit time for arcLength (asymmetric if initialSpeed > 0)
  readonly acceleration: number;
  readonly targetBodyId: string | null;
  readonly arcTable: readonly { readonly t: number; readonly dist: number }[];
  readonly fuelAtRouteStart: number;       // fuel when route began
  readonly fuelConsumptionRate: number;    // kg/s burn rate
}

export type Destination =
  | { readonly type: 'body'; readonly bodyId: string }
  | { readonly type: 'point'; readonly position: Vec2 };

// ── Ship State ──────────────────────────────────────────────────────

export interface ShipState {
  readonly id: string;
  position: Vec2;
  velocity: Vec2;
  readonly maxAcceleration: number; // m/s²
  fuel: number;                // kg remaining
  readonly fuelConsumptionRate: number; // kg/s at full thrust
  mode: ShipMode;
  route: Route | null;
  orbitBodyId: string | null;
  orbitAngle: number;
}

// ── Snapshots (serialization-friendly) ──────────────────────────────

export interface StarInfo {
  readonly spectralClass: string;
  readonly spectralSubclass: number;
  readonly luminosityClass: string;
  readonly surfaceTemperature: number;
  readonly luminositySolar: number;
  readonly massSolar: number;
  readonly age: number;
}

export interface BodySnapshot {
  readonly id: string;
  readonly name: string;
  readonly type: BodyType;
  readonly mass: number;
  readonly position: Vec2;
  readonly radius: number;
  readonly color: number;
  readonly elements: OrbitalElements | null;
  readonly parentId: string | null;
  readonly starInfo?: StarInfo;
  readonly planetClass?: string;
}

export interface ShipSnapshot {
  readonly id: string;
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly heading: Vec2;
  readonly mode: ShipMode;
  readonly fuel: number;
  readonly maxFuel: number;
  readonly fuelConsumptionRate: number;
  readonly speed: number;
  readonly destinationName: string | null;
  readonly eta: number | null;
  readonly routeLine: readonly Vec2[] | null;
  readonly isDecelerating: boolean;
  readonly route: Route | null;
  readonly orbitBodyId: string | null;
}

export interface SystemSnapshot {
  readonly gameTime: number;
  readonly bodies: readonly BodySnapshot[];
  readonly ships: readonly ShipSnapshot[];
}

// ── Player Commands ─────────────────────────────────────────────────

export type PlayerCommand =
  | { readonly type: 'SET_DESTINATION'; readonly shipId: string; readonly destination: Destination; readonly acceleration?: number }
  | { readonly type: 'CANCEL_ROUTE'; readonly shipId: string }
  | { readonly type: 'UNDOCK'; readonly shipId: string };
