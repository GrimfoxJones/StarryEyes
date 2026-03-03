import type { OrbitalElements, Vec2 } from './types.ts';
import { vec2, vec2Length, vec2Cross, vec2Dot } from './types.ts';

const TWO_PI = 2 * Math.PI;

// ── Mean anomaly ────────────────────────────────────────────────────

/** Mean motion n = √(μ/a³) */
function meanMotion(a: number, mu: number): number {
  return Math.sqrt(mu / (a * a * a));
}

/** Mean anomaly at time t */
export function meanAnomalyAtTime(el: OrbitalElements, t: number): number {
  const n = meanMotion(el.a, el.mu);
  const M = el.M0 + n * (t - el.epoch);
  // Normalize to [0, 2π)
  return ((M % TWO_PI) + TWO_PI) % TWO_PI;
}

// ── Kepler's equation solver ────────────────────────────────────────

/** Solve E - e*sin(E) = M via Newton-Raphson. Returns eccentric anomaly E. */
export function solveKepler(M: number, e: number, tolerance = 1e-12, maxIter = 30): number {
  // Initial guess
  let E = M + e * Math.sin(M);

  for (let i = 0; i < maxIter; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tolerance) break;
  }

  return E;
}

// ── True anomaly ────────────────────────────────────────────────────

/** Convert eccentric anomaly E to true anomaly ν */
export function trueAnomalyFromEccentric(E: number, e: number): number {
  const sinNu = Math.sqrt(1 - e * e) * Math.sin(E) / (1 - e * Math.cos(E));
  const cosNu = (Math.cos(E) - e) / (1 - e * Math.cos(E));
  return Math.atan2(sinNu, cosNu);
}

// ── Position from elements ──────────────────────────────────────────

/** Compute position at time t from orbital elements (in parent frame). */
export function keplerPositionAtTime(el: OrbitalElements, t: number): Vec2 {
  const M = meanAnomalyAtTime(el, t);
  const E = solveKepler(M, el.e);
  const nu = trueAnomalyFromEccentric(E, el.e);

  // Distance from focus
  const r = el.a * (1 - el.e * Math.cos(E));

  // Angle in inertial frame = true anomaly + argument of periapsis
  const theta = nu + el.omega;

  return vec2(r * Math.cos(theta), r * Math.sin(theta));
}

// ── Full state (position + velocity) from elements ──────────────────

/** Compute position AND velocity at time t */
export function keplerStateAtTime(el: OrbitalElements, t: number): { pos: Vec2; vel: Vec2 } {
  const M = meanAnomalyAtTime(el, t);
  const E = solveKepler(M, el.e);
  const nu = trueAnomalyFromEccentric(E, el.e);

  const r = el.a * (1 - el.e * Math.cos(E));
  const theta = nu + el.omega;

  // Position
  const pos = vec2(r * Math.cos(theta), r * Math.sin(theta));

  // Velocity in perifocal frame, then rotate by omega
  const n = meanMotion(el.a, el.mu);
  const factor = n * el.a / (1 - el.e * Math.cos(E));

  // Perifocal velocity components
  const vPerifocalX = -factor * Math.sin(E);
  const vPerifocalY = factor * Math.sqrt(1 - el.e * el.e) * Math.cos(E);

  // Rotate by omega
  const cosW = Math.cos(el.omega);
  const sinW = Math.sin(el.omega);
  const vx = vPerifocalX * cosW - vPerifocalY * sinW;
  const vy = vPerifocalX * sinW + vPerifocalY * cosW;

  return { pos, vel: vec2(vx, vy) };
}

// ── State vectors → orbital elements (CRITICAL) ────────────────────

/** Convert position/velocity state vectors to orbital elements relative to a body with gravitational parameter mu. */
export function stateToElements(pos: Vec2, vel: Vec2, mu: number, t: number): OrbitalElements {
  const r = vec2Length(pos);
  const v = vec2Length(vel);

  // Specific orbital energy
  const energy = 0.5 * v * v - mu / r;

  // Semi-major axis
  const a = -mu / (2 * energy);

  // Specific angular momentum (scalar in 2D: h = r × v)
  const h = vec2Cross(pos, vel); // pos.x*vel.y - pos.y*vel.x

  // Eccentricity vector: e_vec = (v × h)/μ - r̂
  // In 2D: v × h = (vx*h_z, vy*h_z... wait, h is scalar in 2D)
  // e_vec = ((v²/μ - 1/r) * pos - (pos·vel/μ) * vel)
  const rv = vec2Dot(pos, vel);
  const ex = (1 / mu) * ((v * v - mu / r) * pos.x - rv * vel.x);
  const ey = (1 / mu) * ((v * v - mu / r) * pos.y - rv * vel.y);
  const e = Math.sqrt(ex * ex + ey * ey);

  // Argument of periapsis
  const omega = Math.atan2(ey, ex);

  // True anomaly
  const nu = Math.atan2(pos.y, pos.x) - omega;

  // Eccentric anomaly from true anomaly
  const sinNu = Math.sin(nu);
  const cosNu = Math.cos(nu);
  const sinE = Math.sqrt(1 - e * e) * sinNu / (1 + e * cosNu);
  const cosE = (e + cosNu) / (1 + e * cosNu);
  const E = Math.atan2(sinE, cosE);

  // Mean anomaly
  const M = E - e * Math.sin(E);
  const M0 = ((M % TWO_PI) + TWO_PI) % TWO_PI;

  return { a, e: Math.max(e, 0), omega, M0, epoch: t, mu };
}

// ── Orbital ellipse for rendering ───────────────────────────────────

/** Generate points along the orbital ellipse for rendering. */
export function computeOrbitalEllipse(el: OrbitalElements, numPoints: number): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const nu = (i / numPoints) * TWO_PI;

    // Distance at this true anomaly
    const r = el.a * (1 - el.e * el.e) / (1 + el.e * Math.cos(nu));

    const theta = nu + el.omega;
    points.push(vec2(r * Math.cos(theta), r * Math.sin(theta)));
  }
  return points;
}

// ── Orbital period ──────────────────────────────────────────────────

/** Orbital period T = 2π√(a³/μ) */
export function orbitalPeriod(a: number, mu: number): number {
  return TWO_PI * Math.sqrt(a * a * a / mu);
}
