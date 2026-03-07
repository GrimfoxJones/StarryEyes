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

export function CommsPanel() {
  const snapshot = useGameStore((s) => s.snapshot);
  const bridge = useGameStore((s) => s.bridge) as RemoteBridge | null;
  const isDocked = useGameStore((s) => s.isDocked);
  const setIsDocked = useGameStore((s) => s.setIsDocked);
  const setActiveTab = useGameStore((s) => s.setActiveTab);
  const openLeftPanel = useGameStore((s) => s.openLeftPanel);

  const myShip = snapshot?.ships.find(s => s.id === bridge?.getMyShipId());
  const orbitBodyId = myShip?.orbitBodyId ?? null;
  const orbitBody = snapshot?.bodies.find(b => b.id === orbitBodyId);
  const hasStation = orbitBody?.hasStation ?? false;

  const stationName = hasStation
    ? `${orbitBody!.name} Station`
    : null;
  const archetype = orbitBody?.stationArchetype
    ? (ARCHETYPE_LABELS[orbitBody.stationArchetype] ?? 'Station')
    : null;

  const handleDock = () => {
    setIsDocked(true);
    setActiveTab('DOCK');
    openLeftPanel();
  };

  return (
    <div style={{ padding: '12px 8px' }}>
      <div style={{
        color: 'var(--text-label)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 12,
        paddingLeft: 4,
      }}>
        COMMUNICATIONS
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20, paddingLeft: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)', width: 100 }}>TRANSPONDER</span>
          <StatusDot status="nominal" />
          <span style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>ACTIVE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)', width: 100 }}>BROADBAND</span>
          <StatusDot status="nominal" />
          <span style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>MONITORING</span>
        </div>
      </div>

      <div style={{
        color: 'var(--text-label)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 8,
        paddingLeft: 4,
      }}>
        STATION LINK
      </div>

      {!hasStation ? (
        <div style={{ padding: '8px 4px', color: 'var(--text-hint)', fontSize: 'var(--font-size-md)' }}>
          No station in range
        </div>
      ) : (
        <div style={{ paddingLeft: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <StatusDot status="nominal" />
            <span style={{ color: 'var(--text-bright)', fontSize: 14 }}>{stationName}</span>
          </div>
          <div style={{ paddingLeft: 18, marginBottom: 4 }}>
            <div style={{ color: 'var(--accent-cyan)', fontSize: 'var(--font-size-sm)' }}>{archetype}</div>
          </div>
          <div style={{ paddingLeft: 18, marginBottom: 16 }}>
            <span style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)' }}>Range: </span>
            <span style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>IN ORBIT</span>
          </div>

          {isDocked ? (
            <button
              onClick={() => {
                if (bridge && myShip) {
                  bridge.sendCommand({ type: 'UNDOCK', shipId: myShip.id });
                }
                setIsDocked(false);
              }}
              style={{
                width: '100%',
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
          ) : (
            <button
              onClick={handleDock}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(0, 200, 100, 0.15)',
                border: '1px solid rgba(0, 200, 100, 0.4)',
                color: 'var(--status-nominal)',
                borderRadius: 3,
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: 1,
                cursor: 'pointer',
              }}
            >
              REQUEST DOCKING CLEARANCE
            </button>
          )}

          <div style={{ marginTop: 12, paddingLeft: 0 }}>
            <span style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)' }}>Status: </span>
            <span style={{
              color: isDocked ? 'var(--status-nominal)' : 'var(--text-primary)',
              fontSize: 'var(--font-size-sm)',
            }}>
              {isDocked ? 'DOCKED' : 'UNDOCKED'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
