import { SeededRng } from './rng.js';
import { generateStar } from './star.js';

// ── System Identification ────────────────────────────────────────────

const MAX_LINK_OFFSET = 50;

export function getSystemSeed(worldSeed: number, index: number): number {
  // Combine worldSeed and index deterministically
  const rng = new SeededRng(worldSeed ^ (index * 2654435761));
  return (rng.next() * 0xFFFFFFFF) >>> 0;
}

export function getSystemName(worldSeed: number, index: number): string {
  const seed = getSystemSeed(worldSeed, index);
  const rng = new SeededRng(seed);
  return generateStar(rng).name;
}

// ── Connection Algorithm ─────────────────────────────────────────────

function computeForwardLinks(worldSeed: number, index: number): number[] {
  const rng = new SeededRng(worldSeed ^ (index * 1664525 + 1013904223));
  const count = rng.int(1, 4);
  const links: number[] = [];

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    while (attempts < 20) {
      const offset = rng.int(1, MAX_LINK_OFFSET);
      const sign = rng.chance(0.5) ? 1 : -1;
      const target = index + offset * sign;
      if (target >= 0 && target !== index && !links.includes(target)) {
        links.push(target);
        break;
      }
      attempts++;
    }
  }

  return links;
}

export function getGateConnections(worldSeed: number, index: number): number[] {
  // 1. Forward links from this system
  const forward = computeForwardLinks(worldSeed, index);

  // 2. Scan neighbors for back-links to us
  const backLinks: number[] = [];
  const lo = Math.max(0, index - MAX_LINK_OFFSET);
  const hi = index + MAX_LINK_OFFSET;

  for (let neighbor = lo; neighbor <= hi; neighbor++) {
    if (neighbor === index) continue;
    if (forward.includes(neighbor)) continue; // already have it

    const neighborForward = computeForwardLinks(worldSeed, neighbor);
    if (neighborForward.includes(index)) {
      backLinks.push(neighbor);
    }
  }

  // 3. Union, capped at 6
  const all = [...forward, ...backLinks];
  if (all.length > 6) all.length = 6;
  return all;
}

// ── Gate Connection Info ─────────────────────────────────────────────

export interface GateConnectionInfo {
  readonly systemIndex: number;
  readonly systemSeed: number;
  readonly systemName: string;
}

export function getGateConnectionInfo(worldSeed: number, index: number): GateConnectionInfo[] {
  const connections = getGateConnections(worldSeed, index);
  return connections.map(targetIndex => ({
    systemIndex: targetIndex,
    systemSeed: getSystemSeed(worldSeed, targetIndex),
    systemName: getSystemName(worldSeed, targetIndex),
  }));
}
