import { useGameStore } from '../store.ts';
import { getTabDef, getSubTabDef } from './tabConfig.ts';

export function Breadcrumb() {
  const activeTab = useGameStore((s) => s.activeTab);
  const activeSubTab = useGameStore((s) => s.activeSubTab);
  const setActiveSubTab = useGameStore((s) => s.setActiveSubTab);

  const tabDef = getTabDef(activeTab);
  const subTabDef = getSubTabDef(activeTab, activeSubTab);
  const defaultSub = tabDef.subTabs[0]?.id;
  const isAtDefault = activeSubTab === defaultSub;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 12px',
      color: 'var(--text-label)',
      fontSize: 'var(--font-size-sm)',
      letterSpacing: 1,
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <span
        onClick={() => setActiveSubTab(defaultSub)}
        style={{
          cursor: isAtDefault ? 'default' : 'pointer',
          color: isAtDefault ? 'var(--text-label)' : 'var(--accent-cyan)',
        }}
      >
        {tabDef.label}
      </span>
      {!isAtDefault && subTabDef && (
        <>
          <span style={{ color: 'var(--text-hint)' }}>&gt;</span>
          <span style={{ color: 'var(--text-primary)' }}>{subTabDef.label}</span>
        </>
      )}
    </div>
  );
}
