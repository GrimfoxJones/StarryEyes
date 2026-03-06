// DEPRECATED: Canonical versions now live in starry-eyes-client/src/client/hud/schematics/.
// This standalone viewer is kept for reference only — do not update these files.

// Pure type definitions — no runtime code

export type Color = string;
export type Vec2 = { x: number; y: number };

// Gradients

export interface GradientStop {
  offset: number;
  color: Color;
  opacity: number;
}

export interface RadialGradient {
  type: "radial";
  id: string;
  cx?: number;
  cy?: number;
  r?: number;
  stops: GradientStop[];
}

export interface LinearGradient {
  type: "linear";
  id: string;
  x1?: number; y1?: number;
  x2?: number; y2?: number;
  stops: GradientStop[];
}

export type Gradient = RadialGradient | LinearGradient;

// Animations

export interface FlowDashAnimation {
  type: "flowDash";
  dasharray: string;
  duration: number;
  direction?: "forward" | "reverse";
}

export interface PulseAnimation {
  type: "pulse";
  attribute: string;
  from: number;
  to: number;
  duration: number;
  easing?: "linear" | "ease-in-out";
}

export interface RotateAnimation {
  type: "rotate";
  duration: number;
  direction?: "cw" | "ccw";
}

export interface PlasmaFieldAnimation {
  type: "plasmaField";
  particleCount?: number;
  rotationSpeed?: number;
  coreColor?: Color;
  outerColor?: Color;
}

export type Animation = FlowDashAnimation | PulseAnimation | RotateAnimation | PlasmaFieldAnimation;

// Effects

export interface GlowEffect {
  type: "glow";
  blur: number;
  intensity?: number;
}

export type Effect = GlowEffect;

// Style

export interface Style {
  stroke?: Color;
  strokeWidth?: number;
  fill?: Color | "none";
  opacity?: number;
  effect?: Effect;
  animation?: Animation;
}

// Shapes

export interface RectShape { type: "rect"; x: number; y: number; width: number; height: number; rx?: number; style?: Style; }
export interface EllipseShape { type: "ellipse"; cx: number; cy: number; rx: number; ry: number; style?: Style; }
export interface CircleShape { type: "circle"; cx: number; cy: number; r: number; style?: Style; }
export interface PathShape { type: "path"; d: string; style?: Style; }
export interface LineShape { type: "line"; x1: number; y1: number; x2: number; y2: number; style?: Style; }
export interface PolylineShape { type: "polyline"; points: Vec2[]; style?: Style; }

export type Shape = RectShape | EllipseShape | CircleShape | PathShape | LineShape | PolylineShape;

// Annotations

export interface TextAnnotation {
  type: "text";
  x: number;
  y: number;
  content: string;
  anchor?: "start" | "middle" | "end";
  size?: number;
  color?: Color;
  tracking?: number;
}

export interface CalloutAnnotation {
  type: "callout";
  from: Vec2;
  to: Vec2;
  label: string;
  sublabel?: string;
  color?: Color;
}

export interface DimensionAnnotation {
  type: "dimension";
  from: Vec2;
  to: Vec2;
  label: string;
  offset?: number;
  color?: Color;
}

export type Annotation = TextAnnotation | CalloutAnnotation | DimensionAnnotation;

// Layers

export interface Layer {
  id: string;
  label: string;
  color?: Color;
  defaultOn?: boolean;
  toggleable?: boolean;
  shapes: Shape[];
  annotations?: Annotation[];
}

// Document

export interface SchematicMeta {
  vessel: string;
  system: string;
  subsystem?: string;
  class?: string;
  revision?: string;
  classification?: string;
}

export interface SchematicDocument {
  meta: SchematicMeta;
  viewBox: { width: number; height: number };
  background?: Color;
  gradients?: Gradient[];
  layers: Layer[];
}
