import { useGameStore } from '../store.ts';
import { vec2Dist } from '@starryeyes/shared';
import { brachistochroneTime } from '@starryeyes/shared';
import { formatEta, formatDistance } from '../format.ts';
import './TravelDialog.css';

export function TravelDialog() {
  const travelDialog = useGameStore((s) => s.travelDialog);
  const snapshot = useGameStore((s) => s.snapshot);
  const bridge = useGameStore((s) => s.bridge);
  const dismissTravelDialog = useGameStore((s) => s.dismissTravelDialog);
  const setTravelAcceleration = useGameStore((s) => s.setTravelAcceleration);

  if (!travelDialog || !snapshot || !bridge) return null;

  const ship = snapshot.ships.find((s) => s.id === bridge.getMyShipId());
  if (!ship) return null;

  const accelG = travelDialog.accelerationG;
  const accelMs2 = accelG * 9.81;

  // Find target body position
  let targetPos = ship.position;
  const dest = travelDialog.destination;
  if (dest.type === 'body') {
    const body = snapshot.bodies.find((b) => b.id === dest.bodyId);
    if (body) targetPos = body.position;
  }

  const distance = vec2Dist(ship.position, targetPos);
  const gameEta = brachistochroneTime(distance, accelMs2);
  const realEta = gameEta / snapshot.timeCompression;

  // Fuel burn: scale consumption rate by accel ratio, multiply by time
  // ship.fuelConsumptionRate is at full thrust (1g). Scale linearly by accelG.
  const fuelBurn = ship.fuelConsumptionRate * accelG * gameEta;
  const fuelPercent = (fuelBurn / ship.maxFuel) * 100;
  const insufficientFuel = fuelBurn > ship.fuel;

  function handleConfirm() {
    bridge!.sendCommand({
      type: 'SET_DESTINATION',
      shipId: bridge!.getMyShipId(),
      destination: travelDialog!.destination,
      acceleration: travelDialog!.accelerationG * 9.81,
    });
    dismissTravelDialog();
  }

  return (
    <div className="travel-dialog-backdrop" onClick={dismissTravelDialog}>
      <div className="travel-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="travel-dialog-header">
          <span className="travel-dialog-label">DESTINATION</span>
          <span className="travel-dialog-target">{travelDialog.targetName}</span>
        </div>

        <div className="travel-dialog-stats">
          <div className="travel-dialog-row">
            <span className="travel-dialog-label">DISTANCE</span>
            <span className="travel-dialog-value">{formatDistance(distance)}</span>
          </div>
          <div className="travel-dialog-row">
            <span className="travel-dialog-label">GAME ETA</span>
            <span className="travel-dialog-value">{formatEta(gameEta)}</span>
          </div>
          {snapshot.timeCompression > 1 && (
            <div className="travel-dialog-row">
              <span className="travel-dialog-label">REAL ETA</span>
              <span className="travel-dialog-value travel-dialog-dim">{formatEta(realEta)}</span>
            </div>
          )}
          <div className="travel-dialog-row">
            <span className="travel-dialog-label">FUEL BURN</span>
            <span className={`travel-dialog-value${insufficientFuel ? ' travel-dialog-danger' : ''}`}>
              {Math.round(fuelBurn).toLocaleString()} kg ({fuelPercent.toFixed(1)}%)
            </span>
          </div>
        </div>

        <div className="travel-dialog-slider-section">
          <div className="travel-dialog-row">
            <span className="travel-dialog-label">ACCEL</span>
            <span className="travel-dialog-value">{accelG.toFixed(2)}g</span>
          </div>
          <input
            type="range"
            className="travel-dialog-slider"
            min={0.01}
            max={1.0}
            step={0.01}
            value={accelG}
            onChange={(e) => setTravelAcceleration(parseFloat(e.target.value))}
          />
        </div>

        {insufficientFuel && (
          <div className="travel-dialog-warning">INSUFFICIENT FUEL</div>
        )}

        <div className="travel-dialog-buttons">
          <button className="travel-dialog-btn travel-dialog-btn-cancel" onClick={dismissTravelDialog}>
            CANCEL
          </button>
          <button
            className="travel-dialog-btn travel-dialog-btn-confirm"
            onClick={handleConfirm}
            disabled={insufficientFuel}
          >
            CONFIRM
          </button>
        </div>
      </div>
    </div>
  );
}
