// DEPRECATED: Canonical version now lives in starry-eyes-client/src/client/hud/schematics/.
// This standalone viewer is kept for reference only — do not update these files.

import type { SchematicDocument } from './schematic-schema.ts';

// Compact Tokamak Mk-IV — Fusion Reactor Section A

export interface ReactorParams {
  powerLevel: number;      // 0–1: overall reactor power output
  coilCurrent: number;     // 0–1: magnetic coil field strength
  plasmaTemp: number;      // 0–1: plasma temperature (0 = cold/shutdown, 1 = full burn)
  coolantFlow: number;     // 0–1: coolant circulation rate
}

export const defaultReactorParams: ReactorParams = {
  powerLevel: 1,
  coilCurrent: 1,
  plasmaTemp: 1,
  coolantFlow: 1,
};

const CX = 390;
const CY = 230;
const VRX = 130;
const VRY = 92;

function coilRy(dx: number): number {
  return 84 * Math.sqrt(1 - (Math.abs(dx) / VRX) ** 2 * 0.7);
}

const coilOffsets = [-100, -70, -40, 0, 40, 70, 100];

// Lerp helper
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function reactorSchematic(params: ReactorParams = defaultReactorParams): SchematicDocument {
  const { powerLevel, coilCurrent, plasmaTemp, coolantFlow } = params;

  // Derived values
  const coilOpacity = lerp(0.1, 0.7, coilCurrent);
  const coilPulseFrom = lerp(0.05, 0.4, coilCurrent);
  const coilPulseTo = lerp(0.1, 0.85, coilCurrent);
  const coilGlow = lerp(0.5, 2.5, coilCurrent);

  const plasmaRx = lerp(30, 96, plasmaTemp);
  const plasmaRy = lerp(20, 68, plasmaTemp);
  const plasmaRotSpeed = lerp(3, 22, plasmaTemp);
  const plasmaParticles = plasmaTemp > 0.1 ? Math.max(2, Math.round(6 * plasmaTemp)) : 0;

  const coolantDuration = coolantFlow > 0.05 ? lerp(8, 2.5, coolantFlow) : 0;
  const coolantOpacity = lerp(0.15, 0.7, coolantFlow);

  const powerFlowDuration = powerLevel > 0.05 ? lerp(3, 0.8, powerLevel) : 0;
  const powerOpacity = lerp(0.2, 0.9, powerLevel);
  const powerGlow = lerp(0.5, 3, powerLevel);

  const statusLabel = plasmaTemp < 0.05 ? 'SHUTDOWN'
    : plasmaTemp < 0.3 ? 'IGNITION SEQ'
    : plasmaTemp < 0.7 ? 'PARTIAL BURN'
    : 'NOMINAL';

  const tempStr = `~${(plasmaTemp * 1.8).toFixed(1)}\u00d710\u2078 K`;
  const currentStr = `${(coilCurrent * 14.3).toFixed(1)} MA \u00b7 ${(coilCurrent * 5.3).toFixed(1)} T`;

  return {
    meta: {
      vessel: 'DSV NEMESIS-7',
      system: `FUSION REACTOR \u2014 ${statusLabel}`,
      subsystem: 'COMPACT TOKAMAK MK-IV',
      revision: '7.3.1',
      classification: 'RESTRICTED \u2014 GRIMFOX NAVAL SYSTEMS',
    },
    viewBox: { width: 780, height: 460 },
    gradients: [
      {
        type: 'radial', id: 'vesselFill',
        cx: 0.5, cy: 0.5, r: 0.5,
        stops: [
          { offset: 0, color: '#0a1929', opacity: 1 },
          { offset: 0.7, color: '#06101c', opacity: 1 },
          { offset: 1, color: '#040c14', opacity: 1 },
        ],
      },
      {
        type: 'radial', id: 'plasmaCore',
        cx: 0.5, cy: 0.5, r: 0.5,
        stops: [
          { offset: 0, color: '#ffffff', opacity: lerp(0.1, 0.9, plasmaTemp) },
          { offset: 0.25, color: '#fbbf24', opacity: lerp(0.1, 0.7, plasmaTemp) },
          { offset: 0.6, color: '#f97316', opacity: lerp(0.05, 0.3, plasmaTemp) },
          { offset: 1, color: '#f97316', opacity: 0 },
        ],
      },
    ],
    layers: [
      // --- STRUCTURE (not toggleable) ---
      {
        id: 'structure', label: 'STRUCTURE', defaultOn: true, toggleable: false,
        shapes: [
          { type: 'ellipse', cx: CX, cy: CY, rx: VRX, ry: VRY,
            style: { stroke: '#1e3a5f', strokeWidth: 2, fill: 'url(#vesselFill)' } },
          { type: 'ellipse', cx: CX, cy: CY, rx: VRX - 12, ry: VRY - 10,
            style: { stroke: '#0e2535', strokeWidth: 1, fill: 'none' } },
          { type: 'line', x1: CX - VRX - 30, y1: CY, x2: CX + VRX + 30, y2: CY,
            style: { stroke: '#0e2535', strokeWidth: 0.5, animation: { type: 'flowDash', dasharray: '4 6', duration: 0, direction: 'forward' } } },
          { type: 'line', x1: CX, y1: CY - VRY - 20, x2: CX, y2: CY + VRY + 20,
            style: { stroke: '#0e2535', strokeWidth: 0.5, animation: { type: 'flowDash', dasharray: '4 6', duration: 0, direction: 'forward' } } },
        ],
        annotations: [
          { type: 'callout', from: { x: CX + VRX, y: CY - 20 }, to: { x: CX + VRX + 60, y: CY - 50 },
            label: 'VACUUM VESSEL', sublabel: 'W-ALLOY SHELL', color: '#4a8a9e' },
          { type: 'dimension', from: { x: CX - VRX, y: CY + VRY + 35 }, to: { x: CX + VRX, y: CY + VRY + 35 },
            label: '6.2m MAJOR DIAMETER', color: '#4a8a9e' },
        ],
      },

      // --- FIELD COILS ---
      {
        id: 'coils', label: 'FIELD COILS', color: '#38bdf8', defaultOn: true,
        shapes: [
          ...coilOffsets.map(dx => ({
            type: 'ellipse' as const,
            cx: CX + dx, cy: CY,
            rx: 6, ry: coilRy(dx),
            style: {
              stroke: '#38bdf8', strokeWidth: 1.5, fill: 'none', opacity: coilOpacity,
              effect: { type: 'glow' as const, blur: coilGlow, intensity: 1 },
              animation: { type: 'pulse' as const, attribute: 'opacity', from: coilPulseFrom, to: coilPulseTo, duration: 2.1 },
            },
          })),
          { type: 'line' as const, x1: CX - 100, y1: CY - coilRy(-100) - 5, x2: CX + 100, y2: CY - coilRy(100) - 5,
            style: { stroke: '#38bdf8', strokeWidth: 0.7, opacity: coilOpacity * 0.6,
              animation: { type: 'flowDash' as const, dasharray: '3 5', duration: 1.5 } } },
          { type: 'line' as const, x1: CX - 100, y1: CY + coilRy(-100) + 5, x2: CX + 100, y2: CY + coilRy(100) + 5,
            style: { stroke: '#38bdf8', strokeWidth: 0.7, opacity: coilOpacity * 0.6,
              animation: { type: 'flowDash' as const, dasharray: '3 5', duration: 1.5 } } },
        ],
        annotations: [
          { type: 'callout', from: { x: CX, y: CY - coilRy(0) }, to: { x: CX - 80, y: CY - VRY - 40 },
            label: 'TOROIDAL FIELD COILS', sublabel: currentStr, color: '#38bdf8' },
        ],
      },

      // --- PLASMA ---
      {
        id: 'plasma', label: 'PLASMA', color: '#f97316', defaultOn: true,
        shapes: plasmaTemp > 0.05 ? [
          { type: 'ellipse', cx: CX, cy: CY, rx: plasmaRx, ry: plasmaRy,
            style: {
              fill: 'none', stroke: 'none',
              animation: { type: 'plasmaField', particleCount: plasmaParticles, rotationSpeed: plasmaRotSpeed,
                coreColor: '#fbbf24', outerColor: '#f97316' },
            },
          },
        ] : [],
        annotations: [
          { type: 'callout', from: { x: CX + 50, y: CY + 30 }, to: { x: CX + VRX + 60, y: CY + 60 },
            label: 'PLASMA TORUS', sublabel: plasmaTemp > 0.05 ? tempStr : 'OFFLINE', color: plasmaTemp > 0.05 ? '#f97316' : '#4a3020' },
        ],
      },

      // --- COOLANT ---
      {
        id: 'coolant', label: 'COOLANT', color: '#4ade80', defaultOn: false,
        shapes: [
          { type: 'path',
            d: `M 200,${CY - 40} L 240,${CY - 40} Q 260,${CY - 40} 260,${CY - 60} L 260,${CY - VRY - 15} Q 260,${CY - VRY - 25} 280,${CY - VRY - 25} L ${CX + VRX + 20},${CY - VRY - 25}`,
            style: { stroke: '#4ade80', strokeWidth: 1.2, fill: 'none', opacity: coolantOpacity,
              animation: { type: 'flowDash', dasharray: '8 4', duration: coolantDuration, direction: 'forward' } } },
          { type: 'path',
            d: `M 200,${CY + 40} L 240,${CY + 40} Q 260,${CY + 40} 260,${CY + 60} L 260,${CY + VRY + 15} Q 260,${CY + VRY + 25} 280,${CY + VRY + 25} L ${CX + VRX + 20},${CY + VRY + 25}`,
            style: { stroke: '#22d3ee', strokeWidth: 1.2, fill: 'none', opacity: coolantOpacity,
              animation: { type: 'flowDash', dasharray: '8 4', duration: coolantDuration, direction: 'reverse' } } },
        ],
        annotations: [
          { type: 'text', x: 195, y: CY - 44, content: 'FEED', anchor: 'end', size: 6, color: '#4ade80' },
          { type: 'text', x: 195, y: CY + 37, content: 'RETURN', anchor: 'end', size: 6, color: '#22d3ee' },
        ],
      },

      // --- POWER GRID ---
      {
        id: 'power', label: 'POWER GRID', color: '#f59e0b', defaultOn: true,
        shapes: [
          { type: 'path',
            d: `M 200,${CY - 15} L ${CX - VRX - 10},${CY - 15}`,
            style: { stroke: '#f59e0b', strokeWidth: 1.5, fill: 'none', opacity: powerOpacity,
              animation: { type: 'flowDash', dasharray: '6 3', duration: powerFlowDuration, direction: 'forward' } } },
          { type: 'path',
            d: `M 200,${CY + 15} L ${CX - VRX - 10},${CY + 15}`,
            style: { stroke: '#f59e0b', strokeWidth: 1.5, fill: 'none', opacity: powerOpacity,
              animation: { type: 'flowDash', dasharray: '6 3', duration: powerFlowDuration, direction: 'forward' } } },
          { type: 'path',
            d: `M ${CX + VRX + 10},${CY} L 580,${CY}`,
            style: { stroke: '#f59e0b', strokeWidth: 2, fill: 'none', opacity: powerOpacity,
              effect: { type: 'glow', blur: powerGlow, intensity: 1 },
              animation: { type: 'flowDash', dasharray: '10 4', duration: powerFlowDuration, direction: 'forward' } } },
        ],
      },

      // --- DATA BUS ---
      {
        id: 'data', label: 'DATA BUS', color: '#c084fc', defaultOn: false,
        shapes: [
          { type: 'path',
            d: `M 580,${CY - 30} L ${CX + VRX + 15},${CY - 30}`,
            style: { stroke: '#c084fc', strokeWidth: 0.8, fill: 'none', opacity: 0.6,
              animation: { type: 'flowDash', dasharray: '3 3', duration: 0.6, direction: 'reverse' } } },
          { type: 'path',
            d: `M 580,${CY + 30} L ${CX + VRX + 15},${CY + 30}`,
            style: { stroke: '#c084fc', strokeWidth: 0.8, fill: 'none', opacity: 0.6,
              animation: { type: 'flowDash', dasharray: '3 3', duration: 0.6, direction: 'reverse' } } },
        ],
      },
    ],
  };
}
