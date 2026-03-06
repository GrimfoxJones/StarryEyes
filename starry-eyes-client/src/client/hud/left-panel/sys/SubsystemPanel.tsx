import { useState } from 'react';
import type { SubsystemNode } from '@starryeyes/shared';
import { useInterpolatedNode } from './useInterpolatedNode.ts';
import { SubsystemNodeView } from './SubsystemNodeView.tsx';
import './subsystems.css';

function findNodeById(root: SubsystemNode, id: string): SubsystemNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

interface Props {
  nodeId: string;
}

export function SubsystemPanel({ nodeId }: Props) {
  const [drillPath, setDrillPath] = useState<string[]>([]);
  const rootNode = useInterpolatedNode(nodeId);

  if (!rootNode) {
    return <div className="subsystem-connecting">CONNECTING...</div>;
  }

  // Resolve drill-down path
  const activeId = drillPath.length > 0 ? drillPath[drillPath.length - 1] : nodeId;
  const activeNode = findNodeById(rootNode, activeId) ?? rootNode;

  const handleDrillDown = (childId: string) => {
    setDrillPath([...drillPath, childId]);
  };

  const handleBack = () => {
    setDrillPath(drillPath.slice(0, -1));
  };

  return (
    <div className="subsystem-panel">
      {drillPath.length > 0 && (
        <div
          className="child-link"
          onClick={handleBack}
          style={{ marginBottom: 8 }}
        >
          <span style={{ color: 'var(--text-label)' }}>&lsaquo;</span>
          <span style={{ color: 'var(--text-label)' }}>BACK</span>
        </div>
      )}
      <SubsystemNodeView node={activeNode} onDrillDown={handleDrillDown} />
    </div>
  );
}
