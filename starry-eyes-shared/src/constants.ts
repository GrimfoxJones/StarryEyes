// ── Gravitational constant ──────────────────────────────────────────
export const G = 6.674e-11; // m³/(kg·s²)

// ── Real solar system scales ────────────────────────────────────────
// Using actual Sun gravitational parameter
export const STAR_MU = 1.327124e20; // m³/s² (Sun)
export const STAR_MASS = 1.989e30;  // kg (Sun)

// ── Time compression (fixed) ────────────────────────────────────────
// At 365x, 1 real day ≈ 1 Earth year in-game.
export const TIME_COMPRESSION = 365;

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

// ── Nav computer ─────────────────────────────────────────────────────
export const ORBIT_VISUAL_RADIUS = 5e7;   // 50k km visual orbit distance
export const ORBIT_VISUAL_SPEED = 0.05;   // rad/s visual orbit speed
export const BODY_CLICK_THRESHOLD_PX = 30; // pixels for body click detection

// ── Body visual radii (rendering, not physical) ─────────────────────
export const MIN_BODY_PIXEL_RADIUS = 3;
