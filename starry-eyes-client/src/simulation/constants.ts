// ── Gravitational constant ──────────────────────────────────────────
export const G = 6.674e-11; // m³/(kg·s²)

// ── System scale ────────────────────────────────────────────────────
// System radius ~1e11 m (100,000 km)
// Tellus: a = 2e10 m, target T ≈ 600 game-seconds
// μ = 4π²a³/T² = 4π²·(2e10)³ / 600²
export const STAR_MU = (4 * Math.PI * Math.PI * Math.pow(2e10, 3)) / (600 * 600);
// ≈ 8.77e23 m³/s²

export const STAR_MASS = STAR_MU / G; // ≈ 1.31e34 kg (tuned for gameplay, not realism)

// ── Time compression ────────────────────────────────────────────────
export const TIME_COMPRESSION_STEPS = [1, 10, 30, 60, 100] as const;
export const DEFAULT_TIME_COMPRESSION = 30;

// ── Physics substeps ────────────────────────────────────────────────
export const MAX_SUBSTEP_DT = 1; // game-seconds per substep (keep integration stable)

// ── Prediction ──────────────────────────────────────────────────────
export const PREDICTION_STEPS = 300;
export const PREDICTION_STEP_DT = 2; // game-seconds per prediction step

// ── Trail ───────────────────────────────────────────────────────────
export const TRAIL_MAX_POINTS = 500;
export const TRAIL_SAMPLE_INTERVAL = 2; // game-seconds between trail samples

// ── Ship defaults ───────────────────────────────────────────────────
export const SHIP_MAX_ACCELERATION = 14.7; // m/s² (~1.5g)
export const SHIP_FUEL_CAPACITY = 10000; // kg
export const SHIP_FUEL_CONSUMPTION_RATE = 5; // kg/s at full thrust

// ── Body visual radii (rendering, not physical) ─────────────────────
export const MIN_BODY_PIXEL_RADIUS = 3;
