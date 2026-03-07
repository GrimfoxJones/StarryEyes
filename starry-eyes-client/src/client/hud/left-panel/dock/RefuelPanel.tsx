import { useState, useCallback } from 'react';
import { useGameStore } from '../../store.ts';
import type { RemoteBridge } from '../../../../RemoteBridge.ts';
import { DARTER_MASS } from '@starryeyes/shared';

const PRICE_PER_KG = 5;

const btnStyle = (enabled: boolean) => ({
  flex: 1,
  background: enabled ? 'rgba(0, 200, 100, 0.2)' : 'var(--bg-surface)',
  border: '1px solid',
  borderColor: enabled ? 'rgba(0, 200, 100, 0.4)' : 'var(--border-subtle)',
  color: enabled ? 'var(--status-nominal)' : 'var(--text-hint)',
  borderRadius: 2,
  fontSize: 11,
  padding: '6px 4px',
  cursor: enabled ? 'pointer' : 'default',
  fontFamily: 'var(--font-mono)',
});

export function RefuelPanel() {
  const bridge = useGameStore((s) => s.bridge) as RemoteBridge | null;
  const snapshot = useGameStore((s) => s.snapshot);
  const credits = useGameStore((s) => s.credits);

  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const myShip = snapshot?.ships.find(s => s.id === bridge?.getMyShipId());
  const fuel = myShip?.fuel ?? 0;
  const maxFuel = myShip?.maxFuel ?? DARTER_MASS.maxPropellant;
  const fuelNeeded = maxFuel - fuel;
  const fuelPercent = maxFuel > 0 ? fuel / maxFuel : 0;

  const stationId = myShip?.orbitBodyId ?? null;
  const stationBody = snapshot?.bodies.find(b => b.id === stationId && b.hasStation);

  const refuel = useCallback(async (amount: number) => {
    if (!bridge || amount <= 0) return;
    setError(null);
    setLastResult(null);
    const result = await bridge.executeRefuel(amount);
    if (result.success) {
      setLastResult(`Refueled ${Math.round(result.amount!)} kg for ${Math.round(result.cost!)} CR`);
    } else {
      setError(result.error ?? 'Refuel failed');
    }
  }, [bridge]);

  if (!stationBody) {
    return (
      <div style={{ padding: '12px 8px', color: 'var(--text-label)' }}>
        Not docked at a station.
      </div>
    );
  }

  // Preset amounts
  const quarter = Math.ceil(maxFuel * 0.25);
  const half = Math.ceil(maxFuel * 0.5);
  const full = Math.ceil(fuelNeeded);

  const canAfford = (amount: number) => credits >= amount * PRICE_PER_KG;
  const canRefuel = fuelNeeded > 0;

  // Bar color
  const barColor = fuelPercent < 0.1
    ? 'var(--status-danger)'
    : fuelPercent < 0.25
      ? 'var(--status-warning)'
      : 'var(--status-nominal)';

  return (
    <div style={{ padding: '12px 8px' }}>
      <div style={{
        color: 'var(--text-label)',
        fontSize: 'var(--font-size-sm)',
        letterSpacing: 1,
        marginBottom: 4,
        paddingLeft: 4,
      }}>
        PROPELLANT SERVICE
      </div>
      <div style={{
        color: 'var(--text-hint)',
        fontSize: 'var(--font-size-xs)',
        marginBottom: 16,
        paddingLeft: 4,
      }}>
        Hydrogen reaction mass @ {PRICE_PER_KG} CR/kg
      </div>

      {/* Tank gauge */}
      <div style={{ padding: '0 4px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)' }}>TANK LEVEL</span>
          <span style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)' }}>
            {Math.round(fuel).toLocaleString()} / {Math.round(maxFuel).toLocaleString()} kg
          </span>
        </div>
        <div style={{
          height: 12,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${(fuelPercent * 100).toFixed(1)}%`,
            background: barColor,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ color: 'var(--text-hint)', fontSize: 'var(--font-size-xs)' }}>
            {(fuelPercent * 100).toFixed(1)}%
          </span>
          <span style={{ color: 'var(--text-hint)', fontSize: 'var(--font-size-xs)' }}>
            {Math.round(fuelNeeded).toLocaleString()} kg needed
          </span>
        </div>
      </div>

      {/* Credits */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0 4px',
        marginBottom: 16,
      }}>
        <span style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)' }}>CREDITS</span>
        <span style={{ color: 'var(--accent-cyan)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)' }}>
          {Math.round(credits).toLocaleString()} CR
        </span>
      </div>

      {/* Refuel options */}
      <div style={{
        color: 'var(--text-label)',
        fontSize: 'var(--font-size-xs)',
        letterSpacing: 0.5,
        marginBottom: 8,
        paddingLeft: 4,
      }}>
        REFUEL OPTIONS
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px' }}>
        <RefuelOption
          label="+25%"
          amount={Math.min(quarter, fuelNeeded)}
          price={Math.min(quarter, fuelNeeded) * PRICE_PER_KG}
          enabled={canRefuel && canAfford(Math.min(quarter, fuelNeeded)) && fuelNeeded > 0}
          onRefuel={refuel}
        />
        <RefuelOption
          label="+50%"
          amount={Math.min(half, fuelNeeded)}
          price={Math.min(half, fuelNeeded) * PRICE_PER_KG}
          enabled={canRefuel && canAfford(Math.min(half, fuelNeeded)) && fuelNeeded > 0}
          onRefuel={refuel}
        />
        <RefuelOption
          label="FILL"
          amount={full}
          price={full * PRICE_PER_KG}
          enabled={canRefuel && canAfford(full) && fuelNeeded > 0}
          onRefuel={refuel}
        />
      </div>

      {/* Result / Error */}
      {lastResult && (
        <div style={{
          padding: '6px 8px',
          marginTop: 8,
          color: 'var(--status-nominal)',
          fontSize: 'var(--font-size-sm)',
          background: 'rgba(0, 200, 100, 0.1)',
          borderRadius: 3,
        }}>
          {lastResult}
        </div>
      )}
      {error && (
        <div style={{
          padding: '6px 8px',
          marginTop: 8,
          color: 'var(--status-danger)',
          fontSize: 'var(--font-size-sm)',
          background: 'rgba(255, 68, 68, 0.1)',
          borderRadius: 3,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

function RefuelOption({ label, amount, price, enabled, onRefuel }: {
  label: string;
  amount: number;
  price: number;
  enabled: boolean;
  onRefuel: (amount: number) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          {Math.round(amount).toLocaleString()} kg
        </span>
        <span style={{ color: 'var(--text-label)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          {Math.round(price).toLocaleString()} CR
        </span>
      </div>
      <button
        onClick={() => onRefuel(amount)}
        disabled={!enabled}
        style={{ ...btnStyle(enabled), flex: 'none', width: 60 }}
      >
        {label}
      </button>
    </div>
  );
}
