import { useGameStore, type PrimaryTab } from '../store.ts';
import { TABS } from './tabConfig.ts';
import { formatGameTime } from '../format.ts';

export function TabBar() {
  const activeTab = useGameStore((s) => s.activeTab);
  const isDocked = useGameStore((s) => s.isDocked);
  const setActiveTab = useGameStore((s) => s.setActiveTab);
  const gameTime = useGameStore((s) => s.snapshot?.gameTime);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
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
      {gameTime != null && (
        <span style={{
          marginLeft: 'auto',
          color: 'var(--text-label)',
          fontSize: 'var(--font-size-sm)',
          letterSpacing: 1,
          padding: '0 8px',
        }}>
          {formatGameTime(gameTime)}
        </span>
      )}
    </div>
  );
}
