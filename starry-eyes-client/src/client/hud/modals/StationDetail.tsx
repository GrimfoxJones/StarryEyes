export function StationDetail({ objectId }: { objectId: string }) {
  return (
    <div>
      <div style={{
        color: 'var(--text-label)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 12,
      }}>
        STATION DETAIL
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Section label="IDENTITY">
          <Row label="Name" value={objectId} />
          <Row label="Class" value="Trading Post" />
          <Row label="Faction" value="Independent" />
          <Row label="Population" value="--" />
        </Section>
        <Section label="SERVICES">
          <Row label="Market" value="OPEN" />
          <Row label="Refuel" value="AVAILABLE" />
          <Row label="Repair" value="AVAILABLE" />
          <Row label="Crew Hire" value="CLOSED" />
        </Section>
        <Section label="DOCKING">
          <div style={{ color: 'var(--text-hint)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' }}>
            Approach to within docking range to dock
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        color: 'var(--accent-cyan)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 6,
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: 4,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '3px 0',
      fontSize: 'var(--font-size-md)',
    }}>
      <span style={{ color: 'var(--text-label)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
