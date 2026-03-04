import type { SystemSnapshot, BodySnapshot, BodyType } from '../../simulation/types.ts';
import type { ObjectType } from '../hud/store.ts';

export interface InfoContent {
  title: string;
  typeLabel: string;
  rows: { label: string; value: string }[];
}

export function bodyTypeToObjectType(type: BodyType): ObjectType {
  if (type === 'star') return 'planet';
  return type as ObjectType;
}

export function getInfoContent(
  objectId: string,
  objectType: ObjectType,
  snapshot: SystemSnapshot,
  shipPos?: { x: number; y: number },
): InfoContent {
  switch (objectType) {
    case 'planet':
    case 'moon':
    case 'asteroid':
      return getBodyContent(objectId, objectType, snapshot, shipPos);
    case 'station':
      return getStationContent(objectId);
    case 'ship':
      return getShipContent(objectId, snapshot);
  }
}

function getBodyContent(
  objectId: string,
  objectType: ObjectType,
  snapshot: SystemSnapshot,
  shipPos?: { x: number; y: number },
): InfoContent {
  const body = snapshot.bodies.find((b) => b.id === objectId);
  if (!body) {
    return { title: objectId, typeLabel: objectType.toUpperCase(), rows: [] };
  }

  const rows: { label: string; value: string }[] = [];

  rows.push({ label: 'Type', value: formatBodySubType(body) });

  if (body.elements) {
    rows.push({ label: 'Orbit', value: formatDistance(body.elements.a) });
    rows.push({ label: 'Period', value: formatPeriod(body.elements) });
  }

  if (shipPos) {
    const dx = body.position.x - shipPos.x;
    const dy = body.position.y - shipPos.y;
    const range = Math.sqrt(dx * dx + dy * dy);
    rows.push({ label: 'Range', value: formatDistance(range) });
  }

  return {
    title: body.name,
    typeLabel: objectType.toUpperCase(),
    rows,
  };
}

function getStationContent(objectId: string): InfoContent {
  return {
    title: objectId,
    typeLabel: 'STATION',
    rows: [
      { label: 'Class', value: '--' },
      { label: 'Faction', value: '--' },
    ],
  };
}

function getShipContent(objectId: string, snapshot: SystemSnapshot): InfoContent {
  const ship = snapshot.ships.find((s) => s.id === objectId);
  if (!ship) {
    return { title: objectId, typeLabel: 'SHIP', rows: [] };
  }
  return {
    title: objectId,
    typeLabel: 'SHIP',
    rows: [
      { label: 'Velocity', value: formatSpeed(ship.speed) },
      { label: 'Mode', value: ship.mode.toUpperCase() },
    ],
  };
}

function formatBodySubType(body: BodySnapshot): string {
  if (body.type === 'asteroid') return 'Asteroid';
  if (body.type === 'moon') return 'Moon';
  return 'Rocky';
}

function formatDistance(meters: number): string {
  if (meters >= 1e12) return `${(meters / 1.496e11).toFixed(1)} AU`;
  if (meters >= 1e9) return `${(meters / 1e9).toFixed(1)} Gm`;
  if (meters >= 1e6) return `${(meters / 1e6).toFixed(1)} Mm`;
  if (meters >= 1e3) return `${(meters / 1e3).toFixed(0)} km`;
  return `${meters.toFixed(0)} m`;
}

function formatPeriod(elements: { a: number; mu: number }): string {
  const T = 2 * Math.PI * Math.sqrt(Math.pow(elements.a, 3) / elements.mu);
  if (T >= 86400 * 365) return `${(T / (86400 * 365)).toFixed(1)} yr`;
  if (T >= 86400) return `${(T / 86400).toFixed(1)} d`;
  if (T >= 3600) return `${(T / 3600).toFixed(1)} h`;
  return `${(T / 60).toFixed(0)} min`;
}

function formatSpeed(mps: number): string {
  if (mps > 1000) return `${(mps / 1000).toFixed(1)} km/s`;
  return `${mps.toFixed(0)} m/s`;
}
