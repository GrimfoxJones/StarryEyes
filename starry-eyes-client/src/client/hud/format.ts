export function formatGameTime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (days > 0) {
    return `D${days} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatCompression(value: number): string {
  if (value >= 1000) return `${value / 1000}kx`;
  return `${value}x`;
}

export function formatSpeed(mps: number): string {
  if (mps > 1000) {
    return `${(mps / 1000).toFixed(1)} km/s`;
  }
  return `${mps.toFixed(0)} m/s`;
}

export function formatEta(seconds: number): string {
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

const AU = 149_597_870_700; // meters

export function formatDistance(meters: number): string {
  const abs = Math.abs(meters);
  if (abs >= AU * 0.1) return `${(meters / AU).toFixed(2)} AU`;
  if (abs >= 1e9) return `${(meters / 1e9).toFixed(1)} Gm`;
  if (abs >= 1e6) return `${(meters / 1e6).toFixed(1)} Mm`;
  if (abs >= 1e3) return `${(meters / 1e3).toFixed(0)} km`;
  return `${meters.toFixed(0)} m`;
}
