interface StubPlaceholderProps {
  tabName: string;
  subTabName: string;
  description: string;
}

export function StubPlaceholder({ tabName, subTabName, description }: StubPlaceholderProps) {
  return (
    <div style={{ padding: '16px 12px' }}>
      <div style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)', letterSpacing: 1, marginBottom: 8 }}>
        {tabName} &gt; {subTabName}
      </div>
      <div style={{ color: 'var(--text-primary)', fontSize: 14, marginBottom: 16 }}>
        {description}
      </div>
      <div style={{ color: 'var(--text-hint)', fontSize: 'var(--font-size-xs)', fontStyle: 'italic' }}>
        Content not yet implemented
      </div>
    </div>
  );
}
