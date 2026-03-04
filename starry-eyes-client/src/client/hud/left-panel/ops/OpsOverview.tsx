import { StatusDot } from '../StatusDot.tsx';

interface OpItem {
  id: string;
  label: string;
  status: 'nominal' | 'warning' | 'offline';
  statusLabel: string;
}

const OPS: OpItem[] = [
  { id: 'TRADE', label: 'TRADE LOG', status: 'nominal', statusLabel: 'AVAIL' },
  { id: 'MINING', label: 'MINING', status: 'offline', statusLabel: 'N/A' },
  { id: 'SCAN', label: 'SCAN', status: 'nominal', statusLabel: 'AVAIL' },
  { id: 'PROBES', label: 'PROBES', status: 'offline', statusLabel: 'N/A' },
  { id: 'MISSIONS', label: 'MISSION LOG', status: 'nominal', statusLabel: 'ACTIVE' },
];

export function OpsOverview() {
  return (
    <div style={{ padding: '12px 8px' }}>
      <div style={{
        color: 'var(--text-label)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 12,
        paddingLeft: 4,
      }}>
        OPERATIONS
      </div>
      {OPS.map((op) => (
        <div
          key={op.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 8px',
            borderRadius: 3,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <StatusDot status={op.status} />
          <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: 'var(--font-size-md)' }}>
            {op.label}
          </span>
          <span style={{
            color: op.status === 'offline' ? 'var(--status-offline)' : 'var(--text-label)',
            fontSize: 'var(--font-size-sm)',
          }}>
            {op.statusLabel}
          </span>
        </div>
      ))}
    </div>
  );
}
