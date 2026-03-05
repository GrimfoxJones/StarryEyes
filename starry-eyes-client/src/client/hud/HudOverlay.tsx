import { useState, useCallback } from 'react';
import { useGameStore } from './store.ts';
import { LeftPanel } from './left-panel/LeftPanel.tsx';
import { DetailModal } from './modals/DetailModal.tsx';
import { TravelDialog } from './dialogs/TravelDialog.tsx';
import { GateDialog } from './dialogs/GateDialog.tsx';
import { formatGameTime, formatSpeed, formatEta } from './format.ts';
import { TIME_COMPRESSION } from '@starryeyes/shared';
import './theme.css';
import './hud.css';

export function HudOverlay() {
  const snapshot = useGameStore((s) => s.snapshot);
  const leftPanelOpen = useGameStore((s) => s.leftPanelOpen);
  const [seedInput, setSeedInput] = useState('');
  const [systemInfo, setSystemInfo] = useState<{ starName: string; seed: number } | null>(null);

  const handleRandomize = useCallback(async () => {
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
        const data = await res.json() as { seed: number; starName: string; planetCount: number };
        setSystemInfo({ starName: data.starName, seed: data.seed });
        setSeedInput('');
      }
    } catch {
      // ignore network errors
    }
  }, [seedInput]);

  if (!snapshot) return null;

  const ship = snapshot.ships[0];

  // Derive current system name from the star body in snapshot
  const starBody = snapshot.bodies.find(b => b.type === 'star');
  const currentSystemName = starBody?.name ?? systemInfo?.starName ?? null;
  const currentSeed = systemInfo?.seed ?? null;

  return (
    <div className="hud">
      {/* Left panel (collapsible) */}
      <LeftPanel />

      {/* Top-left: Time controls */}
      <div className={`hud-panel hud-top-left${leftPanelOpen ? ' panel-open' : ''}`}>
        <div className="hud-label">GAME TIME</div>
        <div className="hud-value">{formatGameTime(snapshot.gameTime)}</div>
      </div>

      {/* Top-right: Mode / Velocity / Destination / ETA */}
      {ship && (
        <div className="hud-panel hud-top-right">
          <div className="hud-row">
            <span className="hud-label">MODE</span>
            <span className="hud-value">{ship.mode.toUpperCase()}</span>
          </div>
          <div className="hud-label">VELOCITY</div>
          <div className="hud-value">{formatSpeed(ship.speed)}</div>
          {ship.destinationName && (
            <div className="hud-row">
              <span className="hud-label">DEST</span>
              <span className="hud-value">{ship.destinationName}</span>
            </div>
          )}
          {ship.eta != null && ship.eta > 0 && (
            <>
              <div className="hud-row">
                <span className="hud-label">ETA</span>
                <span className="hud-value">{formatEta(ship.eta)}</span>
              </div>
              <div className="hud-row">
                <span className="hud-label">REAL</span>
                <span className="hud-value hud-dim">{formatEta(ship.eta / TIME_COMPRESSION)}</span>
              </div>
            </>
          )}
          {ship.isDecelerating && (
            <span className="hud-alert">DECEL</span>
          )}
        </div>
      )}

      {/* Bottom-left: Fuel */}
      {ship && (
        <div className="hud-panel hud-bottom-left">
          <div className="hud-row">
            <span className="hud-label">FUEL</span>
            <span className="hud-value">
              {Math.round((ship.fuel / ship.maxFuel) * 100)}%
            </span>
          </div>
          <div className="hud-bar-container">
            <div
              className="hud-bar hud-bar-fuel"
              style={{ width: `${(ship.fuel / ship.maxFuel) * 100}%` }}
            />
          </div>
          <div className="hud-hint">Right-click=destination ESC=cancel</div>
        </div>
      )}

      {/* Bottom-right: System info / Randomize */}
      <div className="hud-panel hud-bottom-right">
        {currentSystemName && (
          <div className="hud-row">
            <span className="hud-label">SYSTEM</span>
            <span className="hud-value">{currentSystemName}</span>
          </div>
        )}
        {currentSeed != null && (
          <div className="hud-row">
            <span className="hud-label">SEED</span>
            <span className="hud-value hud-dim">{currentSeed}</span>
          </div>
        )}
        <div className="hud-row" style={{ gap: '4px', marginTop: '4px' }}>
          <input
            className="hud-seed-input"
            type="text"
            placeholder="seed"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRandomize(); }}
          />
          <button className="hud-btn" onClick={handleRandomize}>RANDOMIZE</button>
        </div>
      </div>

      {/* Detail modal */}
      <DetailModal />
      <TravelDialog />
      <GateDialog />
    </div>
  );
}

