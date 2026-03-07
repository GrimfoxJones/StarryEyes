import { useGameStore } from '../store.ts';
import { TabBar } from './TabBar.tsx';
import { Breadcrumb } from './Breadcrumb.tsx';
import { SubTabNav } from './SubTabNav.tsx';
import { TabContent } from './TabContent.tsx';
import { SchematicPanel } from '../schematics/SchematicPanel.tsx';
import './LeftPanel.css';

export function LeftPanel() {
  const open = useGameStore((s) => s.leftPanelOpen);
  const activeTab = useGameStore((s) => s.activeTab);
  const toggleLeftPanel = useGameStore((s) => s.toggleLeftPanel);
  const isSys = activeTab === 'SYS';
  const isDock = activeTab === 'DOCK';
  const wideClass = isSys ? ' sys' : isDock ? ' dock' : '';

  return (
    <div className="left-panel-container">
      <div className={`left-panel${open ? ' open' : ''}${wideClass}`}>
        <TabBar />
        <Breadcrumb />
        <SchematicPanel />
        <div className="left-panel-body">
          <SubTabNav />
          <div className="left-panel-content">
            <TabContent />
          </div>
        </div>
      </div>
      <button
        className={`left-panel-toggle${open ? ' open' : ''}${wideClass}`}
        onClick={toggleLeftPanel}
        title="Toggle panel (Tab)"
      >
        {open ? '\u25C0' : '\u25B6'}
      </button>
    </div>
  );
}
