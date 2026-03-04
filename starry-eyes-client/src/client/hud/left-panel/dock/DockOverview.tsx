import { StatusDot } from '../StatusDot.tsx';

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
        marginBottom: 16,
        paddingLeft: 4,
      }}>
        Tycho Station
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
    </div>
  );
}
