import { StatusDot } from '../StatusDot.tsx';

interface CrewMember {
  name: string;
  role: string;
  dutyStatus: 'nominal' | 'warning' | 'offline';
  dutyLabel: string;
  skills: { label: string; level: number }[];
}

const CREW: CrewMember[] = [
  {
    name: 'J. Holden',
    role: 'Captain',
    dutyStatus: 'nominal',
    dutyLabel: 'ON WATCH',
    skills: [
      { label: 'Command', level: 0.8 },
      { label: 'Navigation', level: 0.6 },
    ],
  },
  {
    name: 'N. Nagata',
    role: 'Engineer',
    dutyStatus: 'nominal',
    dutyLabel: 'ON WATCH',
    skills: [
      { label: 'Engineering', level: 0.95 },
      { label: 'Hacking', level: 0.7 },
    ],
  },
  {
    name: 'A. Kamal',
    role: 'Pilot',
    dutyStatus: 'offline',
    dutyLabel: 'OFF DUTY',
    skills: [
      { label: 'Piloting', level: 0.9 },
      { label: 'Gunnery', level: 0.6 },
    ],
  },
];

function SkillBar({ level }: { level: number }) {
  return (
    <div style={{
      width: 60,
      height: 4,
      background: 'var(--bar-bg)',
      borderRadius: 2,
    }}>
      <div style={{
        width: `${level * 100}%`,
        height: '100%',
        background: 'var(--accent-cyan)',
        borderRadius: 2,
      }} />
    </div>
  );
}

export function CrewRoster() {
  return (
    <div style={{ padding: '12px 8px' }}>
      <div style={{
        color: 'var(--text-label)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 12,
        paddingLeft: 4,
      }}>
        CREW ROSTER
      </div>
      {CREW.map((member) => (
        <div
          key={member.name}
          style={{
            padding: '10px 8px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <StatusDot status={member.dutyStatus} />
            <span style={{ color: 'var(--text-bright)', fontSize: 'var(--font-size-md)', flex: 1 }}>
              {member.name}
            </span>
            <span style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-xs)' }}>
              {member.dutyLabel}
            </span>
          </div>
          <div style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)', marginBottom: 6, paddingLeft: 16 }}>
            {member.role}
          </div>
          <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {member.skills.map((skill) => (
              <div key={skill.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-hint)', fontSize: 'var(--font-size-xs)', width: 70 }}>
                  {skill.label}
                </span>
                <SkillBar level={skill.level} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
