import { useGameStore } from '../store.ts';
import { STATION_ARCHETYPE_DEFS } from '@starryeyes/shared';
import { resolveStationArchetype } from './stationUtils.ts';

export function StationInfo({ objectId }: { objectId: string }) {
  const snapshot = useGameStore((s) => s.snapshot);
  const body = snapshot?.bodies.find(b => b.id === objectId);
  const name = body?.name ?? objectId;

  const archetype = resolveStationArchetype(name);
  const archetypeDef = archetype ? STATION_ARCHETYPE_DEFS[archetype] : null;

  const facilityNames = archetypeDef?.facilities.map(f => {
    const label = f.type === 'extraction' ? 'Extract' : 'Mfg';
    return `${label}: ${f.commodity.replace(/_/g, ' ')}`;
  }) ?? [];

  return (
    <>
      <div className="info-popup-header">
        <span className="info-popup-title">{name}</span>
        <span className="info-popup-type">STATION</span>
      </div>
      <div className="info-popup-body">
        <div className="info-popup-row">
          <span className="info-popup-row-label">Class</span>
          <span className="info-popup-row-value">{archetypeDef?.name ?? 'Unknown'}</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Facilities</span>
          <span className="info-popup-row-value">{archetypeDef?.facilities.length ?? 0}</span>
        </div>
        {facilityNames.length > 0 && (
          <div className="info-popup-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span className="info-popup-row-label" style={{ marginBottom: 2 }}>Production</span>
            {facilityNames.map((f, i) => (
              <span key={i} style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', paddingLeft: 8 }}>{f}</span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
