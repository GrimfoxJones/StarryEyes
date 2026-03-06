import { useState, useRef, useCallback } from 'react';
import type { SystemValue, SubsystemCommand } from '@starryeyes/shared';
import { useGameStore } from '../../store.ts';
import './subsystems.css';

function formatNumber(value: number, precision: number): string {
  if (value == null || !isFinite(value)) return '\u221E';
  return value.toFixed(precision);
}

function formatValue(sv: SystemValue): string {
  const v = sv.value;
  if (v == null) return '--';
  if (typeof v === 'boolean') return v ? 'ON' : 'OFF';
  if (typeof v === 'string') return v;
  return formatNumber(v, sv.precision ?? 1);
}

function getThresholdClass(value: number, sv: SystemValue): string {
  if (sv.criticalThreshold != null && value >= sv.criticalThreshold) return 'value-row--critical';
  if (sv.criticalBelow != null && value <= sv.criticalBelow) return 'value-row--critical';
  if (sv.warnThreshold != null && value >= sv.warnThreshold) return 'value-row--warn';
  if (sv.warnBelow != null && value <= sv.warnBelow) return 'value-row--warn';
  return '';
}

function sendCommand(cmd: SubsystemCommand) {
  const bridge = useGameStore.getState().bridge;
  bridge?.sendSubsystemCommand?.(cmd);
}

interface Props {
  label: string;
  sv: SystemValue;
  nodeId: string;
  valueKey: string;
}

export function SystemValueView({ label, sv, nodeId, valueKey }: Props) {
  const hint = sv.displayHint ?? 'number';

  if (hint === 'toggle' && typeof sv.value === 'boolean') {
    return <ToggleView label={label} sv={sv} nodeId={nodeId} valueKey={valueKey} />;
  }

  if (hint === 'slider' && typeof sv.value === 'number' && sv.control !== 'simulated') {
    return <SliderView label={label} sv={sv} nodeId={nodeId} valueKey={valueKey} />;
  }

  if ((hint === 'gauge' || hint === 'bar') && typeof sv.value === 'number') {
    return <GaugeView label={label} sv={sv} />;
  }

  // Default: number or enum
  const thresholdClass = typeof sv.value === 'number' ? getThresholdClass(sv.value, sv) : '';
  return (
    <div className={`value-row ${thresholdClass}`}>
      <span className="value-row__label">{label}</span>
      <span className="value-row__value">{formatValue(sv)}</span>
      {sv.unit && <span className="value-row__unit">{sv.unit}</span>}
    </div>
  );
}

// ── Toggle: local-first, sends command on click ──────────────────────

function ToggleView({ label, sv, nodeId, valueKey }: Props) {
  const interactive = sv.control === 'player' || sv.control === 'controlled';
  // Local override: tracks pending state until server confirms
  const [localOverride, setLocalOverride] = useState<boolean | null>(null);

  const displayValue = localOverride ?? (sv.value as boolean);

  // Clear override when server catches up
  if (localOverride !== null && sv.value === localOverride) {
    // Server confirmed — clear on next render
    queueMicrotask(() => setLocalOverride(null));
  }

  const handleClick = () => {
    if (!interactive) return;
    const newValue = !displayValue;
    setLocalOverride(newValue);
    sendCommand({ type: 'SET_VALUE', nodeId, key: valueKey, value: newValue });
  };

  return (
    <div className="value-row">
      <span className="value-row__label">{label}</span>
      <div
        className={`toggle-switch${interactive ? '' : ' toggle-switch--readonly'}`}
        onClick={handleClick}
      >
        <div className={`toggle-indicator${displayValue ? ' toggle-indicator--on' : ''}`}>
          <div className="toggle-indicator__dot" />
        </div>
        <span className="toggle-label">{displayValue ? 'ON' : 'OFF'}</span>
      </div>
    </div>
  );
}

// ── Slider: local-first, holds override until server confirms ────────

function SliderView({ label, sv, nodeId, valueKey }: Props) {
  const serverValue = sv.value as number;
  const [localValue, setLocalValue] = useState<number | null>(null);
  const sentValue = useRef<number | null>(null);

  // Clear local override once server value matches what we sent
  if (localValue !== null && sentValue.current !== null) {
    const eps = Math.pow(10, -(sv.precision ?? 2)) * 0.5;
    if (Math.abs(serverValue - sentValue.current) < eps) {
      // Server confirmed our value — clear override on next render
      queueMicrotask(() => {
        setLocalValue(null);
        sentValue.current = null;
      });
    }
  }

  const displayValue = localValue ?? serverValue;
  const thresholdClass = getThresholdClass(displayValue, sv);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setLocalValue(v);
    // Send immediately on each change so server tracks live
    sentValue.current = v;
    sendCommand({ type: 'SET_VALUE', nodeId, key: valueKey, value: v });
  }, [nodeId, valueKey]);

  return (
    <div className={`value-row ${thresholdClass}`}>
      <span className="value-row__label">{label}</span>
      <div className="gauge-container">
        <input
          type="range"
          className="slider-input"
          min={sv.min ?? 0}
          max={sv.max ?? 1}
          step={Math.pow(10, -(sv.precision ?? 2))}
          value={displayValue}
          onChange={handleChange}
        />
        <span className="gauge-bar__text">
          {formatNumber(displayValue, sv.precision ?? 2)}{sv.unit ? ` ${sv.unit}` : ''}
        </span>
      </div>
    </div>
  );
}

// ── Gauge/Bar: read-only display ─────────────────────────────────────

function GaugeView({ label, sv }: { label: string; sv: SystemValue }) {
  const value = sv.value as number;
  const min = sv.min ?? 0;
  const max = sv.max ?? 1;
  const fraction = max > min ? (value - min) / (max - min) : 0;
  const pct = Math.max(0, Math.min(100, fraction * 100));
  const thresholdClass = getThresholdClass(value, sv);

  let fillClass = 'gauge-bar__fill';
  if (thresholdClass.includes('critical')) fillClass += ' gauge-bar__fill--critical';
  else if (thresholdClass.includes('warn')) fillClass += ' gauge-bar__fill--warn';

  return (
    <div className={`value-row ${thresholdClass}`}>
      <span className="value-row__label">{label}</span>
      <div className="gauge-container">
        <div className="gauge-bar">
          <div className={fillClass} style={{ width: `${pct}%` }} />
        </div>
        <span className="gauge-bar__text">{formatValue(sv)}{sv.unit ? ` ${sv.unit}` : ''}</span>
      </div>
    </div>
  );
}
