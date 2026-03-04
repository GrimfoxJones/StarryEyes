import { useGameStore } from '../store.ts';
import { getTabDef, getSubTabDef } from './tabConfig.ts';
import { StubPlaceholder } from './StubPlaceholder.tsx';
import { SysOverview } from './sys/SysOverview.tsx';
import { CrewRoster } from './crew/CrewRoster.tsx';
import { OpsOverview } from './ops/OpsOverview.tsx';
import { DockOverview } from './dock/DockOverview.tsx';

export function TabContent() {
  const activeTab = useGameStore((s) => s.activeTab);
  const activeSubTab = useGameStore((s) => s.activeSubTab);

  // Route to specific implemented content
  if (activeTab === 'SYS' && activeSubTab === 'OVERVIEW') return <SysOverview />;
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
