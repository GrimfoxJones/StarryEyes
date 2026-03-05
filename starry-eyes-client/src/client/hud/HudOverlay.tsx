import { useGameStore } from './store.ts';
import { LeftPanel } from './left-panel/LeftPanel.tsx';
import { DetailModal } from './modals/DetailModal.tsx';
import { TravelDialog } from './dialogs/TravelDialog.tsx';
import { formatGameTime, formatCompression, formatSpeed, formatEta } from './format.ts';
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
        </div>
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
              {snapshot.timeCompression > 1 && (
                <div className="hud-row">
                  <span className="hud-label">REAL</span>
                  <span className="hud-value hud-dim">{formatEta(ship.eta / snapshot.timeCompression)}</span>
                </div>
              )}
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

      {/* Detail modal */}
      <DetailModal />
      <TravelDialog />
    </div>
  );
}

