import type { SubsystemNode, SubsystemStatus } from '@starryeyes/shared';
import { useGameStore } from '../../store.ts';
import { StatusDot } from '../StatusDot.tsx';

interface SubsystemRow {
  id: string;
  label: string;
  status: 'nominal' | 'warning' | 'danger' | 'offline';
  value: string;
}

const STATUS_MAP: Record<SubsystemStatus, 'nominal' | 'warning' | 'danger' | 'offline'> = {
  NOMINAL: 'nominal',
  WARNING: 'warning',
  CRITICAL: 'danger',
  OFFLINE: 'offline',
  STARTING: 'warning',
  SHUTDOWN: 'offline',
};

const SUB_TAB_LABELS: Record<string, string> = {
  navigation: 'NAV',
  drive: 'DRIVE',
  reactor: 'REACTOR',
  thermal: 'THERMAL',
  sensors: 'SENSORS',
  propellant: 'FUEL',
  cargo: 'CARGO',
  comms: 'COMMS',
  structural: 'STRUCT.',
};

const SUB_TAB_IDS: Record<string, string> = {
  navigation: 'NAV',
  drive: 'DRIVE',
  reactor: 'REACTOR',
  thermal: 'THERMAL',
  sensors: 'SENSORS',
  propellant: 'PROPELLANT',
  cargo: 'CARGO',
  comms: 'COMMS',
  structural: 'STRUCTURAL',
};

function getPrimaryValue(node: SubsystemNode): string {
  // Show status value if it exists, otherwise first string/number value
  const statusVal = node.values['status'];
  if (statusVal && typeof statusVal.value === 'string') return statusVal.value;

  for (const sv of Object.values(node.values)) {
    if (typeof sv.value === 'string') return sv.value;
    if (typeof sv.value === 'number' && sv.displayHint === 'bar') {
      const min = sv.min ?? 0;
      const max = sv.max ?? 1;
      const pct = max > min ? ((sv.value - min) / (max - min)) * 100 : 0;
      return `${pct.toFixed(0)}%`;
    }
  }
  return node.status;
}

const FALLBACK_SUBSYSTEMS: SubsystemRow[] = [
  { id: 'NAV', label: 'NAV', status: 'nominal', value: 'ONLINE' },
  { id: 'DRIVE', label: 'DRIVE', status: 'nominal', value: 'STANDBY' },
  { id: 'REACTOR', label: 'REACTOR', status: 'nominal', value: '100%' },
  { id: 'THERMAL', label: 'THERMAL', status: 'nominal', value: '22\u00B0C' },
  { id: 'SENSORS', label: 'SENSORS', status: 'nominal', value: 'ACTIVE' },
  { id: 'PROPELLANT', label: 'FUEL', status: 'nominal', value: 'FULL' },
  { id: 'CARGO', label: 'CARGO', status: 'offline', value: 'EMPTY' },
  { id: 'COMMS', label: 'COMMS', status: 'nominal', value: 'ONLINE' },
  { id: 'STRUCTURAL', label: 'STRUCT.', status: 'nominal', value: '100%' },
];

export function SysOverview() {
  const setActiveSubTab = useGameStore((s) => s.setActiveSubTab);
  const setHoveredSubTab = useGameStore((s) => s.setHoveredSubTab);
  const snapshot = useGameStore((s) => s.subsystemSnapshot);

  const rows: SubsystemRow[] = snapshot
    ? snapshot.root.children.map((child) => ({
        id: SUB_TAB_IDS[child.id] ?? child.id,
        label: SUB_TAB_LABELS[child.id] ?? child.name.toUpperCase(),
        status: STATUS_MAP[child.status] ?? 'offline',
        value: getPrimaryValue(child),
      }))
    : FALLBACK_SUBSYSTEMS;

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
      {rows.map((sys) => (
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
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; setHoveredSubTab(sys.id); }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; setHoveredSubTab(null); }}
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
