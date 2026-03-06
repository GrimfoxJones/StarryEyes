import { useState, useMemo, useCallback } from 'react';
import { SchematicViewer } from './schematics/SchematicViewer.tsx';
import { reactorSchematic, defaultReactorParams } from './schematics/reactor.schematic.ts';
import type { ReactorParams } from './schematics/reactor.schematic.ts';
import { shipSchematic, compartments } from './schematics/ship-overview.schematic.ts';
import type { Compartment } from './schematics/ship-overview.schematic.ts';
import { SectionHighlight } from './schematics/SectionHighlight.tsx';
import { FuelGauge } from './schematics/FuelGauge.tsx';

const sliderStyle: React.CSSProperties = {
  appearance: 'none',
  width: 120,
  height: 4,
  background: '#0e2535',
  outline: 'none',
  cursor: 'pointer',
  accentColor: '#7ec8e3',
};

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  color: '#4a8a9e',
  letterSpacing: 1,
  minWidth: 90,
};

function ReactorTab() {
  const [params, setParams] = useState<ReactorParams>(defaultReactorParams);

  const doc = useMemo(() => reactorSchematic(params), [params]);

  const set = (key: keyof ReactorParams) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setParams(p => ({ ...p, [key]: parseFloat(e.target.value) }));

  return (
    <>
      <SchematicViewer doc={doc} />
      <div style={{
        display: 'flex', gap: 16, padding: '8px 4px',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span style={{ fontSize: 9, color: '#1a4557', letterSpacing: 1.5 }}>PARAMS:</span>
        {([
          ['POWER', 'powerLevel'],
          ['COILS', 'coilCurrent'],
          ['PLASMA', 'plasmaTemp'],
          ['COOLANT', 'coolantFlow'],
        ] as const).map(([label, key]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={labelStyle}>{label}</span>
            <input type="range" min={0} max={1} step={0.01}
              value={params[key]} onChange={set(key)} style={sliderStyle} />
            <span style={{ ...labelStyle, minWidth: 30 }}>{Math.round(params[key] * 100)}%</span>
          </label>
        ))}
      </div>
    </>
  );
}

function ShipTab() {
  const [selected, setSelected] = useState<Compartment | null>(null);
  const [fuelUpper, setFuelUpper] = useState(0.72);
  const [fuelLower, setFuelLower] = useState(0.68);
  const doc = useMemo(() => shipSchematic({ shipName: 'SV Wandering Sparrow' }), []);

  // Resolve group: selecting a grouped compartment selects all in the group
  const selectedSections = useMemo(() => {
    if (!selected) return [];
    if (selected.group) return compartments.filter(c => c.group === selected.group);
    return [selected];
  }, [selected]);

  const isFuelSelected = selectedSections.some(s => s.group === 'fuel');
  const fuelTanks = useMemo(() => compartments.filter(c => c.group === 'fuel'), []);

  const overlay = useCallback(() => (
    <g>
      <SectionHighlight sections={selectedSections} />
      {isFuelSelected && (
        <>
          <FuelGauge tank={fuelTanks[0]} level={fuelUpper} />
          <FuelGauge tank={fuelTanks[1]} level={fuelLower} />
        </>
      )}
    </g>
  ), [selectedSections, isFuelSelected, fuelTanks, fuelUpper, fuelLower]);

  // Collect overlay layers from all selected sections
  const activeLayers = useMemo(() => {
    const layers = selectedSections.map(s => s.overlayLayer).filter((l): l is string => !!l);
    return [...new Set(layers)];
  }, [selectedSections]);

  return (
    <>
      <SchematicViewer doc={doc} overlay={overlay}
        activeLayers={activeLayers} />
      <div style={{
        display: 'flex', gap: 4, padding: '8px 4px',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span style={{ fontSize: 9, color: '#1a4557', letterSpacing: 1.5 }}>SECTION:</span>
        {compartments.map(c => {
          const on = selectedSections.some(s => s.id === c.id);
          return (
            <button key={c.id}
              onClick={() => setSelected(on ? null : c)}
              style={{
                background: on ? '#0a192912' : 'transparent',
                border: `1px solid ${on ? '#7ec8e3' : '#0e2535'}`,
                color: on ? '#7ec8e3' : '#1a4557',
                padding: '3px 8px',
                fontSize: 9,
                fontFamily: "'Share Tech Mono', monospace",
                letterSpacing: 1,
                cursor: 'pointer',
                boxShadow: on ? '0 0 6px #7ec8e335' : 'none',
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      {isFuelSelected && (
        <div style={{
          display: 'flex', gap: 16, padding: '8px 4px',
          flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: 9, color: '#1a4557', letterSpacing: 1.5 }}>FUEL:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={labelStyle}>UPPER</span>
            <input type="range" min={0} max={1} step={0.01}
              value={fuelUpper} onChange={e => setFuelUpper(parseFloat(e.target.value))} style={sliderStyle} />
            <span style={{ ...labelStyle, minWidth: 30 }}>{Math.round(fuelUpper * 100)}%</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={labelStyle}>LOWER</span>
            <input type="range" min={0} max={1} step={0.01}
              value={fuelLower} onChange={e => setFuelLower(parseFloat(e.target.value))} style={sliderStyle} />
            <span style={{ ...labelStyle, minWidth: 30 }}>{Math.round(fuelLower * 100)}%</span>
          </label>
        </div>
      )}
    </>
  );
}

const tabs = [
  { key: 'reactor', label: 'REACTOR' },
  { key: 'ship', label: 'SHIP OVERVIEW' },
] as const;

export default function App() {
  const [active, setActive] = useState<string>('reactor');

  return (
    <div style={{ maxWidth: 900, width: '100%' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {tabs.map(tab => {
          const on = tab.key === active;
          return (
            <button key={tab.key}
              onClick={() => setActive(tab.key)}
              style={{
                background: on ? '#0a1929' : 'transparent',
                border: `1px solid ${on ? '#1e3a5f' : '#0e2535'}`,
                color: on ? '#7ec8e3' : '#1a4557',
                padding: '6px 18px',
                fontSize: 11,
                fontFamily: "'Share Tech Mono', monospace",
                letterSpacing: 1.5,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {active === 'reactor' ? <ReactorTab /> : <ShipTab />}
    </div>
  );
}
