// DEPRECATED: Canonical version now lives in starry-eyes-client/src/client/hud/schematics/.
// This standalone viewer is kept for reference only — do not update these files.

import { useState, useEffect, useRef, memo } from 'react';
import type {
  SchematicDocument, Shape, Annotation, Style, Gradient,
  EllipseShape, PlasmaFieldAnimation,
} from './schematic-schema.ts';

// --- Stable ID system ---
// Schematic data objects are module-level constants, so WeakMap entries persist across renders.
let idCounter = 0;
const stableIds = new WeakMap<object, string>();
function stableId(obj: object, prefix: string): string {
  let id = stableIds.get(obj);
  if (!id) {
    id = `${prefix}${++idCounter}`;
    stableIds.set(obj, id);
  }
  return id;
}

// --- PlasmaField sub-component (owns its own RAF loop) ---
const PlasmaField = memo(function PlasmaField({ shape, animation }: {
  shape: EllipseShape;
  animation: PlasmaFieldAnimation;
}) {
  const [tick, setTick] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    let raf: number;
    const loop = () => {
      setTick((Date.now() - startRef.current) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { cx, cy, rx, ry } = shape;
  const particleCount = animation.particleCount ?? 6;
  const rotationSpeed = animation.rotationSpeed ?? 22;
  const coreColor = animation.coreColor ?? '#fbbf24';
  const outerColor = animation.outerColor ?? '#f97316';
  const clipId = stableId(shape, 'pc');
  const coreGradId = stableId(animation, 'pg');

  const outerOpacity = 0.25 + 0.15 * Math.sin(tick * 1.9);
  const fieldAngle = tick * rotationSpeed;
  const coreRx = rx * 0.38 + rx * 0.02 * Math.sin(tick * 2.2);
  const coreRy = ry * 0.38 + ry * 0.02 * Math.sin(tick * 2.2);
  const hotSpotOpacity = 0.6 + 0.4 * Math.sin(tick * 3.1);

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
        </clipPath>
        <radialGradient id={coreGradId}>
          <stop offset="0%" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="30%" stopColor={coreColor} stopOpacity={0.7} />
          <stop offset="70%" stopColor={outerColor} stopOpacity={0.3} />
          <stop offset="100%" stopColor={outerColor} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Outer glow */}
        <ellipse cx={cx} cy={cy} rx={rx * 1.1} ry={ry * 1.1}
          fill={outerColor} opacity={outerOpacity} />

        {/* Rotating field lines */}
        <g transform={`rotate(${fieldAngle}, ${cx}, ${cy})`}>
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse key={i} cx={cx} cy={cy}
              rx={rx * 0.85} ry={ry * 0.12}
              transform={`rotate(${i * 30}, ${cx}, ${cy})`}
              fill="none" stroke={coreColor} strokeWidth={0.5}
              opacity={0.3 + 0.15 * Math.sin(tick * 1.5 + i)} />
          ))}
        </g>

        {/* Turbulence paths */}
        {Array.from({ length: particleCount }, (_, i) => {
          const phase = (i / particleCount) * Math.PI * 2;
          const cpx = cx + rx * 0.5 * Math.sin(tick * 0.8 + phase);
          const cpy = cy + ry * 0.5 * Math.cos(tick * 0.6 + phase + 1);
          const sx = cx + rx * 0.7 * Math.cos(phase + tick * 0.3);
          const sy = cy + ry * 0.7 * Math.sin(phase + tick * 0.3);
          const ex = cx + rx * 0.7 * Math.cos(phase + Math.PI + tick * 0.3);
          const ey = cy + ry * 0.7 * Math.sin(phase + Math.PI + tick * 0.3);
          return (
            <path key={i}
              d={`M ${sx},${sy} Q ${cpx},${cpy} ${ex},${ey}`}
              fill="none" stroke={outerColor} strokeWidth={0.7}
              opacity={0.2 + 0.1 * Math.sin(tick + i * 0.7)} />
          );
        })}

        {/* Core */}
        <ellipse cx={cx} cy={cy} rx={coreRx} ry={coreRy}
          fill={`url(#${coreGradId})`} />

        {/* Hot spot */}
        <ellipse cx={cx} cy={cy} rx={rx * 0.08} ry={ry * 0.08}
          fill="#fff" opacity={hotSpotOpacity} />
      </g>
    </g>
  );
});

// --- Rendering helpers ---

function styleProps(style?: Style, glowFilterId?: string) {
  if (!style) return {};

  const props: Record<string, string | number | undefined> = {};
  if (style.stroke) props.stroke = style.stroke;
  if (style.strokeWidth != null) props.strokeWidth = style.strokeWidth;
  if (style.fill != null) props.fill = style.fill;
  if (style.opacity != null) props.opacity = style.opacity;
  if (glowFilterId) props.filter = `url(#${glowFilterId})`;

  return props;
}

function renderPulseChild(style?: Style) {
  if (!style?.animation || style.animation.type !== 'pulse') return null;
  const { attribute, from, to, duration, easing } = style.animation;
  const calcMode = easing === 'ease-in-out' ? 'spline' : 'linear';
  const splines = easing === 'ease-in-out' ? '0.42 0 0.58 1;0.42 0 0.58 1' : undefined;
  return (
    <animate
      attributeName={attribute}
      values={`${from};${to};${from}`}
      dur={`${duration}s`}
      repeatCount="indefinite"
      calcMode={calcMode}
      keySplines={splines}
    />
  );
}

function renderShape(shape: Shape, index: number, glowIds: WeakMap<object, string>, flowIds: WeakMap<object, string>) {
  const glowFilterId = glowIds.get(shape);
  const flowKeyframeName = flowIds.get(shape);
  const pulse = renderPulseChild(shape.style);

  // PlasmaField special case — it owns its own animation loop
  if (shape.style?.animation?.type === 'plasmaField' && shape.type === 'ellipse') {
    return <PlasmaField key={index} shape={shape} animation={shape.style.animation} />;
  }

  const sp = styleProps(shape.style, glowFilterId);

  // Build flow dash inline style
  let fdStyle: React.CSSProperties | undefined;
  if (shape.style?.animation?.type === 'flowDash' && flowKeyframeName) {
    const dir = shape.style.animation.direction === 'reverse' ? 'reverse' : 'normal';
    fdStyle = {
      strokeDasharray: shape.style.animation.dasharray,
      animation: `${flowKeyframeName} ${shape.style.animation.duration}s linear infinite ${dir}`,
    };
  }

  // Rotate inline style
  let rotStyle: React.CSSProperties | undefined;
  if (shape.style?.animation?.type === 'rotate') {
    const dur = shape.style.animation.duration;
    const dir = shape.style.animation.direction === 'ccw' ? 'reverse' : 'normal';
    rotStyle = {
      transformOrigin: 'center',
      animation: `spin ${dur}s linear infinite ${dir}`,
    };
  }

  const mergedStyle = { ...fdStyle, ...rotStyle };
  const hasStyle = Object.keys(mergedStyle).length > 0;

  const base: Record<string, unknown> = {
    key: index,
    ...sp,
    ...(hasStyle ? { style: mergedStyle } : {}),
  };

  // Remove animation from base props (it's in style)
  if (fdStyle) {
    delete base.strokeDasharray;
    delete base.animation;
  }

  switch (shape.type) {
    case 'rect':
      return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} {...base}>{pulse}</rect>;
    case 'ellipse':
      return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...base}>{pulse}</ellipse>;
    case 'circle':
      return <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...base}>{pulse}</circle>;
    case 'path':
      return <path d={shape.d} {...base}>{pulse}</path>;
    case 'line':
      return <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...base}>{pulse}</line>;
    case 'polyline':
      return <polyline points={shape.points.map(p => `${p.x},${p.y}`).join(' ')} {...base}>{pulse}</polyline>;
  }
}

function renderAnnotation(ann: Annotation, index: number) {
  const defaultColor = '#4a8a9e';
  switch (ann.type) {
    case 'text':
      return (
        <text key={index}
          x={ann.x} y={ann.y}
          fill={ann.color ?? defaultColor}
          fontSize={ann.size ?? 7}
          fontFamily="'Share Tech Mono', monospace"
          textAnchor={ann.anchor ?? 'start'}
          letterSpacing={ann.tracking}
        >
          {ann.content}
        </text>
      );
    case 'callout': {
      const anchor = ann.to.x < ann.from.x ? 'end' : 'start';
      const color = ann.color ?? defaultColor;
      return (
        <g key={index}>
          <line x1={ann.from.x} y1={ann.from.y} x2={ann.to.x} y2={ann.to.y}
            stroke={color} strokeWidth={0.5} opacity={0.6} />
          <text x={ann.to.x} y={ann.to.y}
            fill={color} fontSize={7}
            fontFamily="'Share Tech Mono', monospace"
            textAnchor={anchor} dominantBaseline="middle"
          >
            {ann.label}
          </text>
          {ann.sublabel && (
            <text x={ann.to.x} y={ann.to.y + 11}
              fill={color} fontSize={6} opacity={0.5}
              fontFamily="'Share Tech Mono', monospace"
              textAnchor={anchor} dominantBaseline="middle"
            >
              {ann.sublabel}
            </text>
          )}
        </g>
      );
    }
    case 'dimension': {
      const color = ann.color ?? defaultColor;
      const dx = ann.to.x - ann.from.x;
      const dy = ann.to.y - ann.from.y;
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const mx = (ann.from.x + ann.to.x) / 2;
      const my = (ann.from.y + ann.to.y) / 2;
      const tickLen = 5;
      return (
        <g key={index}>
          <line x1={ann.from.x} y1={ann.from.y} x2={ann.to.x} y2={ann.to.y}
            stroke={color} strokeWidth={0.5} opacity={0.5} />
          {horizontal ? (
            <>
              <line x1={ann.from.x} y1={ann.from.y - tickLen} x2={ann.from.x} y2={ann.from.y + tickLen}
                stroke={color} strokeWidth={0.5} opacity={0.5} />
              <line x1={ann.to.x} y1={ann.to.y - tickLen} x2={ann.to.x} y2={ann.to.y + tickLen}
                stroke={color} strokeWidth={0.5} opacity={0.5} />
              <text x={mx} y={my + 12} fill={color} fontSize={6}
                fontFamily="'Share Tech Mono', monospace" textAnchor="middle">
                {ann.label}
              </text>
            </>
          ) : (
            <>
              <line x1={ann.from.x - tickLen} y1={ann.from.y} x2={ann.from.x + tickLen} y2={ann.from.y}
                stroke={color} strokeWidth={0.5} opacity={0.5} />
              <line x1={ann.to.x - tickLen} y1={ann.to.y} x2={ann.to.x + tickLen} y2={ann.to.y}
                stroke={color} strokeWidth={0.5} opacity={0.5} />
              <text x={mx - 12} y={my} fill={color} fontSize={6}
                fontFamily="'Share Tech Mono', monospace" textAnchor="middle"
                transform={`rotate(-90, ${mx - 12}, ${my})`}>
                {ann.label}
              </text>
            </>
          )}
        </g>
      );
    }
  }
}

// --- Gradient rendering ---

function renderGradient(grad: Gradient) {
  const stops = grad.stops.map((s, i) => (
    <stop key={i} offset={`${s.offset * 100}%`} stopColor={s.color} stopOpacity={s.opacity} />
  ));
  if (grad.type === 'radial') {
    return (
      <radialGradient key={grad.id} id={grad.id}
        cx={grad.cx ?? 0.5} cy={grad.cy ?? 0.5} r={grad.r ?? 0.5}>
        {stops}
      </radialGradient>
    );
  }
  return (
    <linearGradient key={grad.id} id={grad.id}
      x1={grad.x1 ?? 0} y1={grad.y1 ?? 0} x2={grad.x2 ?? 1} y2={grad.y2 ?? 0}>
      {stops}
    </linearGradient>
  );
}

// --- Main component ---

export interface SchematicOverlayProps {
  width: number;
  height: number;
}

export function SchematicViewer({ doc, overlay, activeLayers }: {
  doc: SchematicDocument;
  overlay?: (props: SchematicOverlayProps) => React.ReactNode;
  activeLayers?: string[];
}) {

  // Collect glow filters and flow dash keyframes
  const glowIds = useRef(new WeakMap<object, string>()).current;
  const flowIds = useRef(new WeakMap<object, string>()).current;

  const glowFilters: Array<{ id: string; blur: number; intensity: number }> = [];
  const flowKeyframes: Array<{ name: string; total: number }> = [];

  for (const layer of doc.layers) {
    for (const shape of layer.shapes) {
      if (shape.style?.effect?.type === 'glow') {
        const id = stableId(shape, 'gf');
        glowIds.set(shape, id);
        glowFilters.push({
          id,
          blur: shape.style.effect.blur,
          intensity: shape.style.effect.intensity ?? 1,
        });
      }
      if (shape.style?.animation?.type === 'flowDash') {
        const name = stableId(shape, 'fd');
        flowIds.set(shape, name);
        const parts = shape.style.animation.dasharray.split(/\s+/).map(Number);
        const total = parts.reduce((a, b) => a + b, 0);
        flowKeyframes.push({ name, total });
      }
    }
  }

  const { width, height } = doc.viewBox;
  const bg = doc.background ?? '#040c14';

  return (
    <div style={{ maxWidth: 900, width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '8px 4px', fontSize: 11, color: '#4a8a9e',
        letterSpacing: 1.5, flexWrap: 'wrap',
      }}>
        <span style={{ color: '#7ec8e3' }}>{doc.meta.vessel}</span>
        <span>{doc.meta.system}</span>
        {doc.meta.subsystem && <span>{doc.meta.subsystem}</span>}
        {doc.meta.revision && <span>REV {doc.meta.revision}</span>}
        <span className="online-blink" style={{ color: '#4ade80' }}>&#9673; ONLINE</span>
      </div>

      {/* SVG */}
      <svg viewBox={`0 0 ${width} ${height}`} width="100%"
        style={{ display: 'block', background: bg }}>
        {/* Background */}
        <rect width={width} height={height} fill={bg} />

        {/* Grid pattern */}
        <defs>
          <pattern id="grid" width={16} height={16} patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#091822" strokeWidth={0.5} opacity={0.33} />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" />

        {/* Gradient defs */}
        <defs>
          {doc.gradients?.map(renderGradient)}
        </defs>

        {/* Glow filter defs */}
        <defs>
          {glowFilters.map(gf => (
            <filter key={gf.id} id={gf.id} x="-50%" y="-50%" width="200%" height="200%">
              {Array.from({ length: gf.intensity }, (_, i) => (
                <feGaussianBlur key={i} in="SourceGraphic" stdDeviation={gf.blur * (i + 1)} result={`blur${i}`} />
              ))}
              <feMerge>
                {Array.from({ length: gf.intensity }, (_, i) => (
                  <feMergeNode key={i} in={`blur${i}`} />
                ))}
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>

        {/* Flow dash keyframes */}
        <style>{`
          ${flowKeyframes.map(fk =>
            `@keyframes ${fk.name} { from { stroke-dashoffset: ${fk.total}; } to { stroke-dashoffset: 0; } }`
          ).join('\n')}
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        `}</style>

        {/* Layers */}
        {doc.layers.map(layer => {
          const isNonToggleable = layer.toggleable === false;
          const isVisible = activeLayers
            ? isNonToggleable || activeLayers.includes(layer.id)
            : isNonToggleable || layer.defaultOn !== false;
          if (!isVisible) return null;
          return (
            <g key={layer.id}>
              {layer.shapes.map((shape, i) => renderShape(shape, i, glowIds, flowIds))}
              {layer.annotations?.map((ann, i) => renderAnnotation(ann, i))}
            </g>
          );
        })}

        {/* Overlay */}
        {overlay?.({ width, height })}

        {/* Classification stamp */}
        {doc.meta.classification && (
          <text x={width / 2} y={height - 8}
            fill="#1a4557" fontSize={8} fontFamily="'Share Tech Mono', monospace"
            textAnchor="middle" letterSpacing={3}>
            {doc.meta.classification}
          </text>
        )}
      </svg>

      {/* Blink CSS */}
      <style>{`
        .online-blink { animation: blink-online 1.2s step-end infinite; }
        @keyframes blink-online { 0%, 69% { opacity: 1; } 70%, 100% { opacity: 0; } }
      `}</style>
    </div>
  );
}
