import { useGameStore } from './store.ts';
import './hud.css';

export function HudOverlay() {
  const snapshot = useGameStore((s) => s.snapshot);

  if (!snapshot) return null;

  const ship = snapshot.ships[0];
  const headingDeg = ship
    ? Math.round((Math.atan2(ship.heading.y, ship.heading.x) * 180) / Math.PI + 360) % 360
    : 0;

  return (
    <div className="hud">
      {/* Top-left: Time controls */}
      <div className="hud-panel hud-top-left">
        <div className="hud-label">GAME TIME</div>
        <div className="hud-value">{formatGameTime(snapshot.gameTime)}</div>
        <div className="hud-row">
          <span className="hud-label">WARP</span>
          <span className="hud-value">{snapshot.timeCompression}x</span>
          {snapshot.paused && <span className="hud-alert">PAUSED</span>}
        </div>
        <div className="hud-hint">SPACE=pause +/-=warp</div>
      </div>

      {/* Top-right: Velocity / heading */}
      {ship && (
        <div className="hud-panel hud-top-right">
          <div className="hud-label">VELOCITY</div>
          <div className="hud-value">{formatSpeed(ship.speed)}</div>
          <div className="hud-row">
            <span className="hud-label">HDG</span>
            <span className="hud-value">{headingDeg}&deg;</span>
          </div>
          <div className="hud-hint">Right-click to set heading</div>
        </div>
      )}

      {/* Bottom-left: Thrust + Fuel */}
      {ship && (
        <div className="hud-panel hud-bottom-left">
          <div className="hud-row">
            <span className="hud-label">THRUST</span>
            <span className="hud-value">
              {Math.round(ship.thrustLevel * 100)}%
              {ship.isThrusting && <span className="hud-active"> BURN</span>}
            </span>
          </div>
          <div className="hud-bar-container">
            <div
              className="hud-bar hud-bar-thrust"
              style={{ width: `${ship.thrustLevel * 100}%` }}
            />
          </div>
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
          <div className="hud-hint">Keys 0-9 set thrust</div>
        </div>
      )}
    </div>
  );
}

function formatGameTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatSpeed(mps: number): string {
  if (mps > 1000) {
    return `${(mps / 1000).toFixed(1)} km/s`;
  }
  return `${mps.toFixed(0)} m/s`;
}
