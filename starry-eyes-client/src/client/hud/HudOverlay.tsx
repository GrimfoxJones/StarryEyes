import { useGameStore } from './store.ts';
import { LeftPanel } from './left-panel/LeftPanel.tsx';
import { DetailModal } from './modals/DetailModal.tsx';
import './theme.css';
import './hud.css';

export function HudOverlay() {
  const snapshot = useGameStore((s) => s.snapshot);
  const leftPanelOpen = useGameStore((s) => s.leftPanelOpen);

  if (!snapshot) return null;

  const ship = snapshot.ships[0];

  return (
    <div className="hud">
      {/* Left panel (collapsible) */}
      <LeftPanel />

      {/* Top-left: Time controls */}
      <div className={`hud-panel hud-top-left${leftPanelOpen ? ' panel-open' : ''}`}>
        <div className="hud-label">GAME TIME</div>
        <div className="hud-value">{formatGameTime(snapshot.gameTime)}</div>
        <div className="hud-row">
          <span className="hud-label">WARP</span>
          <span className="hud-value">{formatCompression(snapshot.timeCompression)}</span>
          {snapshot.paused && <span className="hud-alert">PAUSED</span>}
        </div>
        <div className="hud-hint">SPACE=pause +/-=warp</div>
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
            <div className="hud-row">
              <span className="hud-label">ETA</span>
              <span className="hud-value">{formatEta(ship.eta)}</span>
            </div>
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

      {/* Detail modal */}
      <DetailModal />
    </div>
  );
}

function formatGameTime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (days > 0) {
    return `D${days} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatCompression(value: number): string {
  if (value >= 1000) return `${value / 1000}kx`;
  return `${value}x`;
}

function formatSpeed(mps: number): string {
  if (mps > 1000) {
    return `${(mps / 1000).toFixed(1)} km/s`;
  }
  return `${mps.toFixed(0)} m/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}
