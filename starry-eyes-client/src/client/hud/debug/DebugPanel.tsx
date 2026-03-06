import { useState, useCallback, useMemo } from 'react';
import { useGameStore } from '../store.ts';
import { generateSystem, getSystemSeed } from '@starryeyes/shared';
import type { GeneratedSystem, GateConnectionInfo } from '@starryeyes/shared';
import './DebugPanel.css';

function formatSpectral(system: GeneratedSystem): string {
  const s = system.star;
  const cls = s.spectralClass;
  if (['red_giant', 'white_dwarf', 'brown_dwarf', 'neutron_star', 't_tauri'].includes(cls)) {
    return cls.replace(/_/g, ' ');
  }
  return `${cls}${s.spectralSubclass} ${s.luminosityClass}`;
}

function formatPlanetClass(cls: string): string {
  return cls.replace(/_/g, ' ');
}

function SystemPreview({ conn, worldSeed, onJump }: {
  conn: GateConnectionInfo;
  worldSeed: number;
  onJump: (idx: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const system = useMemo(() => {
    if (!expanded) return null;
    const seed = getSystemSeed(worldSeed, conn.systemIndex);
    return generateSystem(seed);
  }, [expanded, worldSeed, conn.systemIndex]);

  return (
    <div className="debug-connection-wrapper">
      <div
        className={`debug-connection${expanded ? ' expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="debug-connection-arrow">{expanded ? '\u25BE' : '\u25B8'}</span>
        <span>{conn.systemName}</span>
        <span className="debug-connection-idx">[{conn.systemIndex}]</span>
      </div>
      {expanded && system && (
        <div className="debug-system-detail">
          <div className="debug-detail-row">
            <span className="debug-detail-label">STAR</span>
            <span className="debug-detail-value">{formatSpectral(system)}</span>
          </div>
          <div className="debug-detail-row">
            <span className="debug-detail-label">PLANETS</span>
            <span className="debug-detail-value">{system.planets.length}</span>
          </div>
          {system.planets.map((p) => {
            const inHZ = p.semiMajorAxis >= system.habitableZone.inner
              && p.semiMajorAxis <= system.habitableZone.outer;
            return (
            <div key={p.id} className={`debug-planet-row${inHZ ? ' habitable' : ''}`}>
              <span className="debug-planet-name">{p.name}</span>
              <span className="debug-planet-class">{formatPlanetClass(p.planetClass)}</span>
              {p.moons.length > 0 && (
                <span className="debug-planet-moons">{p.moons.length}m</span>
              )}
            </div>
            );
          })}
          {system.asteroids.length > 0 && (
            <div className="debug-detail-row">
              <span className="debug-detail-label">ASTEROIDS</span>
              <span className="debug-detail-value">{system.asteroids.length}</span>
            </div>
          )}
          <button
            className="debug-btn debug-quick-travel"
            onClick={(e) => { e.stopPropagation(); onJump(conn.systemIndex); }}
          >
            QUICK TRAVEL
          </button>
        </div>
      )}
    </div>
  );
}

export function DebugPanel() {
  const debugPanelOpen = useGameStore((s) => s.debugPanelOpen);
  const toggleDebugPanel = useGameStore((s) => s.toggleDebugPanel);
  const worldSeed = useGameStore((s) => s.worldSeed);
  const currentSystemIndex = useGameStore((s) => s.currentSystemIndex);
  const connectedSystems = useGameStore((s) => s.connectedSystems);
  const snapshot = useGameStore((s) => s.snapshot);
  const bridge = useGameStore((s) => s.bridge);

  const [seedInput, setSeedInput] = useState('');

  const starName = snapshot?.bodies.find(b => b.type === 'star')?.name ?? '\u2014';

  const handleApplySeed = useCallback(async () => {
    const body: { seed?: number } = {};
    if (seedInput.trim()) {
      const parsed = parseInt(seedInput.trim(), 10);
      if (!isNaN(parsed)) body.seed = parsed;
    }
    try {
      const res = await fetch('/api/debug/randomize-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSeedInput('');
      }
    } catch { /* ignore */ }
  }, [seedInput]);

  const handleJump = useCallback(async (targetSystemIndex: number) => {
    try {
      await fetch('/api/debug/jump-to-system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bridge?.getSessionToken?.() ?? ''}`,
        },
        body: JSON.stringify({ targetSystemIndex }),
      });
    } catch { /* ignore */ }
  }, [bridge]);

  return (
    <div className="debug-panel-container">
      <button
        className={`debug-panel-toggle${debugPanelOpen ? ' open' : ''}`}
        onClick={toggleDebugPanel}
      >
        {debugPanelOpen ? '\u25B6' : '\u25C0'}
      </button>

      <div className={`debug-panel${debugPanelOpen ? ' open' : ''}`}>
        <div className="debug-panel-title">DEBUG</div>

        <div className="debug-section">
          <div className="debug-section-label">WORLD SEED</div>
          <div className="debug-seed-row">
            <input
              className="debug-seed-input"
              type="text"
              placeholder={worldSeed != null ? String(worldSeed) : 'seed'}
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApplySeed(); }}
            />
            <button className="debug-btn" onClick={handleApplySeed}>{'\u27F3'}</button>
          </div>
        </div>

        <div className="debug-section">
          <div className="debug-section-label">SYSTEM</div>
          <div className="debug-info-row">
            <span className="debug-info-value">{starName}</span>
            <span className="debug-info-label">idx: {currentSystemIndex}</span>
          </div>
        </div>

        <div className="debug-section">
          <div className="debug-section-label">CONNECTIONS</div>
          {connectedSystems.length === 0 && (
            <div className="debug-info-row">
              <span className="debug-info-label">none</span>
            </div>
          )}
          {worldSeed != null && connectedSystems.map((conn) => (
            <SystemPreview
              key={conn.systemIndex}
              conn={conn}
              worldSeed={worldSeed}
              onJump={handleJump}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
