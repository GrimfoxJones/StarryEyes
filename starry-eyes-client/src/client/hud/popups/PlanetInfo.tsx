import type { BodySnapshot } from '@starryeyes/shared';
import type { ObjectType } from '../store.ts';

const CLASS_LABELS: Record<string, string> = {
  rocky: 'Rocky',
  super_earth: 'Super Earth',
  mini_neptune: 'Mini Neptune',
  gas_giant: 'Gas Giant',
  ice_giant: 'Ice Giant',
  dwarf: 'Dwarf',
};

function formatDistance(meters: number): string {
  if (meters >= 1e12) return `${(meters / 1.496e11).toFixed(2)} AU`;
  if (meters >= 1e9) return `${(meters / 1e9).toFixed(1)} Gm`;
  if (meters >= 1e6) return `${(meters / 1e6).toFixed(1)} Mm`;
  if (meters >= 1e3) return `${(meters / 1e3).toFixed(0)} km`;
  return `${meters.toFixed(0)} m`;
}

function formatPeriod(a: number, mu: number): string {
  const T = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
  if (T >= 86400 * 365) return `${(T / (86400 * 365)).toFixed(1)} yr`;
  if (T >= 86400) return `${(T / 86400).toFixed(1)} d`;
  if (T >= 3600) return `${(T / 3600).toFixed(1)} h`;
  return `${(T / 60).toFixed(0)} min`;
}

interface PlanetInfoProps {
  objectId: string;
  objectType: ObjectType;
  body?: BodySnapshot;
}

export function PlanetInfo({ objectId, objectType, body }: PlanetInfoProps) {
  const name = body?.name ?? objectId;
  const typeLabel = objectType.toUpperCase();
  const classLabel = body?.planetClass
    ? (CLASS_LABELS[body.planetClass] ?? body.planetClass)
    : '--';

  return (
    <>
      <div className="info-popup-header">
        <span className="info-popup-title">{name}</span>
        <span className="info-popup-type">{typeLabel}</span>
      </div>
      <div className="info-popup-body">
        <div className="info-popup-row">
          <span className="info-popup-row-label">Type</span>
          <span className="info-popup-row-value">{classLabel}</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Orbit</span>
          <span className="info-popup-row-value">
            {body?.elements ? formatDistance(body.elements.a) : '--'}
          </span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Period</span>
          <span className="info-popup-row-value">
            {body?.elements ? formatPeriod(body.elements.a, body.elements.mu) : '--'}
          </span>
        </div>
      </div>
    </>
  );
}
