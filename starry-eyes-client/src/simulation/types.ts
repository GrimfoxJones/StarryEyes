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

export type BodyType = 'star' | 'planet' | 'moon' | 'asteroid';

export interface CelestialBody {
  readonly id: string;
  readonly name: string;
  readonly mass: number;       // kg
  readonly radius: number;     // m (for rendering)
  readonly elements: OrbitalElements | null; // null for star
  readonly parentId: string | null;
  readonly type: BodyType;
  readonly color: number;      // hex color for rendering
}

// ── Ship State ──────────────────────────────────────────────────────

export interface ShipState {
  readonly id: string;
  position: Vec2;
  velocity: Vec2;
  heading: Vec2;               // unit vector
  thrustLevel: number;         // 0.0–1.0
  readonly maxAcceleration: number; // m/s²
  fuel: number;                // kg remaining
  readonly fuelConsumptionRate: number; // kg/s at full thrust
  isThrusting: boolean;
  coastOrbit: OrbitalElements | null;
  parentBodyId: string;
}

// ── Snapshots (serialization-friendly) ──────────────────────────────

export interface BodySnapshot {
  readonly id: string;
  readonly name: string;
  readonly type: BodyType;
  readonly position: Vec2;
  readonly radius: number;
  readonly color: number;
  readonly elements: OrbitalElements | null;
}

export interface ShipSnapshot {
  readonly id: string;
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly heading: Vec2;
  readonly thrustLevel: number;
  readonly isThrusting: boolean;
  readonly fuel: number;
  readonly maxFuel: number;
  readonly speed: number;
  readonly parentBodyId: string;
}

export interface SystemSnapshot {
  readonly gameTime: number;
  readonly bodies: readonly BodySnapshot[];
  readonly ships: readonly ShipSnapshot[];
  readonly paused: boolean;
  readonly timeCompression: number;
}

// ── Player Commands ─────────────────────────────────────────────────

export type PlayerCommand =
  | { readonly type: 'SET_HEADING'; readonly shipId: string; readonly heading: Vec2 }
  | { readonly type: 'SET_THRUST'; readonly shipId: string; readonly level: number }
  | { readonly type: 'SET_TIME_COMPRESSION'; readonly multiplier: number }
  | { readonly type: 'PAUSE' }
  | { readonly type: 'RESUME' };
