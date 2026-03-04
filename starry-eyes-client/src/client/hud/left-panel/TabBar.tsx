import { useGameStore, type PrimaryTab } from '../store.ts';
import { TABS } from './tabConfig.ts';

export function TabBar() {
  const activeTab = useGameStore((s) => s.activeTab);
  const isDocked = useGameStore((s) => s.isDocked);
  const setActiveTab = useGameStore((s) => s.setActiveTab);

  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0 8px',
    }}>
      {TABS.map((tab) => {
        if (tab.id === 'DOCK' && !isDocked) return null;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as PrimaryTab)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              color: isActive ? 'var(--accent-cyan)' : 'var(--text-label)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--font-size-md)',
              fontWeight: 'bold',
              letterSpacing: 1,
              padding: '10px 16px',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
