// ── Gravitational constant ──────────────────────────────────────────
export const G = 6.674e-11; // m³/(kg·s²)

// ── Real solar system scales ────────────────────────────────────────
// Using actual Sun gravitational parameter
export const STAR_MU = 1.327124e20; // m³/s² (Sun)
export const STAR_MASS = 1.989e30;  // kg (Sun)

// ── Time compression ────────────────────────────────────────────────
// Real Earth orbit = 3.156e7s. At 50,000x → ~10.5 min real time.
export const TIME_COMPRESSION_STEPS = [1, 10, 100, 1000, 5000, 10000, 50000, 100000] as const;
export const DEFAULT_TIME_COMPRESSION = 10000;

// ── Physics substeps ────────────────────────────────────────────────
export const MAX_SUBSTEP_DT = 30; // game-seconds per substep

// ── Prediction ──────────────────────────────────────────────────────
export const PREDICTION_STEPS = 300;
export const PREDICTION_STEP_DT = 1000; // game-seconds per step → 300,000s lookahead

// ── Trail ───────────────────────────────────────────────────────────
export const TRAIL_MAX_POINTS = 500;
export const TRAIL_SAMPLE_INTERVAL = 100; // game-seconds between trail samples

// ── Ship defaults ───────────────────────────────────────────────────
export const SHIP_MAX_ACCELERATION = 9.81; // m/s² (~1g)
export const SHIP_FUEL_CAPACITY = 100000;  // kg
export const SHIP_FUEL_CONSUMPTION_RATE = 0.02; // kg/s at full thrust

// ── Body visual radii (rendering, not physical) ─────────────────────
export const MIN_BODY_PIXEL_RADIUS = 3;
