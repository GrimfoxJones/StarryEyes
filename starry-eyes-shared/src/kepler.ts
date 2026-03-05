import type { OrbitalElements, Vec2, CelestialBody } from './types.js';
import { vec2, vec2Add, vec2Length, vec2Cross, vec2Dot } from './types.js';

const TWO_PI = 2 * Math.PI;

// ── Helpers ─────────────────────────────────────────────────────────

function isHyperbolic(el: OrbitalElements): boolean {
  return el.e >= 1 || el.a < 0;
}

// ── Mean anomaly ────────────────────────────────────────────────────

/** Mean anomaly at time t. Works for elliptical and hyperbolic. */
export function meanAnomalyAtTime(el: OrbitalElements, t: number): number {
  const absA = Math.abs(el.a);
  const n = el.direction * Math.sqrt(el.mu / (absA * absA * absA));
  const M = el.M0 + n * (t - el.epoch);

  if (isHyperbolic(el)) {
    // Hyperbolic: M is unbounded
    return M;
  }
  // Elliptical: normalize to [0, 2π)
  return ((M % TWO_PI) + TWO_PI) % TWO_PI;
}

// ── Kepler's equation solvers ───────────────────────────────────────

/** Elliptical: solve E - e*sin(E) = M via Newton-Raphson */
export function solveKepler(M: number, e: number, tolerance = 1e-12, maxIter = 30): number {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < maxIter; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tolerance) break;
  }
  return E;
}

/** Hyperbolic: solve e*sinh(H) - H = M via Newton-Raphson */
export function solveKeplerHyperbolic(M: number, e: number, tolerance = 1e-12, maxIter = 50): number {
  // Initial guess
  let H = M / (e - 1);
  if (Math.abs(H) > 10) H = Math.sign(M) * Math.log(2 * Math.abs(M) / e);

  for (let i = 0; i < maxIter; i++) {
    const sinhH = Math.sinh(H);
    const coshH = Math.cosh(H);
    const dH = (e * sinhH - H - M) / (e * coshH - 1);
    H -= dH;
    if (Math.abs(dH) < tolerance) break;
  }
  return H;
}

// ── True anomaly ────────────────────────────────────────────────────

/** Elliptical: eccentric anomaly E → true anomaly ν */
export function trueAnomalyFromEccentric(E: number, e: number): number {
  const sinNu = Math.sqrt(1 - e * e) * Math.sin(E) / (1 - e * Math.cos(E));
  const cosNu = (Math.cos(E) - e) / (1 - e * Math.cos(E));
  return Math.atan2(sinNu, cosNu);
}

/** Hyperbolic: hyperbolic anomaly H → true anomaly ν */
export function trueAnomalyFromHyperbolic(H: number, e: number): number {
  const sinNu = Math.sqrt(e * e - 1) * Math.sinh(H) / (e * Math.cosh(H) - 1);
  const cosNu = (e - Math.cosh(H)) / (e * Math.cosh(H) - 1);
  return Math.atan2(sinNu, cosNu);
}

// ── Position from elements ──────────────────────────────────────────

/** Compute position at time t. Works for elliptical and hyperbolic. */
export function keplerPositionAtTime(el: OrbitalElements, t: number): Vec2 {
  const M = meanAnomalyAtTime(el, t);
  let nu: number;
  let r: number;

  if (isHyperbolic(el)) {
    const H = solveKeplerHyperbolic(M, el.e);
    nu = trueAnomalyFromHyperbolic(H, el.e);
    // Semi-latus rectum p = |a|*(e²-1)
    const p = Math.abs(el.a) * (el.e * el.e - 1);
    r = p / (1 + el.e * Math.cos(nu));
  } else {
    const E = solveKepler(M, el.e);
    nu = trueAnomalyFromEccentric(E, el.e);
    r = el.a * (1 - el.e * Math.cos(E));
  }

  const theta = nu + el.omega;
  return vec2(r * Math.cos(theta), r * Math.sin(theta));
}

// ── Full state (position + velocity) from elements ──────────────────

/** Compute position AND velocity at time t. Works for elliptical and hyperbolic. */
export function keplerStateAtTime(el: OrbitalElements, t: number): { pos: Vec2; vel: Vec2 } {
  const M = meanAnomalyAtTime(el, t);
  let nu: number;
  let r: number;

  if (isHyperbolic(el)) {
    const H = solveKeplerHyperbolic(M, el.e);
    nu = trueAnomalyFromHyperbolic(H, el.e);
    const p = Math.abs(el.a) * (el.e * el.e - 1);
    r = p / (1 + el.e * Math.cos(nu));
  } else {
    const E = solveKepler(M, el.e);
    nu = trueAnomalyFromEccentric(E, el.e);
    r = el.a * (1 - el.e * Math.cos(E));
  }

  const theta = nu + el.omega;
  const pos = vec2(r * Math.cos(theta), r * Math.sin(theta));

  // Velocity via radial/transverse components (works for ALL conics)
  // p = semi-latus rectum = a*(1-e²) for ellipse, |a|*(e²-1) for hyperbola
  const p = isHyperbolic(el)
    ? Math.abs(el.a) * (el.e * el.e - 1)
    : el.a * (1 - el.e * el.e);
  const hMag = Math.sqrt(el.mu * p); // angular momentum magnitude

  // Radial and transverse velocity (direction determines sign)
  const vr = el.direction * (el.mu / hMag) * el.e * Math.sin(nu);
  const vt = el.direction * (el.mu / hMag) * (1 + el.e * Math.cos(nu));

  // Convert to cartesian (rotate by theta)
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const vx = vr * cosT - vt * sinT;
  const vy = vr * sinT + vt * cosT;

  return { pos, vel: vec2(vx, vy) };
}

// ── State vectors → orbital elements (CRITICAL) ────────────────────

/** Convert position/velocity to orbital elements. Works for all conics. */
export function stateToElements(pos: Vec2, vel: Vec2, mu: number, t: number): OrbitalElements {
  const r = vec2Length(pos);
  const v = vec2Length(vel);

  // Specific orbital energy
  const energy = 0.5 * v * v - mu / r;

  // Semi-major axis (negative for hyperbolic)
  const a = -mu / (2 * energy);

  // Specific angular momentum (scalar in 2D) — sign encodes direction
  const h = vec2Cross(pos, vel);
  const direction: 1 | -1 = h >= 0 ? 1 : -1;

  // Eccentricity vector
  const rv = vec2Dot(pos, vel);
  const ex = (1 / mu) * ((v * v - mu / r) * pos.x - rv * vel.x);
  const ey = (1 / mu) * ((v * v - mu / r) * pos.y - rv * vel.y);
  const e = Math.sqrt(ex * ex + ey * ey);

  // Argument of periapsis
  const omega = Math.atan2(ey, ex);

  // True anomaly
  const nu = Math.atan2(pos.y, pos.x) - omega;

  let M0: number;

  if (e >= 1 || a < 0) {
    // Hyperbolic: true anomaly → hyperbolic anomaly → mean anomaly
    const sinNu = Math.sin(nu);
    const cosNu = Math.cos(nu);
    const sinhH = Math.sqrt(e * e - 1) * sinNu / (1 + e * cosNu);
    const coshH = (e + cosNu) / (1 + e * cosNu);
    const H = Math.log(coshH + sinhH); // asinh-like via log for numeric stability
    M0 = e * Math.sinh(H) - H;
  } else {
    // Elliptical: true anomaly → eccentric anomaly → mean anomaly
    const sinNu = Math.sin(nu);
    const cosNu = Math.cos(nu);
    const sinE = Math.sqrt(1 - e * e) * sinNu / (1 + e * cosNu);
    const cosE = (e + cosNu) / (1 + e * cosNu);
    const E = Math.atan2(sinE, cosE);
    M0 = E - e * Math.sin(E);
    M0 = ((M0 % TWO_PI) + TWO_PI) % TWO_PI;
  }

  return { a, e: Math.max(e, 0), omega, M0, epoch: t, mu, direction };
}

// ── Orbital path for rendering ──────────────────────────────────────

/** Generate points along the orbital path. Handles ellipses and hyperbolas. */
export function computeOrbitalEllipse(el: OrbitalElements, numPoints: number): Vec2[] {
  const points: Vec2[] = [];

  if (isHyperbolic(el)) {
    // Hyperbolic: draw within valid true anomaly range
    // Asymptotic angle: |ν| < arccos(-1/e)
    const nuMax = Math.acos(-1 / el.e) - 0.01; // small margin from asymptote

    for (let i = 0; i <= numPoints; i++) {
      const nu = -nuMax + (2 * nuMax * i) / numPoints;
      const p = Math.abs(el.a) * (el.e * el.e - 1);
      const r = p / (1 + el.e * Math.cos(nu));
      if (r <= 0 || !isFinite(r)) continue;

      const theta = nu + el.omega;
      points.push(vec2(r * Math.cos(theta), r * Math.sin(theta)));
    }
  } else {
    // Elliptical: full orbit
    for (let i = 0; i <= numPoints; i++) {
      const nu = (i / numPoints) * TWO_PI;
      const r = el.a * (1 - el.e * el.e) / (1 + el.e * Math.cos(nu));
      const theta = nu + el.omega;
      points.push(vec2(r * Math.cos(theta), r * Math.sin(theta)));
    }
  }

  return points;
}

// ── Orbital period ──────────────────────────────────────────────────

/** Orbital period T = 2π√(a³/μ). Only meaningful for elliptical orbits. */
export function orbitalPeriod(a: number, mu: number): number {
  return TWO_PI * Math.sqrt(a * a * a / mu);
}

// ── Body velocity helper ────────────────────────────────────────────

/** Compute the heliocentric velocity of a body at time t, handling parent chains. */
export function bodyVelocityAtTime(
  bodyId: string,
  t: number,
  bodies: readonly CelestialBody[],
  bodyPositionAtTimeFn: (id: string, t: number) => Vec2,
): Vec2 {
  if (bodyId === 'sol') return { x: 0, y: 0 };
  const body = bodies.find(b => b.id === bodyId);
  if (!body || !body.elements) return { x: 0, y: 0 };

  // Get local velocity from Kepler state
  const localState = keplerStateAtTime(body.elements, t);
  let vel = localState.vel;

  // Add parent's heliocentric velocity (recursive)
  if (body.parentId && body.parentId !== 'sol') {
    const parentVel = bodyVelocityAtTime(body.parentId, t, bodies, bodyPositionAtTimeFn);
    vel = vec2Add(vel, parentVel);
  }

  return vel;
}
