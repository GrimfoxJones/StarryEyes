// DEPRECATED: Canonical version now lives in starry-eyes-client/src/client/hud/schematics/.
// This standalone viewer is kept for reference only — do not update these files.

import type { SchematicDocument, Shape } from './schematic-schema.ts';

// Light Freighter — Top-Down Overview
// Layout (left=stern → right=bow):
//   DRIVE | REACTOR | --spine+fuel tanks-- | COMMS/LIFESUP | CREW | BRIDGE | CARGO | DOCK
//   Radiators: selectable fins above/below reactor
//   Sensors: small pod hanging off bottom of hull near bow

function brackets(x: number, y: number, w: number, h: number): Shape[] {
  const t = 7;
  const col = '#1e3a5f';
  return [
    { type: 'path', d: `M ${x},${y + t} L ${x},${y} L ${x + t},${y}`, style: { stroke: col, strokeWidth: 0.7, fill: 'none' } },
    { type: 'path', d: `M ${x + w - t},${y} L ${x + w},${y} L ${x + w},${y + t}`, style: { stroke: col, strokeWidth: 0.7, fill: 'none' } },
    { type: 'path', d: `M ${x},${y + h - t} L ${x},${y + h} L ${x + t},${y + h}`, style: { stroke: col, strokeWidth: 0.7, fill: 'none' } },
    { type: 'path', d: `M ${x + w - t},${y + h} L ${x + w},${y + h} L ${x + w},${y + h - t}`, style: { stroke: col, strokeWidth: 0.7, fill: 'none' } },
  ];
}

export interface Compartment {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
  overlayLayer?: string;
  group?: string;
}

export const compartments: Compartment[] = [
  { id: 'drive',    label: 'DRIVE',     sub: 'MAIN THRUSTER', x: 87,  y: 172, w: 73,  h: 106 },
  { id: 'reactor',  label: 'REACTOR',   sub: 'CORE',          x: 165, y: 172, w: 125, h: 106, overlayLayer: 'power' },
  { id: 'rad-upper', label: 'RADIATOR', sub: 'UPPER',         x: 165, y: 112, w: 110, h: 58, overlayLayer: 'coolant', group: 'thermal' },
  { id: 'rad-lower', label: 'RADIATOR', sub: 'LOWER',         x: 165, y: 280, w: 110, h: 58, overlayLayer: 'coolant', group: 'thermal' },
  { id: 'comms',    label: 'COMMS',     sub: '',              x: 422, y: 182, w: 95,  h: 38, overlayLayer: 'data' },
  { id: 'lifesup',  label: 'LIFE SUPP', sub: 'ATMO',          x: 422, y: 225, w: 95,  h: 42, overlayLayer: 'life' },
  { id: 'crew',     label: 'CREW',      sub: 'BERTHING',      x: 522, y: 182, w: 108, h: 85 },
  { id: 'bridge',   label: 'BRIDGE',    sub: '',              x: 635, y: 182, w: 80,  h: 85, overlayLayer: 'data' },
  { id: 'cargo',    label: 'CARGO',     sub: 'HOLD',          x: 720, y: 182, w: 78,  h: 85 },
  { id: 'sensors',  label: 'SENSORS',   sub: '',              x: 755, y: 274, w: 42,  h: 24, overlayLayer: 'data' },
  { id: 'fuel-upper', label: 'FUEL', sub: 'UPPER',          x: 310, y: 148, w: 100, h: 47, rx: 16, group: 'fuel' },
  { id: 'fuel-lower', label: 'FUEL', sub: 'LOWER',          x: 310, y: 255, w: 100, h: 47, rx: 16, group: 'fuel' },
];

export interface ShipOverviewParams {
  shipName: string;
}

const bulkheads = [
  { x: 162, top: 170, bot: 280 },
  { x: 295, top: 170, bot: 280 },
  { x: 420, top: 180, bot: 270 },
  { x: 520, top: 180, bot: 270 },
  { x: 633, top: 180, bot: 270 },
  { x: 718, top: 180, bot: 270 },
];

const topFinYs = [125, 137, 149, 161];
const botFinYs = [290, 302, 314, 326];

// Compartments that get drawn as rects in the structure layer
// (radiators and sensor pod are drawn as separate dedicated shapes)
const structCompartments = compartments.filter(
  c => !c.id.startsWith('rad-') && c.id !== 'sensors',
);

export function shipSchematic(params: ShipOverviewParams): SchematicDocument {
  return {
    meta: {
      vessel: params.shipName,
      system: 'SHIP OVERVIEW \u2014 TOP-DOWN',
      class: 'LIGHT FREIGHTER',
      revision: '3.2.0',
      classification: 'RESTRICTED \u2014 GRIMFOX NAVAL SYSTEMS',
    },
    viewBox: { width: 900, height: 450 },
    layers: [
      // ========== STRUCTURE ==========
      {
        id: 'structure', label: 'STRUCTURE', defaultOn: true, toggleable: false,
        shapes: [
          // --- Hull silhouette (flat bow, engine bell at stern) ---
          { type: 'path',
            d: [
              'M 800,180',              // bow face top-right
              'L 420,180',              // crew section top
              'L 420,200 L 295,200',    // step down into spine top
              'L 295,170',              // step up to reactor block top
              'L 85,170',               // reactor top → stern
              'L 58,155',               // engine bell flare top
              'L 42,190 L 38,225',      // engine nozzle left (top half)
              'L 42,260 L 58,295',      // engine nozzle left (bottom half)
              'L 85,280',               // engine bell → stern bottom
              'L 295,280',              // reactor block bottom
              'L 295,250 L 420,250',    // spine bottom
              'L 420,270',              // step up to crew section bottom
              'L 800,270',              // crew section bottom → flat bow face
              'Z',                      // close
            ].join(' '),
            style: { stroke: '#1e3a5f', strokeWidth: 1.5, fill: '#060e18' },
          },

          // --- Docking collar (double lines at bow face) ---
          { type: 'line', x1: 800, y1: 205, x2: 820, y2: 205,
            style: { stroke: '#1e3a5f', strokeWidth: 1.2, fill: 'none' } },
          { type: 'line', x1: 800, y1: 245, x2: 820, y2: 245,
            style: { stroke: '#1e3a5f', strokeWidth: 1.2, fill: 'none' } },
          { type: 'line', x1: 820, y1: 205, x2: 820, y2: 245,
            style: { stroke: '#1e3a5f', strokeWidth: 1.2, fill: 'none' } },
          // Inner collar lines
          { type: 'line', x1: 800, y1: 212, x2: 816, y2: 212,
            style: { stroke: '#0e2535', strokeWidth: 0.7, fill: 'none' } },
          { type: 'line', x1: 800, y1: 238, x2: 816, y2: 238,
            style: { stroke: '#0e2535', strokeWidth: 0.7, fill: 'none' } },

          // --- Sensor pod (small box below hull, near bow) ---
          { type: 'rect', x: 755, y: 274, width: 42, height: 24, rx: 2,
            style: { stroke: '#1e3a5f', strokeWidth: 1, fill: '#060e18' } },
          // Struts connecting pod to hull
          { type: 'line', x1: 765, y1: 270, x2: 765, y2: 274,
            style: { stroke: '#1e3a5f', strokeWidth: 0.8, fill: 'none' } },
          { type: 'line', x1: 787, y1: 270, x2: 787, y2: 274,
            style: { stroke: '#1e3a5f', strokeWidth: 0.8, fill: 'none' } },

          // --- Engine nozzle ring ---
          { type: 'ellipse', cx: 40, cy: 225, rx: 3, ry: 28,
            style: { stroke: '#1e3a5f', strokeWidth: 1, fill: 'none' } },
          // Engine inner cone lines
          { type: 'line', x1: 43, y1: 197, x2: 85, y2: 185,
            style: { stroke: '#0e2535', strokeWidth: 0.5, fill: 'none' } },
          { type: 'line', x1: 43, y1: 253, x2: 85, y2: 265,
            style: { stroke: '#0e2535', strokeWidth: 0.5, fill: 'none' } },

          // --- Radiator panels (top & bottom) ---
          { type: 'rect', x: 165, y: 112, width: 110, height: 58,
            style: { stroke: '#1e3a5f', strokeWidth: 1, fill: '#060e18' } },
          { type: 'rect', x: 165, y: 280, width: 110, height: 58,
            style: { stroke: '#1e3a5f', strokeWidth: 1, fill: '#060e18' } },
          ...topFinYs.map(y => ({
            type: 'line' as const, x1: 168, y1: y, x2: 272, y2: y,
            style: { stroke: '#0e2535', strokeWidth: 0.5, fill: 'none' },
          })),
          ...botFinYs.map(y => ({
            type: 'line' as const, x1: 168, y1: y, x2: 272, y2: y,
            style: { stroke: '#0e2535', strokeWidth: 0.5, fill: 'none' },
          })),

          // --- Fuel tanks (capsule-shaped, on either side of spine) ---
          { type: 'rect', x: 310, y: 148, width: 100, height: 47, rx: 16,
            style: { stroke: '#1e3a5f', strokeWidth: 1, fill: '#0a1420' } },
          { type: 'rect', x: 310, y: 255, width: 100, height: 47, rx: 16,
            style: { stroke: '#1e3a5f', strokeWidth: 1, fill: '#0a1420' } },
          // Tank centerlines
          { type: 'line', x1: 325, y1: 171, x2: 395, y2: 171,
            style: { stroke: '#0e2535', strokeWidth: 0.4, fill: 'none' } },
          { type: 'line', x1: 325, y1: 279, x2: 395, y2: 279,
            style: { stroke: '#0e2535', strokeWidth: 0.4, fill: 'none' } },
          // Tank struts
          { type: 'line', x1: 330, y1: 195, x2: 320, y2: 200,
            style: { stroke: '#1e3a5f', strokeWidth: 0.7, fill: 'none' } },
          { type: 'line', x1: 390, y1: 195, x2: 400, y2: 200,
            style: { stroke: '#1e3a5f', strokeWidth: 0.7, fill: 'none' } },
          { type: 'line', x1: 330, y1: 255, x2: 320, y2: 250,
            style: { stroke: '#1e3a5f', strokeWidth: 0.7, fill: 'none' } },
          { type: 'line', x1: 390, y1: 255, x2: 400, y2: 250,
            style: { stroke: '#1e3a5f', strokeWidth: 0.7, fill: 'none' } },

          // --- Spine structural outline ---
          { type: 'line', x1: 295, y1: 208, x2: 420, y2: 200,
            style: { stroke: '#0e2535', strokeWidth: 0.5, fill: 'none' } },
          { type: 'line', x1: 295, y1: 250, x2: 420, y2: 250,
            style: { stroke: '#0e2535', strokeWidth: 0.5, fill: 'none' } },

          // --- Compartment rects (outer, excludes radiators and sensor pod) ---
          ...structCompartments.map(c => ({
            type: 'rect' as const,
            x: c.x, y: c.y, width: c.w, height: c.h,
            style: { stroke: '#0e2535', strokeWidth: 0.8, fill: 'none' },
          })),
          // Compartment rects (inner, 4px inset)
          ...structCompartments.filter(c => c.w > 30 && c.h > 20).map(c => ({
            type: 'rect' as const,
            x: c.x + 4, y: c.y + 4, width: c.w - 8, height: c.h - 8,
            style: { stroke: '#0a1a2a', strokeWidth: 0.5, fill: 'none' },
          })),
          // Corner brackets
          ...structCompartments.flatMap(c => brackets(c.x, c.y, c.w, c.h)),

          // --- Bulkhead lines ---
          ...bulkheads.map(b => ({
            type: 'line' as const,
            x1: b.x, y1: b.top, x2: b.x, y2: b.bot,
            style: { stroke: '#0e2535', strokeWidth: 0.8,
              animation: { type: 'flowDash' as const, dasharray: '4 4', duration: 0 } },
          })),

          // --- Centerline (dashed, full length) ---
          { type: 'line', x1: 38, y1: 225, x2: 820, y2: 225,
            style: { stroke: '#0e2535', strokeWidth: 0.4,
              animation: { type: 'flowDash', dasharray: '6 8', duration: 0 } } },
        ],
        annotations: [
          // Compartment labels — tall compartments get label + sublabel
          ...compartments.filter(c => c.h >= 50 && !c.id.startsWith('rad-')).map(c => ({
            type: 'text' as const,
            x: c.x + c.w / 2, y: c.y + c.h / 2 + (c.sub ? -2 : 3),
            content: c.label, anchor: 'middle' as const, size: 7, color: '#2a5a7a',
          })),
          ...compartments.filter(c => c.sub && c.h >= 50 && !c.id.startsWith('rad-')).map(c => ({
            type: 'text' as const,
            x: c.x + c.w / 2, y: c.y + c.h / 2 + 8,
            content: c.sub, anchor: 'middle' as const, size: 5, color: '#1a4050',
          })),
          // Short compartments (comms, life supp) — single centered label
          ...compartments.filter(c => c.h >= 30 && c.h < 50).map(c => ({
            type: 'text' as const,
            x: c.x + c.w / 2, y: c.y + c.h / 2 + 3,
            content: c.label + (c.sub ? ` \u2014 ${c.sub}` : ''), anchor: 'middle' as const, size: 5, color: '#2a5a7a',
          })),
          // Tiny compartments (sensors pod) — small centered label
          ...compartments.filter(c => c.h < 30).map(c => ({
            type: 'text' as const,
            x: c.x + c.w / 2, y: c.y + c.h / 2 + 3,
            content: c.label, anchor: 'middle' as const, size: 5, color: '#2a5a7a',
          })),

          // Radiator labels
          { type: 'text', x: 220, y: 108, content: 'RADIATOR', anchor: 'middle', size: 5, color: '#1a4050' },
          { type: 'text', x: 220, y: 345, content: 'RADIATOR', anchor: 'middle', size: 5, color: '#1a4050' },

          // Fuel tank labels
          { type: 'text', x: 360, y: 175, content: 'H\u2082 FUEL', anchor: 'middle', size: 5, color: '#1a4050' },
          { type: 'text', x: 360, y: 275, content: 'H\u2082 FUEL', anchor: 'middle', size: 5, color: '#1a4050' },

          // Docking collar label
          { type: 'text', x: 820, y: 200, content: 'DOCK', anchor: 'middle', size: 5, color: '#1a4050' },

          // Overall length dimension
          { type: 'dimension', from: { x: 38, y: 380 }, to: { x: 820, y: 380 },
            label: '87.4m \u2014 OVERALL LENGTH', color: '#4a8a9e' },

          // Direction labels
          { type: 'text', x: 845, y: 405, content: 'FWD \u2192', anchor: 'end', size: 6, color: '#1a4557' },
          { type: 'text', x: 35, y: 405, content: '\u2190 AFT', anchor: 'start', size: 6, color: '#1a4557' },
        ],
      },

      // ========== POWER GRID ==========
      {
        id: 'power', label: 'POWER GRID', color: '#f59e0b', defaultOn: false,
        shapes: [
          // Power line 1 — reactor to comms (glow underlay + sharp overlay)
          { type: 'path', d: 'M 259,217 L 422,217 L 446,201',
            style: { stroke: '#f59e0b', strokeWidth: 4, fill: 'none', opacity: 0.15,
              effect: { type: 'glow', blur: 3 } } },
          { type: 'path', d: 'M 259,217 L 422,217 L 446,201',
            style: { stroke: '#f59e0b', strokeWidth: 1.2, fill: 'none', opacity: 0.9,
              animation: { type: 'flowDash', dasharray: '8 4', duration: 1.5, direction: 'forward' } } },
          // Power line 2 — reactor along spine to cargo (glow underlay + sharp overlay)
          { type: 'path', d: 'M 259,225 L 735,225',
            style: { stroke: '#f59e0b', strokeWidth: 5, fill: 'none', opacity: 0.15,
              effect: { type: 'glow', blur: 4 } } },
          { type: 'path', d: 'M 259,225 L 735,225',
            style: { stroke: '#f59e0b', strokeWidth: 1.5, fill: 'none', opacity: 0.9,
              animation: { type: 'flowDash', dasharray: '8 4', duration: 1.5, direction: 'forward' } } },
          // Power line 3 — reactor to life support (glow underlay + sharp overlay)
          { type: 'path', d: 'M 259,233 L 422,233 L 446,246',
            style: { stroke: '#f59e0b', strokeWidth: 4, fill: 'none', opacity: 0.15,
              effect: { type: 'glow', blur: 3 } } },
          { type: 'path', d: 'M 259,233 L 422,233 L 446,246',
            style: { stroke: '#f59e0b', strokeWidth: 1.2, fill: 'none', opacity: 0.9,
              animation: { type: 'flowDash', dasharray: '8 4', duration: 1.5, direction: 'forward' } } },
        ],
      },

      // ========== LIFE SUPPORT ==========
      {
        id: 'life', label: 'LIFE SUPPORT', color: '#4ade80', defaultOn: false,
        shapes: [
          { type: 'path', d: 'M 422,258 L 798,258',
            style: { stroke: '#4ade80', strokeWidth: 1.2, fill: 'none', opacity: 0.6,
              animation: { type: 'flowDash', dasharray: '6 4', duration: 2, direction: 'forward' } } },
          { type: 'line', x1: 576, y1: 258, x2: 576, y2: 240,
            style: { stroke: '#4ade80', strokeWidth: 0.7, fill: 'none', opacity: 0.4,
              animation: { type: 'flowDash', dasharray: '3 3', duration: 1.5, direction: 'forward' } } },
          { type: 'line', x1: 675, y1: 258, x2: 675, y2: 240,
            style: { stroke: '#4ade80', strokeWidth: 0.7, fill: 'none', opacity: 0.4,
              animation: { type: 'flowDash', dasharray: '3 3', duration: 1.5, direction: 'forward' } } },
          { type: 'line', x1: 759, y1: 258, x2: 759, y2: 240,
            style: { stroke: '#4ade80', strokeWidth: 0.7, fill: 'none', opacity: 0.4,
              animation: { type: 'flowDash', dasharray: '3 3', duration: 1.5, direction: 'forward' } } },
        ],
      },

      // ========== COOLANT ==========
      {
        id: 'coolant', label: 'COOLANT', color: '#38bdf8', defaultOn: false,
        shapes: [
          { type: 'path', d: 'M 200,210 L 715,210',
            style: { stroke: '#38bdf8', strokeWidth: 1, fill: 'none', opacity: 0.6,
              animation: { type: 'flowDash', dasharray: '8 3', duration: 2, direction: 'forward' } } },
          { type: 'path', d: 'M 715,240 L 200,240',
            style: { stroke: '#22d3ee', strokeWidth: 1, fill: 'none', opacity: 0.5,
              animation: { type: 'flowDash', dasharray: '8 3', duration: 2, direction: 'reverse' } } },
          { type: 'line', x1: 220, y1: 210, x2: 220, y2: 112,
            style: { stroke: '#38bdf8', strokeWidth: 0.8, fill: 'none', opacity: 0.5,
              animation: { type: 'flowDash', dasharray: '4 3', duration: 1.5, direction: 'forward' } } },
          { type: 'line', x1: 220, y1: 240, x2: 220, y2: 338,
            style: { stroke: '#22d3ee', strokeWidth: 0.8, fill: 'none', opacity: 0.5,
              animation: { type: 'flowDash', dasharray: '4 3', duration: 1.5, direction: 'forward' } } },
        ],
      },

      // ========== DATA BUS ==========
      {
        id: 'data', label: 'DATA BUS', color: '#c084fc', defaultOn: false,
        shapes: [
          // Glow underlay
          { type: 'path', d: 'M 167,208 L 798,208',
            style: { stroke: '#d8b4fe', strokeWidth: 3, fill: 'none', opacity: 0.12,
              effect: { type: 'glow', blur: 3 } } },
          { type: 'path', d: 'M 167,208 L 798,208',
            style: { stroke: '#d8b4fe', strokeWidth: 0.8, fill: 'none', opacity: 0.7,
              animation: { type: 'flowDash', dasharray: '3 3', duration: 0.8, direction: 'forward' } } },
          ...structCompartments.filter(c => c.id !== 'drive').map(c => ({
            type: 'line' as const,
            x1: c.x + c.w / 2, y1: 208,
            x2: c.x + c.w / 2, y2: c.y + 6,
            style: { stroke: '#d8b4fe', strokeWidth: 0.5, fill: 'none', opacity: 0.5,
              animation: { type: 'flowDash' as const, dasharray: '2 3', duration: 0.6, direction: 'forward' as const } },
          })),
          // Spur down to sensor pod
          { type: 'path', d: 'M 776,270 L 776,274',
            style: { stroke: '#d8b4fe', strokeWidth: 0.5, fill: 'none', opacity: 0.5,
              animation: { type: 'flowDash', dasharray: '2 3', duration: 0.6, direction: 'forward' } } },
        ],
      },
    ],
  };
}
