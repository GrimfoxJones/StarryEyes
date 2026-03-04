export function PlanetDetail({ objectId }: { objectId: string }) {
  return (
    <div>
      <div style={{
        color: 'var(--text-label)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 12,
      }}>
        CELESTIAL BODY DETAIL
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Section label="IDENTITY">
          <Row label="Name" value={objectId} />
          <Row label="Type" value="Rocky Planet" />
          <Row label="Mass" value="--" />
          <Row label="Radius" value="--" />
        </Section>
        <Section label="ORBIT">
          <Row label="Semi-major Axis" value="--" />
          <Row label="Eccentricity" value="--" />
          <Row label="Period" value="--" />
          <Row label="Mean Anomaly" value="--" />
        </Section>
        <Section label="FACILITIES">
          <div style={{ color: 'var(--text-hint)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' }}>
            No stations in orbit
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
