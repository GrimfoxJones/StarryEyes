import { useEffect } from 'react';
import { useGameStore } from '../store.ts';
import { getTabDef, getSubTabDef } from './tabConfig.ts';
import { StubPlaceholder } from './StubPlaceholder.tsx';
import { SysOverview } from './sys/SysOverview.tsx';
import { SubsystemPanel } from './sys/SubsystemPanel.tsx';
import { CrewRoster } from './crew/CrewRoster.tsx';
import { OpsOverview } from './ops/OpsOverview.tsx';
import { DockOverview } from './dock/DockOverview.tsx';

const SYS_NODE_MAP: Record<string, string> = {
  NAV: 'navigation',
  DRIVE: 'drive',
  REACTOR: 'reactor',
  THERMAL: 'thermal',
  SENSORS: 'sensors',
  PROPELLANT: 'propellant',
  CARGO: 'cargo',
  COMMS: 'comms',
  STRUCTURAL: 'structural',
};

export function TabContent() {
  const activeTab = useGameStore((s) => s.activeTab);
  const activeSubTab = useGameStore((s) => s.activeSubTab);
  const leftPanelOpen = useGameStore((s) => s.leftPanelOpen);
  const bridge = useGameStore((s) => s.bridge);

  // Subscribe/unsubscribe to subsystem updates
  useEffect(() => {
    if (activeTab === 'SYS' && leftPanelOpen && bridge) {
      bridge.subscribeSubsystems?.();
      return () => { bridge.unsubscribeSubsystems?.(); };
    }
  }, [activeTab, leftPanelOpen, bridge]);

  // Route to specific implemented content
  if (activeTab === 'SYS' && activeSubTab === 'OVERVIEW') return <SysOverview />;

  if (activeTab === 'SYS' && SYS_NODE_MAP[activeSubTab]) {
    return <SubsystemPanel nodeId={SYS_NODE_MAP[activeSubTab]} />;
  }

  if (activeTab === 'CREW' && activeSubTab === 'ROSTER') return <CrewRoster />;
  if (activeTab === 'OPS' && activeSubTab === 'OVERVIEW') return <OpsOverview />;
  if (activeTab === 'DOCK' && activeSubTab === 'OVERVIEW') return <DockOverview />;

  // Fallback to stub
  const tabDef = getTabDef(activeTab);
  const subTabDef = getSubTabDef(activeTab, activeSubTab);
  return (
    <StubPlaceholder
      tabName={tabDef.label}
      subTabName={subTabDef?.label ?? activeSubTab}
      description={subTabDef?.description ?? 'Unknown sub-tab'}
    />
  );
}
