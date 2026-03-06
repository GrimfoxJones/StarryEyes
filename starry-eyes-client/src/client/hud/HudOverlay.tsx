import { useGameStore } from './store.ts';
import { LeftPanel } from './left-panel/LeftPanel.tsx';
import { DebugPanel } from './debug/DebugPanel.tsx';
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

  if (!snapshot) return null;

  const ship = snapshot.ships[0];
  const systemName = snapshot.bodies.find(b => b.type === 'star')?.name;

  return (
    <div className="hud">
      {/* Left panel (collapsible) */}
      <LeftPanel />

      {/* Top-left: Time (hidden when left panel is open — shown in TabBar instead) */}
      {!leftPanelOpen && (
        <div className="hud-panel hud-top-left">
          <div className="hud-label">GAME TIME</div>
          <div className="hud-value">{formatGameTime(snapshot.gameTime)}</div>
          {systemName && (
            <>
              <div className="hud-label">SYSTEM</div>
              <div className="hud-value">{systemName}</div>
            </>
          )}
        </div>
      )}

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

      {/* Bottom-left: Fuel (hidden when panel open — available in SYS) */}
      {ship && !leftPanelOpen && (
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

      {/* Right debug panel */}
      <DebugPanel />

      {/* Detail modal */}
      <DetailModal />
      <TravelDialog />
      <GateDialog />
    </div>
  );
}

