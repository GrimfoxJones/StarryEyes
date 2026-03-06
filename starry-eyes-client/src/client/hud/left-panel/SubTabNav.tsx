import { useGameStore } from '../store.ts';
import { getTabDef } from './tabConfig.ts';

export function SubTabNav() {
  const activeTab = useGameStore((s) => s.activeTab);
  const activeSubTab = useGameStore((s) => s.activeSubTab);
  const setActiveSubTab = useGameStore((s) => s.setActiveSubTab);
  const setHoveredSubTab = useGameStore((s) => s.setHoveredSubTab);
  const tabDef = getTabDef(activeTab);
  const isSys = activeTab === 'SYS';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: 80,
      flexShrink: 0,
      borderRight: '1px solid var(--border-subtle)',
      overflowY: 'auto',
    }}>
      {tabDef.subTabs.map((sub) => {
        const isActive = activeSubTab === sub.id;
        return (
          <button
            key={sub.id}
            onClick={() => setActiveSubTab(sub.id)}
            onMouseEnter={isSys ? () => setHoveredSubTab(sub.id) : undefined}
            onMouseLeave={isSys ? () => setHoveredSubTab(null) : undefined}
            style={{
              background: isActive ? 'var(--bg-active)' : 'none',
              border: 'none',
              borderLeft: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              color: isActive ? 'var(--accent-cyan)' : 'var(--text-label)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--font-size-xs)',
              letterSpacing: 0.5,
              padding: '8px 6px',
              cursor: 'pointer',
              textAlign: 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {sub.label}
          </button>
        );
      })}
    </div>
  );
}
