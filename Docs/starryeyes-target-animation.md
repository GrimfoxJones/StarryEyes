# StarryEyes — Target Acquisition Animation & Info Display

**Version:** 0.1
**Author:** Grimfox Games
**Date:** March 2026
**Rendering Layer:** PixiJS (entirely — no React components for this feature)

---

## Overview

When the player left-clicks a map object (planet, station, ship, asteroid), a targeting acquisition animation plays and an info box appears connected to the target by a line. The entire assembly lives in the PixiJS scene graph, moves with the camera, and tracks the target as it moves.

This is the primary way players inspect objects in the game world. It should feel like a ship's computer acquiring and analyzing a contact — quick, precise, satisfying.

---

## The Animation Sequence

Total duration: ~500ms. Four phases, overlapping slightly for fluidity.

### Phase 1: Reticle Snap (0–150ms)

A targeting reticle appears around the clicked object. The reticle is four corner brackets forming a square, like camera focus brackets:

```
┌─        ─┐

     ◉       ← target object at center

└─        ─┘
```

**Animation:**

- At t=0, the four bracket corners appear at ~2× their final distance from center (oversized).
- They snap inward to their final tight position around the target over 100ms. Easing: `easeOutBack` for a slight overshoot-and-settle feel (they come in slightly too tight, then bounce to final size).
- At t=100ms, brackets are at final position. A brief brightness pulse (opacity goes from 1.0 to 1.0 — they arrive bright).
- At t=130ms, a second subtle pulse — the brackets flash slightly brighter then settle to their resting brightness. This is the "blip-blip" — two rapid brightness/scale micro-pulses on the brackets at t=80ms and t=130ms.

**Reticle visual:**

- Four L-shaped corners (PixiJS Graphics lines), each ~8-12px per arm at default zoom.
- 1px line weight.
- Accent color (`#00d4ff`) with a subtle glow (drawn as a wider, more transparent line behind the main line, or via PixiJS filter).
- The reticle scales with zoom so it always appears the same screen size regardless of how far you're zoomed in/out. It is attached to the target's world position but its pixel size is constant.

**Reticle sizing:**

- The reticle should be slightly larger than the target's icon. For a planet icon that renders at 8px diameter, the reticle sits maybe 6px outside it on each side. For a station at 6px, the reticle is proportionally tighter.
- The brackets should feel like they're "framing" the target precisely. Not too loose, not overlapping the icon.

### Phase 2: Line Extension (100–300ms)

Starting at t=100ms (overlapping with the end of the reticle snap), a thin line begins drawing outward from the reticle toward where the info box will appear.

**Line path:**

- Starts at the right edge of the reticle (or whichever edge has more screen space — see Adaptive Positioning below).
- Extends outward in a mostly-horizontal direction, with a slight angle for visual interest. Not perfectly horizontal — maybe 10-15° off-axis, angling slightly up or down depending on the target's screen position.
- The line has a short horizontal jog at the end (an "elbow") where it meets the info box. This creates a clean connection point.

```
         ┌─    ─┐
              ◉    ──────────┐  ← elbow
         └─    ─┘            │
                             ┌──────────────┐
                             │  INFO BOX    │
                             └──────────────┘
```

**Animation:**

- The line draws from the reticle outward, like it's being traced in real time. Animate the endpoint from start to finish over 200ms.
- Easing: `easeOutQuad` — starts fast, decelerates to the final position.
- Line length: ~80-120px of screen space (constant regardless of zoom).

**Line visual:**

- 1px accent color line, same as reticle.
- Subtle glow matching reticle glow.
- The elbow is a clean 90° bend, ~10-15px vertical segment connecting to the info box edge.

### Phase 3: Info Box Appears (250–450ms)

Starting at t=250ms (as the line nears its final position), the info box fades and scales in at the end of the line.

**Animation:**

- Scale from 0.9 to 1.0 over 200ms. Easing: `easeOutQuad`.
- Opacity from 0 to 1 over 150ms (slightly faster than the scale, so it's fully opaque before it finishes scaling).
- The box appears to "materialize" at the end of the line. It should feel like data loading onto a display.

**Text content animation (optional polish):**

- If we want extra Expanse feel: the text inside the box can appear line-by-line with a very rapid stagger (30-40ms per line). Each line types in instantly (not letter-by-letter — that's too slow) but the stagger gives a "data populating" effect.
- This is optional polish. If it's complex to implement, just fade the whole box in at once. It'll still look great.

### Phase 4: Settled State (450ms+)

The animation is complete. The reticle, line, and info box are all at their final positions and opacities. They persist until the player clicks something else or clicks empty space to dismiss.

In the settled state:

- The reticle subtly pulses (very gentle opacity oscillation, maybe 0.7–1.0 over a 2-second cycle). This keeps it feeling "alive" like an active lock-on.
- The line and info box are static — no animation, no pulsing. Clean and readable.
- Everything tracks the target. If the target is a ship in transit or a planet in orbit, the whole assembly moves with it smoothly.

---

## Adaptive Positioning

The info box and line need to avoid going off-screen and avoid overlapping other important elements. This doesn't need to be perfect — a simple heuristic is fine.

### Quadrant-Based Placement

Divide the screen into four quadrants based on the target's screen position. Place the info box in the quadrant with the most available space:

```
Target in top-left quadrant     → info box extends to the right and/or downward
Target in top-right quadrant    → info box extends to the left and/or downward
Target in bottom-left quadrant  → info box extends to the right and/or upward
Target in bottom-right quadrant → info box extends to the left and/or upward
```

The line angle adjusts accordingly. If the box goes to the right, the line goes right with a slight downward or upward angle. If the box goes to the left, the line goes left.

### Camera Movement Tracking

When the player pans or zooms, the target moves in screen space. The info box and line must follow. Since everything is in the PixiJS scene graph (world space), panning is handled automatically — the camera transform moves everything together.

However, the info box should maintain a FIXED SCREEN-SPACE offset from the target, not a fixed world-space offset. This means:

- The info box position is computed as: target screen position + offset (in pixels).
- Each frame, recalculate the offset direction based on the target's current screen position (quadrant check).
- If the target moves from one quadrant to another (e.g., the player pans and the target crosses the screen center), the info box should smoothly transition to the new side. Animate the line and box to the new position over ~300ms rather than jumping.

**Implementation approach:**

The reticle is a child of the target's display object (or positioned at the target's world coordinates). Its scale is adjusted each frame to maintain constant screen size: `reticle.scale = 1 / cameraZoom`.

The line and info box are positioned each frame in a render callback:

```typescript
function updateInfoDisplay(target, camera, viewport) {
  // Target position in screen space
  const screenPos = worldToScreen(target.position, camera);

  // Determine which side has more space
  const goRight = screenPos.x < viewport.width * 0.5;
  const goDown = screenPos.y < viewport.height * 0.5;

  // Line endpoint offset (screen pixels)
  const offsetX = goRight ? 100 : -100;
  const offsetY = goDown ? 30 : -30;

  // Convert offset back to world space for PixiJS positioning
  const lineEndWorld = screenToWorld(
    { x: screenPos.x + offsetX, y: screenPos.y + offsetY },
    camera
  );

  // Update line endpoint
  line.updateEndpoint(lineEndWorld);

  // Update info box position
  infoBox.position = lineEndWorld;
  infoBox.scale.set(1 / camera.zoom); // Constant screen size

  // Update reticle scale
  reticle.scale.set(1 / camera.zoom);
}
```

This runs every frame. At strategy game frame rates with one info display active, the performance cost is negligible.

---

## Info Box Content

The info box is a PixiJS Container with Graphics (background) and Text elements. It renders differently based on what was clicked, matching the popup content defined in the UI Specification document.

### Layout

```
┌───────────────────────┐
│ ◉ MARA                │  ← Icon + name, accent color, slightly larger font
│ Rocky Planet           │  ← Type, secondary text color
│ Orbit: 45,000 km      │  ← Data rows, monospace values
│ Period: 31m            │
│ Stations: 2           │
│                       │
│ [More →]              │  ← Clickable link, accent color
└───────────────────────┘
```

**Visual:**

- Background: semi-transparent dark fill matching HUD style (`rgba(10, 14, 20, 0.85)`).
- Border: 1px accent color, all sides.
- Padding: 8px.
- Width: auto-sized to content, min ~160px, max ~260px.
- Text: monospace for values, condensed sans for labels. Match the corner HUD typography.
- The `[More →]` link is a clickable PixiJS text that opens the React detail modal (the one interaction point between PixiJS info display and React UI).

### Content by Object Type

**Planet/Moon:**
```
◉ [NAME]
[Type] (Rocky Planet / Gas Giant / Ice Moon / etc.)
Orbit: [radius] km
Period: [period]
Stations: [count]
[More →]
```

**Station:**
```
◇ [NAME]
[Station Class]
Faction: [faction]
Services: [abbreviated list]
Range: [distance from player] km
[More →]
```

**Other Ship (identified via transponder):**
```
△ [TRANSPONDER ID]
[Ship Class]
Bearing: [bearing]°
Range: [range] km
Vel: [velocity] km/s
Drive: [FLARE active / inactive]
[More →]
```

**Other Ship (unidentified):**
```
△ CONTACT [tracking ID]
Bearing: [bearing]°
Range: ~[estimated range] km
Mass: [Small / Medium / Large]
Drive: [Active / Inactive]
Via: [detection methods]
[More →]
```

**Own Route (clicked on trajectory line):**
```
─ ROUTE TO [DESTINATION]
ETA: [time]
Dist: [distance] km
Fuel: [cost] kg
Phase: [Accel / Decel / Coast]
[More →]
```

**Asteroid:**
```
�ite [NAME or ID]
Type: [Metallic / Silicate / Ice / etc.]
Estimated Mass: [mass]
Range: [distance] km
```

---

## Dismiss Animation

When the player clicks empty space or clicks a different target:

### Quick Dismiss (clicking empty space)

- Info box fades out over 100ms (opacity 1 → 0, scale 1 → 0.95).
- Line retracts toward the target over 150ms (endpoint animates back to start).
- Reticle brackets expand outward and fade over 150ms (reverse of the snap-in).
- Total dismiss time: ~150ms. Should feel snappy — the computer releasing its lock.

### Target Switch (clicking a new target)

- Current info display dismisses with the quick dismiss animation.
- New target acquisition animation begins immediately (can overlap — the old one is fading while the new one is snapping in).
- If the new target is close to the old one on screen, the transition should feel fluid, almost like the reticle is jumping to the new target. If they're far apart, it's clearly two separate animations.

---

## Multiple Selections (Future)

For now, only one target can be selected at a time. Clicking a new target dismisses the old one. In the future, we may want to support multiple selections (e.g., shift-click to add contacts to a watch list). The PixiJS-based approach supports this naturally — each selection is an independent set of display objects (reticle + line + info box). But don't build multi-select now. One at a time.

---

## Performance Notes

- The reticle is 4 line segments (PixiJS Graphics). Trivial draw cost.
- The line is 2-3 line segments (straight + elbow). Trivial.
- The info box is a Graphics rectangle + 5-8 Text objects. Text is the most expensive part — use BitmapText if performance is a concern (pre-rendered font atlas). For a single info display, regular Text is fine.
- The glow effect is either a second, wider, more transparent line drawn behind the main one (cheap) or a PixiJS blur filter on the reticle container (more expensive but looks better). Start with the doubled-line approach. Add the filter only if it doesn't hit frame rate.
- The per-frame position update (adaptive positioning) is one coordinate transform and a few comparisons. Zero performance impact.

---

## Implementation Order

1. **Static reticle.** Click a planet, four brackets appear at the correct position, no animation. Verify positioning and scaling across zoom levels.
2. **Static line and info box.** Brackets + line + box all appear instantly on click. Verify content rendering, positioning, and adaptive placement.
3. **Dismiss on click-away.** Click empty space, everything disappears (no animation yet).
4. **Target tracking.** Verify the assembly follows a moving target (orbiting planet) smoothly.
5. **Reticle snap animation.** Add the scale-in with easing and the blip-blip pulses.
6. **Line draw animation.** Add the traced-line extension.
7. **Info box fade-in.** Add the scale/opacity entrance.
8. **Dismiss animations.** Add the reverse animations.
9. **Settled state pulse.** Add the gentle reticle breathing animation.
10. **Polish.** Glow effects, text stagger (if desired), transition smoothness when switching targets.

Build it in this order. Each step is independently testable and visually verifiable. Don't skip to step 5 before step 4 works perfectly — the tracking must be solid before animations are layered on top.
