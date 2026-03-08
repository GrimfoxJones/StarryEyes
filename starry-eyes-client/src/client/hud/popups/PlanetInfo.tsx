import type { BodySnapshot } from '@starryeyes/shared';
import type { ObjectType } from '../store.ts';
import { useGameStore } from '../store.ts';

const ARCHETYPE_LABELS: Record<string, string> = {
  mining_outpost: 'Mining Outpost',
  habitat_colony: 'Habitat Colony',
  water_depot: 'Water Depot',
  military_base: 'Military Base',
  shipyard: 'Shipyard',
  weapon_factory: 'Weapon Factory',
};

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

function demandArrows(level: 0 | 1 | 2 | 3): string {
  if (level === 3) return '\u25B2\u25B2\u25B2';
  if (level === 2) return '\u25B2\u25B2';
  if (level === 1) return '\u25B2';
  return '';
}

function demandColor(level: 0 | 1 | 2 | 3): string {
  if (level >= 2) return 'var(--status-nominal)';
  if (level === 1) return 'var(--status-warning)';
  return 'var(--text-hint)';
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

  const tradeSummaries = useGameStore((s) => s.tradeSummaries);
  const summary = tradeSummaries.find(ts => ts.bodyId === objectId);

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
        {body?.hasStation && (
          <div className="info-popup-row">
            <span className="info-popup-row-label">Station</span>
            <span className="info-popup-row-value" style={{ color: 'var(--accent-cyan)' }}>
              {ARCHETYPE_LABELS[body.stationArchetype ?? ''] ?? 'Present'}
            </span>
          </div>
        )}
        {summary && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4, paddingTop: 4 }}>
            <div style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-xs)', letterSpacing: 1, marginBottom: 3 }}>TRADE</div>
            {summary.imports.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 6px', marginBottom: 2 }}>
                <span style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)', marginRight: 2 }}>Buying:</span>
                {summary.imports.map(imp => (
                  <span key={imp.commodityId} style={{ fontSize: 'var(--font-size-sm)', color: demandColor(imp.demandLevel) }}>
                    {imp.name}{demandArrows(imp.demandLevel) ? ` ${demandArrows(imp.demandLevel)}` : ''}
                  </span>
                ))}
              </div>
            )}
            {summary.exports.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 6px' }}>
                <span style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)', marginRight: 2 }}>Selling:</span>
                {summary.exports.map(exp => (
                  <span key={exp.commodityId} style={{
                    fontSize: 'var(--font-size-sm)',
                    color: exp.outOfStock ? 'var(--text-hint)' : 'var(--text-primary)',
                  }}>
                    {exp.name}{exp.outOfStock ? ' (Out)' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
