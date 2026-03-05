const BASE_YEAR = 2287;
const SECONDS_PER_DAY = 86400;
const DAYS_PER_YEAR = 365;
const SECONDS_PER_YEAR = SECONDS_PER_DAY * DAYS_PER_YEAR;

export function formatGameTime(seconds: number): string {
  const year = BASE_YEAR + Math.floor(seconds / SECONDS_PER_YEAR);
  const remainAfterYear = seconds % SECONDS_PER_YEAR;
  const day = Math.floor(remainAfterYear / SECONDS_PER_DAY) + 1; // 1-indexed
  const hour = Math.floor((remainAfterYear % SECONDS_PER_DAY) / 3600);
  return `${year}-${String(day).padStart(3, '0')} ${String(hour).padStart(2, '0')}:00`;
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

const EARTH_MASS = 5.972e24;

export function formatMassEarth(kg: number): string {
  const me = kg / EARTH_MASS;
  if (me >= 100) return `${me.toFixed(0)} M\u2295`;
  if (me >= 1) return `${me.toFixed(1)} M\u2295`;
  return `${me.toFixed(3)} M\u2295`;
}

export function formatRadiusKm(meters: number): string {
  return `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
}

export function formatTemperature(kelvin: number): string {
  if (kelvin >= 10000) return `${(kelvin / 1000).toFixed(0)}k K`;
  return `${kelvin.toFixed(0)} K`;
}

export function formatPressure(atm: number): string {
  if (atm < 0.001) return `${(atm * 1000).toFixed(1)} matm`;
  if (atm >= 1000) return `${(atm / 1000).toFixed(1)}k atm`;
  return `${atm.toFixed(2)} atm`;
}

export function formatRotation(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 48) return `${(hours / 24).toFixed(1)} d`;
  return `${hours.toFixed(1)} h`;
}

export function formatGravity(ms2: number): string {
  return `${(ms2 / 9.81).toFixed(2)} g`;
}

export function snakeCaseToTitle(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
