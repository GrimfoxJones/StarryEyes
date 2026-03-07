import { useEffect, useState } from 'react';
import { useGameStore } from '../store.ts';
import { COMMODITY_DEFS } from '@starryeyes/shared';

function commodityLabel(id: string): string {
  return COMMODITY_DEFS[id as keyof typeof COMMODITY_DEFS]?.name ?? id.replace(/_/g, ' ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StationDetailData = any;

export function StationDetail({ objectId }: { objectId: string }) {
  const bridge = useGameStore((s) => s.bridge);
  const [detail, setDetail] = useState<StationDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const headers: Record<string, string> = {};
    const token = bridge?.getSessionToken?.();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`/api/bodies/${encodeURIComponent(objectId)}/detail`, { headers })
      .then(res => res.ok ? res.json() : null)
      .then(data => setDetail(data?.data ?? null))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [objectId, bridge]);

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--text-label)' }}>Loading...</div>;
  }

  const archetypeDef = detail?.archetypeDef;
  const economy = detail?.economy;

  return (
    <div>
      <div style={{
        color: 'var(--text-label)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 12,
      }}>
        STATION DETAIL
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Section label="IDENTITY">
          <Row label="Name" value={detail?.name ?? objectId} />
          <Row label="Class" value={archetypeDef?.name ?? 'Unknown'} />
          <Row label="Faction" value="Independent" />
          {economy && <Row label="Population" value={economy.population.toLocaleString()} />}
          {archetypeDef && <Row label="Pop. Cap" value={archetypeDef.populationCap.toLocaleString()} />}
          {economy && <Row label="Supply Score" value={`${economy.supplyScore}%`} />}
        </Section>

        {archetypeDef?.facilities && (
          <Section label="FACILITIES">
            {archetypeDef.facilities.map((f: { commodity: string; type: string; efficiencyTier: string }, i: number) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '3px 0',
                fontSize: 'var(--font-size-md)',
              }}>
                <span style={{ color: 'var(--text-primary)' }}>
                  {commodityLabel(f.commodity)}
                </span>
                <span style={{
                  color: f.type === 'extraction' ? 'var(--status-nominal)' : 'var(--accent-cyan)',
                  fontSize: 'var(--font-size-sm)',
                }}>
                  {f.type === 'extraction' ? 'EXTRACTION' : 'MANUFACTURING'}
                  {' '}
                  ({f.efficiencyTier.toUpperCase()})
                </span>
              </div>
            ))}
          </Section>
        )}

        {archetypeDef?.consumptionProfile && Object.keys(archetypeDef.consumptionProfile).length > 0 && (
          <Section label="CONSUMPTION">
            {Object.entries(archetypeDef.consumptionProfile).map(([cid, rate]) => (
              <Row key={cid} label={commodityLabel(cid)} value={`${rate}/hr`} />
            ))}
          </Section>
        )}

        <Section label="SERVICES">
          <Row label="Market" value="OPEN" />
          <Row label="Refuel" value="AVAILABLE" />
          <Row label="Repair" value="AVAILABLE" />
          <Row label="Crew Hire" value="CLOSED" />
        </Section>

        <Section label="DOCKING">
          <div style={{ color: 'var(--text-hint)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' }}>
            Approach to within docking range to dock
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        color: 'var(--accent-cyan)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 6,
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: 4,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '3px 0',
      fontSize: 'var(--font-size-md)',
    }}>
      <span style={{ color: 'var(--text-label)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
