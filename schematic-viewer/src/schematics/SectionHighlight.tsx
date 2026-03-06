// DEPRECATED: Canonical version now lives in starry-eyes-client/src/client/hud/schematics/.
// This standalone viewer is kept for reference only — do not update these files.

import { useState, useEffect, useRef, memo } from 'react';
import type { Compartment } from './ship-overview.schematic.ts';

// Animated highlight overlay for selected ship compartments.
// Renders inside the SchematicViewer's SVG via the overlay prop.

function SectionBox({ section, tick, color }: { section: Compartment; tick: number; color: string }) {
  const { x, y, w, h, rx } = section;
  const pad = 3;
  const sx = x - pad;
  const sy = y - pad;
  const sw = w + pad * 2;
  const sh = h + pad * 2;
  const r = rx ? rx + pad : undefined;

  const borderOpacity = 0.5 + 0.3 * Math.sin(tick * 3);
  const fillOpacity = 0.03 + 0.02 * Math.sin(tick * 2);
  const scanY = sy + (sh * ((tick * 0.4) % 1));
  const cornerPulse = 0.6 + 0.4 * Math.sin(tick * 4);
  const t = 10;

  return (
    <g>
      <rect x={sx} y={sy} width={sw} height={sh} rx={r}
        fill={color} opacity={fillOpacity} />
      <rect x={sx} y={sy} width={sw} height={sh} rx={r}
        fill="none" stroke={color} strokeWidth={1.5} opacity={borderOpacity} />
      {/* Scan line — clip to rounded rect if needed */}
      {r ? (
        <g>
          <clipPath id={`scan-clip-${section.id}`}>
            <rect x={sx} y={sy} width={sw} height={sh} rx={r} />
          </clipPath>
          <line x1={sx} y1={scanY} x2={sx + sw} y2={scanY}
            stroke={color} strokeWidth={0.5} opacity={0.3}
            clipPath={`url(#scan-clip-${section.id})`} />
        </g>
      ) : (
        <line x1={sx} y1={scanY} x2={sx + sw} y2={scanY}
          stroke={color} strokeWidth={0.5} opacity={0.3} />
      )}
      <g stroke={color} strokeWidth={1.5} fill="none" opacity={cornerPulse}>
        <path d={`M ${sx},${sy + t} L ${sx},${sy} L ${sx + t},${sy}`} />
        <path d={`M ${sx + sw - t},${sy} L ${sx + sw},${sy} L ${sx + sw},${sy + t}`} />
        <path d={`M ${sx},${sy + sh - t} L ${sx},${sy + sh} L ${sx + t},${sy + sh}`} />
        <path d={`M ${sx + sw - t},${sy + sh} L ${sx + sw},${sy + sh} L ${sx + sw},${sy + sh - t}`} />
      </g>
      <text
        x={sx + sw / 2} y={sy - 6}
        fill={color} fontSize={8} opacity={borderOpacity}
        fontFamily="'Share Tech Mono', monospace"
        textAnchor="middle" letterSpacing={2}
      >
        {section.label}{section.sub ? ` — ${section.sub}` : ''}
      </text>
    </g>
  );
}

export const SectionHighlight = memo(function SectionHighlight({
  sections,
  color = '#7ec8e3',
}: {
  sections: Compartment[];
  color?: string;
}) {
  const [tick, setTick] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (sections.length === 0) return;
    startRef.current = Date.now();
    let raf: number;
    const loop = () => {
      setTick((Date.now() - startRef.current) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <g>
      {sections.map(s => (
        <SectionBox key={s.id} section={s} tick={tick} color={color} />
      ))}
    </g>
  );
});
