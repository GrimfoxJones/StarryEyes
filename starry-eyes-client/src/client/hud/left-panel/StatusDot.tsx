type Status = 'nominal' | 'warning' | 'danger' | 'offline';

const STATUS_COLORS: Record<Status, string> = {
  nominal: 'var(--status-nominal)',
  warning: 'var(--status-warning)',
  danger: 'var(--status-danger)',
  offline: 'var(--status-offline)',
};

export function StatusDot({ status }: { status: Status }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: STATUS_COLORS[status],
        flexShrink: 0,
      }}
    />
  );
}
