import { StatusDot } from '../StatusDot.tsx';
import { useGameStore } from '../../store.ts';
import type { RemoteBridge } from '../../../../RemoteBridge.ts';

const ARCHETYPE_LABELS: Record<string, string> = {
  mining_outpost: 'Mining Outpost',
  habitat_colony: 'Habitat Colony',
  water_depot: 'Water Depot',
  military_base: 'Military Base',
  shipyard: 'Shipyard',
  weapon_factory: 'Weapon Factory',
};

interface Service {
  label: string;
  status: 'nominal' | 'warning' | 'offline';
  statusLabel: string;
}

const SERVICES: Service[] = [
  { label: 'MARKET', status: 'nominal', statusLabel: 'OPEN' },
  { label: 'REFUEL', status: 'nominal', statusLabel: 'AVAIL' },
  { label: 'REPAIR', status: 'nominal', statusLabel: 'AVAIL' },
  { label: 'CREW HIRE', status: 'offline', statusLabel: 'CLOSED' },
  { label: 'MISSION BOARD', status: 'nominal', statusLabel: 'ACTIVE' },
];

export function DockOverview() {
  const snapshot = useGameStore((s) => s.snapshot);
  const bridge = useGameStore((s) => s.bridge) as RemoteBridge | null;
  const setIsDocked = useGameStore((s) => s.setIsDocked);

  const myShip = snapshot?.ships.find(s => s.id === bridge?.getMyShipId());
  const orbitBodyId = myShip?.orbitBodyId ?? null;
  const orbitBody = snapshot?.bodies.find(b => b.id === orbitBodyId);
  const hasStation = orbitBody?.hasStation ?? false;

  const stationName = hasStation
    ? `${orbitBody!.name} Station`
    : orbitBody?.name ?? 'Unknown';
  const archetype = orbitBody?.stationArchetype
    ? (ARCHETYPE_LABELS[orbitBody.stationArchetype] ?? 'Station')
    : 'No Station';

  return (
    <div style={{ padding: '12px 8px' }}>
      <div style={{
        color: 'var(--text-label)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 4,
        paddingLeft: 4,
      }}>
        STATION
      </div>
      <div style={{
        color: 'var(--text-bright)',
        fontSize: 14,
        marginBottom: 4,
        paddingLeft: 4,
      }}>
        {stationName}
      </div>
      <div style={{
        color: 'var(--accent-cyan)',
        fontSize: 'var(--font-size-sm)',
        marginBottom: 16,
        paddingLeft: 4,
      }}>
        {archetype}
      </div>
      <div style={{
        color: 'var(--text-label)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 8,
        paddingLeft: 4,
      }}>
        SERVICES
      </div>
      {SERVICES.map((svc) => (
        <div
          key={svc.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 8px',
            borderRadius: 3,
          }}
        >
          <StatusDot status={svc.status} />
          <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: 'var(--font-size-md)' }}>
            {svc.label}
          </span>
          <span style={{
            color: svc.status === 'offline' ? 'var(--status-offline)' : 'var(--text-label)',
            fontSize: 'var(--font-size-sm)',
          }}>
            {svc.statusLabel}
          </span>
        </div>
      ))}

      <button
        onClick={() => {
          if (bridge && myShip) {
            bridge.sendCommand({ type: 'UNDOCK', shipId: myShip.id });
          }
          setIsDocked(false);
        }}
        style={{
          width: 'calc(100% - 8px)',
          margin: '16px 4px 0',
          padding: '8px 12px',
          background: 'rgba(255, 150, 0, 0.15)',
          border: '1px solid rgba(255, 150, 0, 0.4)',
          color: 'var(--status-warning)',
          borderRadius: 3,
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: 1,
          cursor: 'pointer',
        }}
      >
        UNDOCK
      </button>
    </div>
  );
}
