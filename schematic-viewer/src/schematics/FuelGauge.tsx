// DEPRECATED: Canonical version now lives in starry-eyes-client/src/client/hud/schematics/.
// This standalone viewer is kept for reference only — do not update these files.

import { memo } from 'react';
import type { Compartment } from './ship-overview.schematic.ts';

// Renders a horizontal fill-level indicator clipped to the fuel tank's capsule shape.

export const FuelGauge = memo(function FuelGauge({
  tank,
  level,
  color = '#38bdf8',
}: {
  tank: Compartment;
  level: number;
  color?: string;
}) {
  const { x, y, w, h, rx = 0, id } = tank;
  const fill = Math.max(0, Math.min(1, level));
  const clipId = `fuel-clip-${id}`;
  const pct = Math.round(fill * 100);

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} rx={rx} />
        </clipPath>
      </defs>

      {/* Fill bar */}
      <rect
        x={x} y={y} width={w * fill} height={h}
        fill={color} opacity={0.2}
        clipPath={`url(#${clipId})`}
      />

      {/* Fill edge line */}
      {fill > 0 && fill < 1 && (
        <line
          x1={x + w * fill} y1={y} x2={x + w * fill} y2={y + h}
          stroke={color} strokeWidth={1} opacity={0.6}
          clipPath={`url(#${clipId})`}
        />
      )}

      {/* Percentage label */}
      <text
        x={x + w / 2} y={y + h * 0.82}
        fill={color} fontSize={8} opacity={0.8}
        fontFamily="'Share Tech Mono', monospace"
        textAnchor="middle" letterSpacing={1}
      >
        {pct}%
      </text>
    </g>
  );
});
