import { useGameStore } from '../../store.ts';
import { StatusDot } from '../StatusDot.tsx';

interface Subsystem {
  id: string;
  label: string;
  status: 'nominal' | 'warning' | 'danger' | 'offline';
  value: string;
}

const SUBSYSTEMS: Subsystem[] = [
  { id: 'NAV', label: 'NAV', status: 'nominal', value: 'ONLINE' },
  { id: 'DRIVE', label: 'DRIVE', status: 'nominal', value: 'STANDBY' },
  { id: 'REACTOR', label: 'REACTOR', status: 'nominal', value: '100%' },
  { id: 'THERMAL', label: 'THERMAL', status: 'nominal', value: '22°C' },
  { id: 'SENSORS', label: 'SENSORS', status: 'nominal', value: 'ACTIVE' },
  { id: 'PROPELLANT', label: 'PROPEL.', status: 'nominal', value: 'FULL' },
  { id: 'CARGO', label: 'CARGO', status: 'offline', value: 'EMPTY' },
  { id: 'COMMS', label: 'COMMS', status: 'nominal', value: 'ONLINE' },
  { id: 'STRUCTURAL', label: 'STRUCT.', status: 'nominal', value: '100%' },
];

export function SysOverview() {
  const setActiveSubTab = useGameStore((s) => s.setActiveSubTab);

  return (
    <div style={{ padding: '12px 8px' }}>
      <div style={{
        color: 'var(--text-label)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 12,
        paddingLeft: 4,
      }}>
        SHIP SYSTEMS
      </div>
      {SUBSYSTEMS.map((sys) => (
        <div
          key={sys.id}
          onClick={() => setActiveSubTab(sys.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 8px',
            cursor: 'pointer',
            borderRadius: 3,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <StatusDot status={sys.status} />
          <span style={{
            flex: 1,
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-md)',
            letterSpacing: 0.5,
          }}>
            {sys.label}
          </span>
          <span style={{
            color: sys.status === 'nominal' ? 'var(--text-label)' : `var(--status-${sys.status})`,
            fontSize: 'var(--font-size-sm)',
          }}>
            {sys.value}
          </span>
        </div>
      ))}
    </div>
  );
}
