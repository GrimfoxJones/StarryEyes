import { useState, useEffect } from 'react';
import type { SubsystemNode } from '@starryeyes/shared';
import { useGameStore } from '../../store.ts';
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
  const setSysDrillNodeId = useGameStore(s => s.setSysDrillNodeId);
  const rootNode = useInterpolatedNode(nodeId);

  // Reset drill path when switching to a different subsystem
  useEffect(() => {
    setDrillPath([]);
  }, [nodeId]);

  const activeId = drillPath.length > 0 ? drillPath[drillPath.length - 1] : null;
  useEffect(() => {
    setSysDrillNodeId(activeId);
    return () => setSysDrillNodeId(null);
  }, [activeId, setSysDrillNodeId]);

  if (!rootNode) {
    return <div className="subsystem-connecting">CONNECTING...</div>;
  }

  // Resolve drill-down path
  const displayId = activeId ?? nodeId;
  const activeNode = findNodeById(rootNode, displayId) ?? rootNode;

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
