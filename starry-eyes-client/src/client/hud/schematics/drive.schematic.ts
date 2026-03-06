import type { SchematicDocument, Shape } from './schematic-schema.ts';

// FLARE Drive — Magnetic Confinement Thruster Cross-Section

export interface DriveParams {
  throttle: number;         // 0–1: current throttle setting
  thrustFraction: number;   // 0–1: thrust_output / max_thrust
  temperature: number;      // 0–1: drive_temperature / max (2000K)
  reactionMassRatio: number; // 0.3–1.0: reaction mass mix ratio
  nozzleRatio: number;      // 0.5–1.0: magnetic nozzle constriction
}

export const defaultDriveParams: DriveParams = {
  throttle: 0,
  thrustFraction: 0,
  temperature: 0.14,
  reactionMassRatio: 0.72,
  nozzleRatio: 0.85,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Drive chamber layout (horizontal, nozzle at left)
// ViewBox: 780 x 460
//
//   [FUEL IN]─────┐
//                  ├──[CHAMBER]──[THROAT]──[NOZZLE EXIT]→ exhaust
//   [COOLANT]─────┘
//
// Chamber: rect from x=320 to x=560, centered at cy=230
// Throat: narrows at x=280–320
// Nozzle: flares from x=140 to x=280
// Exhaust: extends left of x=140

const CY = 230;
const CHAMBER_L = 320;
const CHAMBER_R = 560;
const CHAMBER_HALF_H = 60;
const THROAT_L = 270;
const NOZZLE_EXIT_X = 140;
const NOZZLE_EXIT_HALF = 45;

// Magnetic coil positions along the chamber+throat
const COIL_XS = [540, 500, 460, 420, 380, 340, 310, 285];

function coilHalfH(x: number): number {
  // Coils follow the chamber profile — full height in chamber, narrowing at throat
  if (x >= CHAMBER_L) return CHAMBER_HALF_H + 12;
  // Throat narrows linearly
  const t = (x - THROAT_L) / (CHAMBER_L - THROAT_L);
  return lerp(32, CHAMBER_HALF_H + 12, t);
}

export function driveSchematic(params: DriveParams = defaultDriveParams): SchematicDocument {
  const { throttle, thrustFraction, temperature, reactionMassRatio, nozzleRatio } = params;

  const t = Math.max(0, Math.min(1, thrustFraction));

  // Coil visuals — scale with nozzle ratio (constriction strength)
  const coilOpacity = lerp(0.15, 0.65, nozzleRatio);
  const coilPulseFrom = lerp(0.08, 0.35, nozzleRatio);
  const coilPulseTo = lerp(0.15, 0.75, nozzleRatio);
  const coilGlow = lerp(0.5, 2.5, nozzleRatio);

  // Plasma inside chamber — tied to throttle
  const plasmaOpacity = t > 0.02 ? lerp(0.1, 0.7, t) : 0;
  const plasmaGlow = lerp(1, 5, t);
  const plasmaFlicker = t > 0 ? lerp(1.2, 0.4, t) : 0;

  // Exhaust plume — extends from nozzle exit leftward
  const plumeLen = t > 0.02 ? lerp(10, 80, t) : 0;
  const plumeWidth = t > 0.02 ? lerp(8, 38, t) : 0;
  const coreWidth = t > 0.02 ? lerp(3, 14, t) : 0;
  const plumeOpacity = lerp(0.15, 0.6, t);
  const coreOpacity = lerp(0.3, 0.9, t);

  // Fuel flow — tied to throttle * reaction mass ratio
  const fuelFlow = t * reactionMassRatio;
  const fuelDuration = fuelFlow > 0.02 ? lerp(4, 0.8, fuelFlow) : 0;
  const fuelOpacity = lerp(0.2, 0.8, fuelFlow);

  // Coolant flow — ramps up with temperature
  const coolantDuration = temperature > 0.05 ? lerp(6, 1.5, temperature) : 0;
  const coolantOpacity = lerp(0.15, 0.7, temperature);

  // Status
  const statusLabel = t < 0.02 ? 'STANDBY'
    : t < 0.3 ? 'LOW THRUST'
    : t < 0.7 ? 'CRUISE'
    : 'FULL BURN';

  const thrustStr = `${(thrustFraction * 180).toFixed(0)} kN`;
  const tempStr = `${(temperature * 2000).toFixed(0)} K`;

  // Chamber profile path (top half, mirrored)
  // Right side (closed end) → chamber → throat → nozzle flare → exit
  const chamberTop = `M ${CHAMBER_R + 15},${CY - CHAMBER_HALF_H} L ${CHAMBER_L},${CY - CHAMBER_HALF_H} L ${THROAT_L},${CY - 28} L ${NOZZLE_EXIT_X},${CY - NOZZLE_EXIT_HALF}`;
  const chamberBot = `M ${NOZZLE_EXIT_X},${CY + NOZZLE_EXIT_HALF} L ${THROAT_L},${CY + 28} L ${CHAMBER_L},${CY + CHAMBER_HALF_H} L ${CHAMBER_R + 15},${CY + CHAMBER_HALF_H}`;
  const chamberClosed = `M ${CHAMBER_R + 15},${CY - CHAMBER_HALF_H} L ${CHAMBER_R + 15},${CY + CHAMBER_HALF_H}`;

  // Nozzle constriction indicator lines at throat
  const throatInner = 28 * nozzleRatio;

  // Build coil shapes
  const coilShapes: Shape[] = COIL_XS.map(cx => ({
    type: 'ellipse' as const,
    cx, cy: CY,
    rx: 5, ry: coilHalfH(cx),
    style: {
      stroke: '#38bdf8', strokeWidth: 1.5, fill: 'none', opacity: coilOpacity,
      effect: { type: 'glow' as const, blur: coilGlow },
      animation: { type: 'pulse' as const, attribute: 'opacity',
        from: coilPulseFrom, to: coilPulseTo, duration: 2.2, easing: 'ease-in-out' as const },
    },
  }));

  // Plasma glow inside chamber
  const plasmaShapes: Shape[] = t > 0.02 ? [
    // Full chamber fill glow
    { type: 'ellipse', cx: (CHAMBER_L + CHAMBER_R) / 2, cy: CY,
      rx: (CHAMBER_R - CHAMBER_L) / 2 - 8, ry: CHAMBER_HALF_H - 12,
      style: { stroke: 'none', fill: '#60b0ff', opacity: plasmaOpacity * 0.3,
        effect: { type: 'glow', blur: plasmaGlow },
        animation: { type: 'pulse', attribute: 'opacity',
          from: plasmaOpacity * 0.3, to: plasmaOpacity * 0.12, duration: plasmaFlicker * 1.3, easing: 'ease-in-out' } } },
    // Bright core stream along centerline
    { type: 'path',
      d: `M ${CHAMBER_R - 10},${CY} L ${THROAT_L + 5},${CY}`,
      style: { stroke: '#a0d4ff', strokeWidth: lerp(2, 8, t), fill: 'none', opacity: plasmaOpacity,
        effect: { type: 'glow', blur: lerp(2, 6, t) },
        animation: { type: 'pulse', attribute: 'opacity',
          from: plasmaOpacity, to: plasmaOpacity * 0.6, duration: plasmaFlicker, easing: 'ease-in-out' } } },
    // Accelerating stream through throat into nozzle
    { type: 'path',
      d: `M ${THROAT_L + 5},${CY} L ${NOZZLE_EXIT_X + 10},${CY}`,
      style: { stroke: '#c0e8ff', strokeWidth: lerp(1.5, 5, t), fill: 'none', opacity: plasmaOpacity * 1.2,
        effect: { type: 'glow', blur: lerp(1, 4, t) },
        animation: { type: 'flowDash', dasharray: '12 6', duration: lerp(1.5, 0.4, t), direction: 'forward' } } },
  ] : [];

  // Exhaust plume shapes
  const exhaustShapes: Shape[] = t > 0.02 ? [
    // Outer glow
    { type: 'ellipse', cx: NOZZLE_EXIT_X - plumeLen * 0.35, cy: CY,
      rx: plumeLen * 0.7, ry: plumeWidth,
      style: { stroke: 'none', fill: '#1e70d0', opacity: plumeOpacity * 0.4,
        effect: { type: 'glow', blur: 8 },
        animation: { type: 'pulse', attribute: 'opacity',
          from: plumeOpacity * 0.4, to: plumeOpacity * 0.15, duration: plasmaFlicker * 1.2, easing: 'ease-in-out' } } },
    // Mid plume
    { type: 'ellipse', cx: NOZZLE_EXIT_X - plumeLen * 0.25, cy: CY,
      rx: plumeLen * 0.55, ry: plumeWidth * 0.55,
      style: { stroke: 'none', fill: '#60b0ff', opacity: plumeOpacity * 0.7,
        effect: { type: 'glow', blur: 4 },
        animation: { type: 'pulse', attribute: 'opacity',
          from: plumeOpacity * 0.7, to: plumeOpacity * 0.35, duration: plasmaFlicker, easing: 'ease-in-out' } } },
    // Core
    { type: 'ellipse', cx: NOZZLE_EXIT_X - plumeLen * 0.12, cy: CY,
      rx: plumeLen * 0.4, ry: coreWidth,
      style: { stroke: 'none', fill: '#c0e8ff', opacity: coreOpacity,
        animation: { type: 'pulse', attribute: 'opacity',
          from: coreOpacity, to: coreOpacity * 0.7, duration: plasmaFlicker * 0.7, easing: 'ease-in-out' } } },
    // Hot spot at nozzle exit
    { type: 'ellipse', cx: NOZZLE_EXIT_X, cy: CY,
      rx: 4, ry: lerp(4, 16, t),
      style: { stroke: 'none', fill: '#ffffff', opacity: lerp(0.4, 0.95, t),
        effect: { type: 'glow', blur: 3 },
        animation: { type: 'pulse', attribute: 'opacity',
          from: lerp(0.4, 0.95, t), to: lerp(0.2, 0.6, t), duration: plasmaFlicker * 0.5, easing: 'ease-in-out' } } },
  ] : [];

  return {
    meta: {
      vessel: 'DSV NEMESIS-7',
      system: `FLARE DRIVE \u2014 ${statusLabel}`,
      subsystem: 'MAGNETIC CONFINEMENT THRUSTER',
      revision: '4.1.0',
      classification: 'RESTRICTED \u2014 GRIMFOX NAVAL SYSTEMS',
    },
    viewBox: { width: 780, height: 460 },
    background: '#030a12',
    gradients: [
      {
        type: 'linear', id: 'chamberFill',
        x1: 1, y1: 0, x2: 0, y2: 0,
        stops: [
          { offset: 0, color: '#0a1929', opacity: 1 },
          { offset: 0.6, color: '#06101c', opacity: 1 },
          { offset: 1, color: '#040c14', opacity: 1 },
        ],
      },
    ],
    layers: [
      // === STRUCTURE ===
      {
        id: 'structure', label: 'STRUCTURE', defaultOn: true, toggleable: false,
        shapes: [
          // Chamber walls — top
          { type: 'path', d: chamberTop,
            style: { stroke: '#1e3a5f', strokeWidth: 1.8, fill: 'none' } },
          // Chamber walls — bottom
          { type: 'path', d: chamberBot,
            style: { stroke: '#1e3a5f', strokeWidth: 1.8, fill: 'none' } },
          // Closed end (right)
          { type: 'path', d: chamberClosed,
            style: { stroke: '#1e3a5f', strokeWidth: 2, fill: 'none' } },
          // Inner chamber fill
          { type: 'path',
            d: `${chamberTop} L ${NOZZLE_EXIT_X},${CY + NOZZLE_EXIT_HALF} L ${THROAT_L},${CY + 28} L ${CHAMBER_L},${CY + CHAMBER_HALF_H} L ${CHAMBER_R + 15},${CY + CHAMBER_HALF_H} Z`,
            style: { stroke: 'none', fill: 'url(#chamberFill)' } },

          // Inner wall detail lines
          { type: 'path', d: `M ${CHAMBER_R + 10},${CY - CHAMBER_HALF_H + 5} L ${CHAMBER_L + 5},${CY - CHAMBER_HALF_H + 5} L ${THROAT_L + 5},${CY - 24}`,
            style: { stroke: '#0e2535', strokeWidth: 0.7, fill: 'none' } },
          { type: 'path', d: `M ${CHAMBER_R + 10},${CY + CHAMBER_HALF_H - 5} L ${CHAMBER_L + 5},${CY + CHAMBER_HALF_H - 5} L ${THROAT_L + 5},${CY + 24}`,
            style: { stroke: '#0e2535', strokeWidth: 0.7, fill: 'none' } },

          // Throat section markers
          { type: 'line', x1: CHAMBER_L, y1: CY - CHAMBER_HALF_H - 8, x2: CHAMBER_L, y2: CY + CHAMBER_HALF_H + 8,
            style: { stroke: '#0e2535', strokeWidth: 0.8, fill: 'none',
              animation: { type: 'flowDash', dasharray: '3 4', duration: 0 } } },
          { type: 'line', x1: THROAT_L, y1: CY - 36, x2: THROAT_L, y2: CY + 36,
            style: { stroke: '#0e2535', strokeWidth: 0.8, fill: 'none',
              animation: { type: 'flowDash', dasharray: '3 4', duration: 0 } } },

          // Centerline
          { type: 'line', x1: 80, y1: CY, x2: 660, y2: CY,
            style: { stroke: '#0e2535', strokeWidth: 0.4, fill: 'none',
              animation: { type: 'flowDash', dasharray: '6 8', duration: 0 } } },

          // Nozzle exit ring
          { type: 'line', x1: NOZZLE_EXIT_X, y1: CY - NOZZLE_EXIT_HALF - 3, x2: NOZZLE_EXIT_X, y2: CY - NOZZLE_EXIT_HALF + 6,
            style: { stroke: '#1e3a5f', strokeWidth: 1.2, fill: 'none' } },
          { type: 'line', x1: NOZZLE_EXIT_X, y1: CY + NOZZLE_EXIT_HALF - 6, x2: NOZZLE_EXIT_X, y2: CY + NOZZLE_EXIT_HALF + 3,
            style: { stroke: '#1e3a5f', strokeWidth: 1.2, fill: 'none' } },

          // Injector ports (right end of chamber)
          { type: 'circle', cx: CHAMBER_R + 15, cy: CY - 30, r: 4,
            style: { stroke: '#1e3a5f', strokeWidth: 1, fill: '#0a1420' } },
          { type: 'circle', cx: CHAMBER_R + 15, cy: CY, r: 5,
            style: { stroke: '#1e3a5f', strokeWidth: 1, fill: '#0a1420' } },
          { type: 'circle', cx: CHAMBER_R + 15, cy: CY + 30, r: 4,
            style: { stroke: '#1e3a5f', strokeWidth: 1, fill: '#0a1420' } },
        ],
        annotations: [
          // Section labels
          { type: 'text', x: (CHAMBER_L + CHAMBER_R) / 2, y: CY - CHAMBER_HALF_H - 18,
            content: 'REACTION CHAMBER', anchor: 'middle', size: 6, color: '#2a5a7a' },
          { type: 'text', x: (THROAT_L + CHAMBER_L) / 2, y: CY - 45,
            content: 'THROAT', anchor: 'middle', size: 5, color: '#1a4050' },
          { type: 'text', x: (NOZZLE_EXIT_X + THROAT_L) / 2, y: CY - NOZZLE_EXIT_HALF - 14,
            content: 'MAG. NOZZLE', anchor: 'middle', size: 5, color: '#1a4050' },

          // Callouts
          { type: 'callout',
            from: { x: CHAMBER_R + 15, y: CY - 30 },
            to: { x: CHAMBER_R + 70, y: CY - 65 },
            label: 'PLASMA INJECTOR', color: '#4a8a9e' },
          { type: 'callout',
            from: { x: CHAMBER_R + 15, y: CY + 30 },
            to: { x: CHAMBER_R + 70, y: CY + 65 },
            label: 'COOLANT PORT', color: '#4a8a9e' },

          // Dimension
          { type: 'dimension',
            from: { x: NOZZLE_EXIT_X, y: CY + NOZZLE_EXIT_HALF + 50 },
            to: { x: CHAMBER_R + 15, y: CY + NOZZLE_EXIT_HALF + 50 },
            label: '4.8m \u2014 DRIVE LENGTH', color: '#4a8a9e' },

          // Thrust readout
          { type: 'text', x: 100, y: CY + NOZZLE_EXIT_HALF + 50,
            content: `THRUST: ${thrustStr}`, anchor: 'start', size: 7,
            color: t > 0.02 ? '#60b0ff' : '#1a4050' },
          { type: 'text', x: 100, y: CY + NOZZLE_EXIT_HALF + 65,
            content: `TEMP: ${tempStr}`, anchor: 'start', size: 6,
            color: temperature > 0.6 ? '#f59e0b' : '#1a4050' },

          // Direction
          { type: 'text', x: 85, y: CY + NOZZLE_EXIT_HALF + 90,
            content: '\u2190 EXHAUST', anchor: 'start', size: 6, color: '#1a4557' },
          { type: 'text', x: CHAMBER_R + 60, y: CY + NOZZLE_EXIT_HALF + 90,
            content: 'SHIP FWD \u2192', anchor: 'end', size: 6, color: '#1a4557' },
        ],
      },

      // === MAGNETIC COILS ===
      {
        id: 'coils', label: 'MAG. COILS', color: '#38bdf8', defaultOn: true,
        shapes: [
          ...coilShapes,
          // Constriction field lines at throat (show nozzle ratio)
          { type: 'line', x1: THROAT_L - 10, y1: CY - throatInner, x2: THROAT_L + 10, y2: CY - throatInner,
            style: { stroke: '#38bdf8', strokeWidth: 0.8, fill: 'none', opacity: coilOpacity * 0.7,
              animation: { type: 'pulse', attribute: 'opacity',
                from: coilOpacity * 0.7, to: coilOpacity * 0.3, duration: 1.8, easing: 'ease-in-out' } } },
          { type: 'line', x1: THROAT_L - 10, y1: CY + throatInner, x2: THROAT_L + 10, y2: CY + throatInner,
            style: { stroke: '#38bdf8', strokeWidth: 0.8, fill: 'none', opacity: coilOpacity * 0.7,
              animation: { type: 'pulse', attribute: 'opacity',
                from: coilOpacity * 0.7, to: coilOpacity * 0.3, duration: 1.8, easing: 'ease-in-out' } } },
          // Upper/lower rail connecting coils
          { type: 'path',
            d: COIL_XS.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x},${CY - coilHalfH(x) - 4}`).join(' '),
            style: { stroke: '#38bdf8', strokeWidth: 0.6, fill: 'none', opacity: coilOpacity * 0.5,
              animation: { type: 'flowDash', dasharray: '3 4', duration: 1.8, direction: 'forward' } } },
          { type: 'path',
            d: COIL_XS.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x},${CY + coilHalfH(x) + 4}`).join(' '),
            style: { stroke: '#38bdf8', strokeWidth: 0.6, fill: 'none', opacity: coilOpacity * 0.5,
              animation: { type: 'flowDash', dasharray: '3 4', duration: 1.8, direction: 'forward' } } },
        ],
        annotations: [
          { type: 'callout',
            from: { x: COIL_XS[3], y: CY - coilHalfH(COIL_XS[3]) },
            to: { x: COIL_XS[3] - 30, y: CY - coilHalfH(COIL_XS[3]) - 40 },
            label: 'CONFINEMENT COILS',
            sublabel: `RATIO: ${nozzleRatio.toFixed(2)}`,
            color: '#38bdf8' },
        ],
      },

      // === PLASMA ===
      {
        id: 'plasma', label: 'PLASMA', color: '#60b0ff', defaultOn: true,
        shapes: [
          ...plasmaShapes,
          ...exhaustShapes,
        ],
      },

      // === FUEL FEED ===
      {
        id: 'fuel-feed', label: 'FUEL FEED', color: '#f97316', defaultOn: true,
        shapes: [
          // Feed line from right into top injector
          { type: 'path', d: `M 680,${CY - 30} L ${CHAMBER_R + 19},${CY - 30}`,
            style: { stroke: '#f97316', strokeWidth: 1.5, fill: 'none', opacity: fuelOpacity,
              animation: fuelDuration > 0
                ? { type: 'flowDash', dasharray: '8 4', duration: fuelDuration, direction: 'reverse' }
                : undefined } },
          // Glow
          { type: 'path', d: `M 680,${CY - 30} L ${CHAMBER_R + 19},${CY - 30}`,
            style: { stroke: '#f97316', strokeWidth: 4, fill: 'none', opacity: fuelOpacity * 0.2,
              effect: { type: 'glow', blur: 3 } } },
          // Feed line into center injector (plasma feed)
          { type: 'path', d: `M 680,${CY} L ${CHAMBER_R + 20},${CY}`,
            style: { stroke: '#f97316', strokeWidth: 1.8, fill: 'none', opacity: fuelOpacity,
              animation: fuelDuration > 0
                ? { type: 'flowDash', dasharray: '8 4', duration: fuelDuration * 0.8, direction: 'reverse' }
                : undefined } },
          { type: 'path', d: `M 680,${CY} L ${CHAMBER_R + 20},${CY}`,
            style: { stroke: '#f97316', strokeWidth: 5, fill: 'none', opacity: fuelOpacity * 0.2,
              effect: { type: 'glow', blur: 4 } } },
        ],
        annotations: [
          { type: 'text', x: 685, y: CY - 34, content: 'FUEL', anchor: 'start', size: 6, color: '#f97316' },
          { type: 'text', x: 685, y: CY - 4, content: 'PLASMA', anchor: 'start', size: 6, color: '#f97316' },
          { type: 'text', x: 685, y: CY - 22, content: `MIX: ${(reactionMassRatio * 100).toFixed(0)}%`, anchor: 'start', size: 5, color: '#b45a10' },
        ],
      },

      // === COOLANT ===
      {
        id: 'coolant', label: 'COOLANT', color: '#4ade80', defaultOn: true,
        shapes: [
          // Coolant feed into bottom port
          { type: 'path', d: `M 680,${CY + 30} L ${CHAMBER_R + 19},${CY + 30}`,
            style: { stroke: '#4ade80', strokeWidth: 1.2, fill: 'none', opacity: coolantOpacity,
              animation: coolantDuration > 0
                ? { type: 'flowDash', dasharray: '6 4', duration: coolantDuration, direction: 'reverse' }
                : undefined } },
          // Coolant jacket along chamber top
          { type: 'path',
            d: `M ${CHAMBER_R + 10},${CY - CHAMBER_HALF_H - 6} L ${CHAMBER_L - 5},${CY - CHAMBER_HALF_H - 6} L ${THROAT_L - 3},${CY - 34}`,
            style: { stroke: '#22d3ee', strokeWidth: 0.8, fill: 'none', opacity: coolantOpacity * 0.6,
              animation: coolantDuration > 0
                ? { type: 'flowDash', dasharray: '4 4', duration: coolantDuration * 1.2, direction: 'forward' }
                : undefined } },
          // Coolant jacket along chamber bottom
          { type: 'path',
            d: `M ${CHAMBER_R + 10},${CY + CHAMBER_HALF_H + 6} L ${CHAMBER_L - 5},${CY + CHAMBER_HALF_H + 6} L ${THROAT_L - 3},${CY + 34}`,
            style: { stroke: '#22d3ee', strokeWidth: 0.8, fill: 'none', opacity: coolantOpacity * 0.6,
              animation: coolantDuration > 0
                ? { type: 'flowDash', dasharray: '4 4', duration: coolantDuration * 1.2, direction: 'forward' }
                : undefined } },
        ],
        annotations: [
          { type: 'text', x: 685, y: CY + 27, content: 'COOLANT', anchor: 'start', size: 6, color: '#4ade80' },
        ],
      },
    ],
  };
}
