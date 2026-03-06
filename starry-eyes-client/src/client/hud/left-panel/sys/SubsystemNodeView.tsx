import type { SubsystemNode } from '@starryeyes/shared';
import { StatusDot } from '../StatusDot.tsx';
import { SystemValueView } from './SystemValueView.tsx';
import './subsystems.css';

const STATUS_MAP: Record<string, 'nominal' | 'warning' | 'danger' | 'offline'> = {
  NOMINAL: 'nominal',
  WARNING: 'warning',
  CRITICAL: 'danger',
  OFFLINE: 'offline',
  STARTING: 'warning',
  SHUTDOWN: 'offline',
};

interface Props {
  node: SubsystemNode;
  onDrillDown?: (childId: string) => void;
}

export function SubsystemNodeView({ node, onDrillDown }: Props) {
  const statusDotValue = STATUS_MAP[node.status] ?? 'offline';

  return (
    <div>
      <div className="subsystem-header">
        <StatusDot status={statusDotValue} />
        <span className="subsystem-header__name">{node.name}</span>
        <span
          className="subsystem-header__status"
          style={{ color: `var(--status-${statusDotValue})` }}
        >
          {node.status}
        </span>
      </div>

      {Object.entries(node.values).map(([key, sv]) => (
        <SystemValueView
          key={key}
          label={key.replace(/_/g, ' ')}
          sv={sv}
          nodeId={node.id}
          valueKey={key}
        />
      ))}

      {node.children.length > 0 && (
        <>
          <div className="subsystem-divider" />
          {node.children.map((child) => (
            <div
              key={child.id}
              className="child-link"
              onClick={() => onDrillDown?.(child.id)}
            >
              <StatusDot status={STATUS_MAP[child.status] ?? 'offline'} />
              <span>{child.name}</span>
              <span className="child-link__chevron">&rsaquo;</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
