# StarryEyes — User Interface Specification

**Version:** 0.1 — First Pass (Stub & Layout)
**Author:** Grimfox Games
**Date:** March 2026
**Companion to:** Ship Subsystem Architecture, Sensors & Detection, Navigation Refactor, Route Curves

---

## First Pass Scope

This document describes the full UI vision. However, the first implementation pass is LAYOUT AND NAVIGATION ONLY:

- Build the panel structure and tab system. All tabs clickable, all sub-tabs reachable.
- Populate panels with placeholder/stub content that demonstrates the layout and information hierarchy.
- Map renders with existing functionality (planets, orbits, ship, routes, trails).
- Popups and modals open and close with stub content.
- No functional wiring — buttons don't execute game logic, values are placeholder or hardcoded.
- The goal is to SEE the interface, FEEL the navigation between panels, and VALIDATE the layout before committing to functionality.

Get the skeleton right. We'll wire it up after.

---

## Design Reference — The Expanse

The visual language of StarryEyes is drawn directly from the CIC (Combat Information Center) displays, navigation consoles, and ship HUD interfaces seen in The Expanse. These are NOT flashy sci-fi interfaces. They are functional, dense, military-industrial displays designed to convey maximum information to a trained operator.

Key characteristics to emulate:

**Information density over aesthetics.** Every pixel carries data. Screens are packed with readouts, status indicators, trajectory plots, and system diagrams. White space is minimal. This is a workstation, not a marketing page.

**Monochrome with accent color.** The dominant palette is dark backgrounds with a single primary accent color (cyan/teal) for active data, dim grey for inactive/background elements, amber/yellow for warnings, and red for critical alerts. Secondary data uses a muted blue-grey. Almost nothing is white — even text labels are slightly off-white or light grey.

**Flat, geometric, precise.** No gradients, no gloss, no 3D bevels. Elements are defined by thin borders, subtle background shade differences, and precise alignment. Think blueprint, not billboard.

**Typography is functional.** Monospace fonts for numeric data (they column-align naturally). Condensed sans-serif for labels and headers. Small font sizes are fine — operators learn to read dense displays. Variable font sizes indicate hierarchy: the most important numbers are slightly larger, everything else is small and consistent.

**Thin lines and hairline borders.** Panel dividers, trajectory lines, orbit paths, grid lines — all thin (1px or 0.5px where supported). Thicker lines are reserved for emphasis (the player's own route, a selected object's highlight).

**Subtle glow and bloom on active elements.** Active data points, the player's ship icon, alert indicators — these get a subtle glow effect (CSS box-shadow or text-shadow with the accent color). This is restrained, not neon. Think "LED indicator" not "nightclub."

**Scan lines and noise are OPTIONAL.** A very subtle scan line overlay or film grain can add atmosphere, but it must not reduce readability. If in doubt, leave it out. The density of real information creates the aesthetic, not post-processing effects.

---

## Overall Layout

The map dominates the viewport. Ship status is conveyed through small, semi-transparent floating HUD elements in the corners. The left panel with tabs (SYS, CREW, OPS, DOCK) is collapsed by default and expands as an overlay when the player opens it, preserving the map view underneath.

```
┌──────────────────────────────────────────────────────────────────┐
│ ┌─────────────┐                        ┌───────────────────────┐ │
│ │ GAME TIME   │                        │ MODE: TRANSIT         │ │
│ │ D16 20:48:54│                        │ VELOCITY: 900.8 km/s  │ │
│ │ 100x        │                        │ DEST: Tellus          │ │
│ └─────────────┘                        │ ETA: 1d 1h            │ │
│                                        │ DECEL                 │ │
│                                        └───────────────────────┘ │
│                                                                  │
│                         MAP (FULL VIEWPORT)                      │
│                                                                  │
│                    PixiJS Canvas — stars, planets,                │
│                    orbits, ships, routes, trails                  │
│                                                                  │
│                              ┌─────────────┐                     │
│                              │  INFO POPUP  │ (on left-click)    │
│                              │  Brief data  │                    │
│                              │  [More →]    │                    │
│                              └─────────────┘                     │
│                                                                  │
│ ┌─────────────┐                                                  │
│ │ FUEL 89%    │                                                  │
│ │ ████████░░  │                                                  │
│ └─────────────┘                                                  │
└──────────────────────────────────────────────────────────────────┘

LEFT PANEL (collapsed by default, expands as overlay):

  ┌──────────────────┐
  │ [≡] SYS CREW OPS │  ← tab bar with collapse toggle
  │     [DOCK]       │
  ├──────────────────┤
  │                  │
  │  Tab content     │
  │  with sub-tabs   │
  │  and detail      │
  │  panels          │
  │                  │
  │  Semi-transparent│
  │  background,     │
  │  matching        │
  │  existing HUD    │
  │  style           │
  │                  │
  └──────────────────┘
```

### Map-First Design

The map is always full-viewport. It is never resized or pushed aside by UI panels. This preserves the cinematic quality of the star system view during transit — the player watches their ship cross the system with minimal interface clutter.

### Floating HUD Elements (Always Visible)

The existing corner HUD elements are already doing the right thing. They convey critical status without obscuring the map. Keep them as-is:

- **Top-left: Game clock.** Game time and time scale indicator (100x). No player-accessible pause or warp controls — this is a shared MMO clock. Semi-transparent background.
- **Top-right: Navigation status.** Mode (transit/orbit/idle/docked), velocity, destination, ETA, phase (accel/decel). Semi-transparent background.
- **Bottom-left: Fuel.** Percentage and bar. Compact. Semi-transparent background.
- **Bottom-right (future):** Reserved for additional status — signature level, alert indicators, contact count.

These HUDs are floating elements positioned in the viewport corners, not part of a panel layout. They stay put regardless of whether the left panel is open or closed.

### Left Panel — Collapsible Overlay

The left panel is the player's deep-dive interface. It opens when they need to manage ship systems, review crew, execute operations, or interact with a station. It closes when they're done, returning to the clean map view.

**Behavior:**

- **Default state:** Collapsed. Only a small tab toggle button visible at the left edge of the screen (a thin vertical bar or hamburger icon, very subtle).
- **Open state:** Panel slides in from the left as a semi-transparent overlay (~320-400px wide). Same visual treatment as the existing HUD elements — dark semi-transparent background with accent-color borders. The map is visible through and behind it.
- **Toggle:** Click the toggle button, press a hotkey (Tab or T or similar), or some tabs auto-open contextually (DOCK auto-opens on docking at a station).
- **Close:** Click the toggle again, press the hotkey again, press Escape, or click on the map behind the panel.
- **Semi-transparent:** The panel uses the same semi-transparent dark background as the existing corner HUD elements. The map shows through. This maintains visual consistency and keeps the spacious feeling even with the panel open.

**Opening the panel never changes the map size or position.** The panel overlays the map. If the player is tracking their ship, the view doesn't shift when the panel opens.

### Panel Proportions

- **Left panel (when open):** ~320-400px wide, full viewport height minus header/status areas. Semi-transparent overlay.
- **Map:** always 100% of viewport. Never resized.
- **Corner HUDs:** positioned with fixed offsets from viewport edges. ~120-200px wide, variable height. Semi-transparent.

---

## Floating HUD Style

All corner HUD elements share the same visual treatment:

- Semi-transparent dark background (`rgba(10, 14, 20, 0.75)` or similar — match what the prototype already uses).
- Thin 1px border in the accent color (subtle, not bright).
- Small padding (8-12px).
- Monospace font for numeric values. Condensed sans-serif for labels.
- No rounded corners. Rectangular and precise.
- Content is compact — no wasted space inside the HUD boxes.
- HUDs do not interact with each other or with the left panel. They are independent floating elements.

The existing prototype has nailed this style. Don't change it. Match new HUD elements to the same treatment.

---

---

## Left Panel — Tab System

The left panel has a primary tab bar across the top with four tabs. Three are always available; one is contextual.

### Primary Tabs

| Tab | Label | Always Available | Description |
|-----|-------|-----------------|-------------|
| SYS | SYS | Yes | Ship systems — subsystem tree, reactor, drive, thermal, sensors, structural |
| CREW | CREW | Yes | Crew management — roster, assignments, skills, morale |
| OPS | OPS | Yes | Operations — mission log, mining, probes, scanning, trade log |
| DOCK | DOCK | Only when docked | Station services — market, refuel, repair, upgrade, crew hire |

**Tab bar visual:** tabs are compact rectangles with 3-4 character labels. Active tab has a bright accent-color bottom border and slightly lighter background. Inactive tabs are dim. DOCK tab is completely hidden (not greyed, hidden) when not docked at a station. When docked, it appears with a subtle entrance animation (slide in from the right of the tab bar).

### Sub-Tab Pattern

Each primary tab can have sub-tabs for drilling into categories. Sub-tabs appear as a secondary row below the primary tab bar, or as a vertical list on the left edge of the tab content area (choose whichever feels better — the vertical list is more Expanse-like).

Sub-tab navigation should feel like drilling into a system — you're going deeper into the ship's computer, not switching between unrelated pages.

**Breadcrumb trail:** when navigated into a sub-tab, show a breadcrumb at the top of the content area: `SYS > DRIVE > TUNING`. Clicking any breadcrumb level navigates back up. This prevents the player from feeling lost in deep menus.

---

## SYS Tab — Ship Systems

This is the subsystem tree from the Ship Subsystem Architecture document, rendered as navigable panels.

### SYS Overview (default view)

When SYS is first selected, show an overview dashboard — a high-level snapshot of all subsystems. Think of this as the "captain's status board."

```
┌────────────────────────┐
│ SYS > OVERVIEW         │
├────────────────────────┤
│                        │
│  NAV     ● IN TRANSIT  │
│  Dest: Mara            │
│  ETA: 38h 12m          │
│                        │
│  DRIVE   ● ACTIVE      │
│  Thrust: 78%           │
│  Temp: 1,840 K         │
│                        │
│  REACTOR ● NOMINAL     │
│  Output: 640 MW        │
│  Load: 0.73            │
│                        │
│  THERMAL ● NOMINAL     │
│  Net: -12 MW           │
│  Hull: 312 K           │
│                        │
│  SENSORS ● PASSIVE     │
│  Contacts: 3           │
│                        │
│  PROPEL. ● 72%         │
│  ████████░░ 5,760 kg   │
│                        │
│  CARGO   ● 64%         │
│  ██████░░░ 25,600 kg   │
│                        │
│  COMMS   ● XPNDR ON    │
│                        │
│  STRUCT. ● 100%        │
│  Mass: 47,360 kg       │
│                        │
└────────────────────────┘
```

Each subsystem row is clickable. Clicking one navigates to that subsystem's detail sub-tab. The status indicator (●) is color-coded: green for nominal, amber for warning, red for critical, grey for offline.

### SYS Sub-Tabs

| Sub-Tab | Content |
|---------|---------|
| NAV | Nav computer details: route info, destination, transit progress, delta-v budget |
| DRIVE | Drive status, throttle, temperatures. Click into TUNING for reaction mass ratio, nozzle settings |
| REACTOR | Reactor status, power output/load. Click into CORE for plasma diagnostics, confinement, fuel injection |
| THERMAL | Heat load, radiators, heat sinks. Visual balance indicator (heat in vs heat out) |
| SENSORS | Sensor suite status, enabled/disabled toggles, contact summary. Click into individual sensor details |
| PROPEL. | Tank levels, flow rates, reserve estimates |
| CARGO | Hold contents, mass breakdown, manifest |
| COMMS | Transponder toggle, antenna status |
| STRUCT. | Hull integrity, total mass breakdown (hull + propellant + cargo) |

Each sub-tab follows the subsystem tree structure from the architecture doc. Values render according to their `displayHint` metadata. `controlled` values in MANUAL mode render as interactive sliders/inputs. The `autoValue` ghost indicator shows where AUTO would set the value.

### Subsystem Schematics

Major subsystems (drive, reactor, thermal) include a small line-diagram schematic at the top of their detail panel. These are SVG illustrations showing the physical layout of the subsystem — reactor chamber with coils and coolant loops, drive nozzle with injection system, radiator panels extending from hull.

Schematics are decorative but state-linked:
- Flow lines animate when the system is active (dashed line animation, CSS)
- Components shift color with temperature (cool blue → amber → red, mapped to value ranges)
- Offline components are dim grey
- The schematic is a visual anchor that makes the panel feel like a real engineering console, not a spreadsheet

For the first pass, schematics can be simple placeholder SVGs or even static images. The animation and state-linking comes later.

---

## CREW Tab — Crew Management

Stub for first pass. The structure:

### CREW Overview

Crew roster as a compact list. Each crew member shows name, role, status (on duty / off duty / injured), and a tiny skill bar or rating.

```
┌────────────────────────┐
│ CREW > ROSTER          │
├────────────────────────┤
│                        │
│  ● Chen, Mika          │
│    PILOT — On Duty     │
│    Nav ████░ Eng ██░░░ │
│                        │
│  ● Okafor, James       │
│    ENGINEER — On Duty  │
│    Nav ██░░░ Eng █████ │
│                        │
│  ○ Vasquez, Lena       │
│    CARGO — Off Duty    │
│    Nav █░░░░ Eng ██░░░ │
│                        │
│  Crew: 3/4             │
│  Morale: ████░ Good    │
│                        │
└────────────────────────┘
```

### CREW Sub-Tabs

| Sub-Tab | Content |
|---------|---------|
| ROSTER | Crew list with status, skills summary |
| ASSIGN | Duty assignments — who's on which station |
| DETAIL | Individual crew member deep-dive (click from roster): full skills, history, condition |

Crew mechanics are future work. First pass: just the roster layout with placeholder crew and the tab navigation working.

---

## OPS Tab — Operations

The operations tab is context-sensitive — it shows different operations depending on what's available. This is the "do stuff" tab.

### OPS Overview

A list of available operations with status indicators. Operations that aren't currently possible are shown but dimmed.

```
┌────────────────────────┐
│ OPS > OVERVIEW         │
├────────────────────────┤
│                        │
│  TRADE LOG             │
│  Last: Sold 4,000 kg   │
│  rare metals @ Tellus  │
│  Profit: +12,400 cr    │
│                        │
│  MINING        [N/A]   │
│  No asteroid selected  │
│                        │
│  SCAN          [AVAIL] │
│  Passive scan active   │
│  3 contacts tracked    │
│                        │
│  PROBES        [N/A]   │
│  No probes in stock    │
│                        │
│  MISSION LOG           │
│  Active: 1             │
│  "Deliver medical      │
│   supplies to Jove     │
│   Station"             │
│                        │
└────────────────────────┘
```

### OPS Sub-Tabs

| Sub-Tab | Content |
|---------|---------|
| TRADE | Trade history, profit/loss log, price comparison notes |
| SCAN | Active sensor management, contact list, scan results |
| MINING | Asteroid selection, extraction status, yield estimates (when near a mineable body) |
| PROBES | Probe inventory, launch controls, deployed probe data (future) |
| MISSIONS | Active and completed mission log |
| COMBAT | Combat encounter interface (future — only appears during encounters) |

First pass: stub all sub-tabs with placeholder content. TRADE and SCAN are the most likely to get wired up first.

---

## DOCK Tab — Station Services

Only visible when docked at a station. This is where the player interacts with the station's services.

### DOCK Overview

Station identity and available services.

```
┌────────────────────────┐
│ DOCK > TELLUS STATION  │
├────────────────────────┤
│                        │
│  Tellus Orbital        │
│  Class: Trade Hub      │
│  Faction: Independent  │
│                        │
│  ● MARKET      [OPEN]  │
│  ● REFUEL      [OPEN]  │
│  ● REPAIR      [OPEN]  │
│  ○ UPGRADE     [BUSY]  │
│  ● CREW HIRE   [OPEN]  │
│  ○ SHIPYARD    [N/A]   │
│                        │
│  Docking Fee: 120 cr   │
│  Time Docked: 4m 12s   │
│                        │
└────────────────────────┘
```

### DOCK Sub-Tabs

| Sub-Tab | Content |
|---------|---------|
| MARKET | Buy/sell commodities. Price list, quantity selectors, buy/sell buttons. Shows price vs. galactic average. |
| REFUEL | Propellant purchase. Shows current level, cost to fill, partial fill option. |
| REPAIR | Hull and subsystem repair. Lists damaged systems with repair cost and time. |
| UPGRADE | Ship upgrades — better drives, sensors, cargo holds, reactor. Availability varies by station. |
| CREW | Hire new crew members. Shows available candidates with skills and salary. |
| SHIPYARD | Buy/sell ships. Only at major stations. (Far future feature — stub only.) |

MARKET is the critical one for gameplay. First pass: stub the price list layout with placeholder commodities and prices. The buy/sell interaction can be wired up early since it's the core game loop.

---

## Map Panel — Interaction Model

### Input

| Action | Effect |
|--------|--------|
| **Right-click planet/moon** | Plot intercept route. Ship's proposed trajectory line appears immediately. Ship begins transit. |
| **Right-click station** | Plot intercept route to station. If within docking range, dock on arrival. |
| **Right-click empty space** | Plot direct route to that point. Ship flies there and enters idle state. |
| **Left-click planet/moon** | Select it. Info popup appears on the map near the clicked body. |
| **Left-click station** | Select it. Info popup appears with station summary. |
| **Left-click ship (other)** | Select it. Info popup shows sensor-resolved contact data. |
| **Left-click own ship** | Select it. Info popup shows own route summary. |
| **Left-click empty space** | Deselect. Close any open popup. |
| **Scroll wheel** | Zoom in/out (logarithmic scaling, centered on cursor position). |
| **Click-drag (left button)** | Pan the map. |
| **Double-click body/station** | Center and zoom to that object. |
| **Double-click own ship** | Center and follow own ship (camera tracks ship until manually panned away). |

### Route Preview

When the player right-clicks a destination, the route should appear with minimal delay. The flow:

1. Right-click detected on map.
2. Identify target (planet, station, or space coordinate).
3. Compute intercept (iterative convergence for moving targets, direct for fixed points).
4. Render proposed trajectory line on the map immediately.
5. Ship begins transit. No confirmation dialog for basic navigation — the captain points, the ship goes.

If the ship is already in transit, the right-click triggers a redirect: new Bézier route computed from current position and velocity (see Route Curves document). The old trajectory line fades out as the new one draws.

Future consideration: for expensive routes (low fuel situations), we may want a confirmation step showing fuel cost before committing. Not in first pass.

---

## Info Popups — Map Overlays

When the player left-clicks a map object, a compact info popup appears floating near the clicked position on the map. These are lightweight, transient, and non-modal — clicking elsewhere dismisses them.

### Popup Visual

- Small rectangular panel, ~200-280px wide, variable height based on content.
- Same dark background as the left panel with thin accent-color border.
- Positioned near the clicked object but offset so it doesn't obscure it. Smart positioning to stay within viewport.
- Small connecting line or arrow pointing to the object.
- Subtle fade-in animation (100-150ms).

### Popup Content by Type

**Planet/Moon:**
```
┌──────────────────────┐
│ ◉ MARA               │
│ Rocky Planet          │
│ Orbit: 1.52 AU       │
│ Period: 687d game     │
│ Stations: 2          │
│                      │
│ [More →]             │
└──────────────────────┘
```

**Station:**
```
┌──────────────────────┐
│ ◇ MARA STATION       │
│ Trade Hub             │
│ Faction: Independent  │
│ Services: MKT RFL RPR│
│ Range: 84.2M km       │
│                      │
│ [More →]             │
└──────────────────────┘
```

**Other Ship (sensor-resolved):**
```
┌──────────────────────┐
│ △ CONTACT DTR-7741    │
│ Darter-class          │
│ Bearing: 045°         │
│ Range: 284,000 km     │
│ Vel: 82.4 km/s        │
│ Drive: FLARE active    │
│ Via: IR + Transponder  │
│                      │
│ [More →]             │
└──────────────────────┘
```

**Unidentified Contact (limited sensor data):**
```
┌──────────────────────┐
│ △ CONTACT UNK-003     │
│ Bearing: 187°         │
│ Range: ~520,000 km    │
│ Mass Class: Medium    │
│ Drive: Active         │
│ Via: IR only          │
│                      │
│ [More →]             │
└──────────────────────┘
```

**Own Route (clicked on trajectory line):**
```
┌──────────────────────┐
│ ─ ROUTE TO MARA      │
│ ETA: 38h 12m          │
│ Distance: 78.2M km    │
│ Fuel Cost: 1,240 kg   │
│ Phase: Accelerating    │
│ Arrival Vel: ~0 m/s   │
└──────────────────────┘
```

### [More →] — Detail Modals

The `[More →]` link at the bottom of popups opens a detail modal for objects with deep information. Modals overlay the center of the map with a larger panel (~50-60% of map width, ~70% of map height). The map is dimmed but still visible behind the modal.

**Modal content examples:**

- Planet detail modal: physical characteristics, orbital data, atmosphere, all stations listed with services and prices.
- Station detail modal: full service list, complete market prices for all commodities, available upgrades, available crew for hire.
- Contact detail modal: full sensor data, detection history, trajectory projection.

Modals have a close button (top-right ✕) and close on Escape key. Only one modal can be open at a time.

For first pass, modals open with placeholder content. The structure and layout of the modal is what matters.

---

## Map Rendering — Zoom Levels

The map should feel different at different zoom levels, with information appearing and disappearing to prevent clutter. Define three broad zoom tiers:

### System View (fully zoomed out)

The entire star system is visible. This is the "strategic" view.

- Star at center with subtle glow.
- Planets and moons as small colored dots with name labels.
- Orbital paths as dim thin ellipses.
- Player ship as a small bright icon (chevron/triangle).
- Player route as a bright line (accent color) from ship to destination.
- Player trail as a dimmer line behind the ship.
- Other ships (if detected) as tiny dots, color-coded by contact status (friendly/neutral/unknown/hostile).
- Asteroid fields as a subtle scattering of tiny dots in their orbital band.
- Grid lines very faint or hidden at this level.
- Station icons hidden — too small to matter. They appear when zooming in.

### Regional View (medium zoom)

A section of the system — maybe a quarter to a third visible. Approaching a planet or navigating between nearby bodies.

- Planet sizes slightly exaggerated for visibility.
- Moon orbits visible around planets.
- Station icons appear as small diamonds near their parent body.
- Station name labels appear.
- Ship icons slightly larger, directional heading visible.
- Trajectory curves clearly visible with acceleration/deceleration phase coloring.
- Trail detail increases — individual position samples may become visible as dots along the trail.
- Faint coordinate grid becomes visible.
- Asteroid field individual rocks start resolving (as tiny markers, not realistic shapes).

### Local View (zoomed in close to a body)

Focused on a single planet and its immediate vicinity. Docking approach, station selection, local traffic.

- Planet is a prominent circle (still 2D icon, not rendered as a sphere — this is a tactical display).
- All stations clearly visible with icons, labels, and status indicators.
- Ship icons show heading arrows and possibly transponder labels.
- Orbital rings for stations visible.
- Traffic patterns visible if multiple ships are present.
- Grid is prominent with coordinate labels.
- Info about the body may auto-display (or be readily available).

### Zoom Transition Rules

- Labels and icons should scale or toggle visibility at defined zoom thresholds, not pop in/out abruptly. Fade transitions over a narrow zoom range.
- The player's own ship icon and route line are always visible at every zoom level. They're the anchor.
- The camera defaults to following the player's ship. Panning breaks the follow; double-clicking own ship re-engages it.

---

## Route Visualization

### Active Route (currently being flown)

- Rendered as a Bézier curve from ship's current position to destination.
- **Accent color** (cyan/teal), 2px line weight. The brightest line on the map.
- **Phase indication:** The portion of the route already traveled is drawn in a dimmer shade. The upcoming portion is bright. Alternatively, the line ahead could subtly pulse or glow.
- **Flip point** indicated by a small marker or icon on the route line (a small diamond or hash mark) at the midpoint where the ship flips from acceleration to deceleration.
- **Destination marker** at the end: a small crosshair, ring, or target indicator at the intercept point. For planet destinations, this sits on/near the planet's projected position at arrival time.

### Trail (where the ship has been)

- Drawn behind the ship as a polyline of recent positions.
- Same color family as the route but dimmer and slightly different shade (e.g., route is cyan, trail is a muted blue).
- Trail fades in opacity toward the tail. Most recent positions are visible, oldest are nearly invisible.
- Course changes create visible bends in the trail — each Bézier redirect tells a story.
- Trail length is capped (ring buffer of last N positions). Old trail segments eventually fade out entirely.

### Proposed Route (route preview on redirect — future enhancement)

If we add a confirmation step for route changes, the proposed route would render as a dashed or dotted line in the accent color before the player commits. Not needed for first pass since routes execute immediately on right-click.

---

## Visual Styling — Concrete Rules

### Color Palette

```css
:root {
  /* Backgrounds */
  --bg-space: #0a0e14;         /* Map background — near-black with blue undertone */
  --bg-panel: #0d1117;         /* Left panel, popups, modals */
  --bg-panel-lighter: #131920; /* Active tab content, hover states */
  --bg-header: #0b0f15;        /* Header and status bars */

  /* Primary accent — the signature color */
  --accent: #00d4ff;           /* Cyan/teal — active data, routes, interactive elements */
  --accent-dim: #007a99;       /* Dimmed accent — inactive but present elements */
  --accent-glow: rgba(0, 212, 255, 0.3); /* Glow/shadow effect */

  /* Secondary data */
  --text-primary: #c8d6e0;     /* Primary text and values — light grey, not pure white */
  --text-secondary: #6b7d8d;   /* Labels, inactive text — muted blue-grey */
  --text-dim: #3a4a56;         /* Tertiary info, disabled items */

  /* Status colors */
  --status-nominal: #00cc66;   /* Green — all systems go */
  --status-warning: #ffaa00;   /* Amber — attention needed */
  --status-critical: #ff3344;  /* Red — danger */
  --status-offline: #4a4a4a;   /* Grey — offline/disabled */

  /* Borders */
  --border: #1a2633;           /* Panel dividers, subtle borders */
  --border-accent: rgba(0, 212, 255, 0.2); /* Accent-tinted borders */
}
```

### Typography

```css
/* Numeric data — MUST be monospace for column alignment */
.value {
  font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace;
  font-size: 12px;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

/* Labels and headers */
.label {
  font-family: 'Inter', 'Barlow Condensed', 'IBM Plex Sans Condensed', sans-serif;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

/* Tab labels */
.tab {
  font-family: 'Inter', 'Barlow Condensed', sans-serif;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Important values (delta-v, fuel, ETA) */
.value-important {
  font-size: 14px;
  color: var(--accent);
}
```

Font sizes are deliberately small. This is a dense display. If a player finds it hard to read, they zoom in. We don't compromise density for default readability.

### Borders and Panels

```css
.panel {
  background: var(--bg-panel);
  border: 1px solid var(--border);
}

.panel-active {
  border-color: var(--border-accent);
}

/* Subtle inner separator between subsections */
.divider {
  border-top: 1px solid var(--border);
  margin: 8px 0;
}
```

No rounded corners. No drop shadows (except glow on active elements). Everything is rectangular and precise.

### Glow Effects

```css
/* Active ship icon */
.ship-player {
  filter: drop-shadow(0 0 4px var(--accent-glow));
}

/* Active status indicator */
.status-dot.nominal {
  box-shadow: 0 0 4px var(--status-nominal);
}

/* Active route line — PixiJS equivalent */
/* Apply a subtle glow via a wider, more transparent line drawn behind the main line */
```

Glow is the only "flashy" effect in the interface. Use it sparingly — only on the player's ship, active route, and status alerts. Everything else is flat.

### Iconography

- **Ship (own):** small filled chevron/triangle pointing in heading direction. Accent color.
- **Ship (other, identified):** small outlined triangle. Color based on relation (neutral=grey, friendly=green, hostile=red).
- **Ship (other, unidentified):** small diamond outline. Amber color.
- **Planet:** filled circle. Color specific to each planet (muted earth tones, gas giant bands not needed — just a distinct color per body).
- **Moon:** smaller filled circle in a slightly different shade than parent planet.
- **Star:** filled circle with a subtle radial glow. Warm yellow-white.
- **Station:** small filled diamond. Accent color when your station, grey otherwise.
- **Asteroid:** tiny dot. Dim grey.
- **Stale contact:** same icon as when detected but dashed outline, dimmed, with growing uncertainty ring.

All icons are simple geometric shapes. No detailed sprites or illustrations on the map. This is a tactical display.

---

## Responsive Considerations

This is a desktop-first game. Minimum supported resolution: 1280×720. Target design resolution: 1920×1080.

At smaller resolutions, the left panel may need to collapse to an icon bar that expands on click. The map should never be smaller than ~60% of viewport width. The status bar content may need to wrap to two lines or use abbreviated labels.

Mobile is not a target for first pass. If we go there eventually, it's a different layout entirely — probably tab-based with the map as the default view and panels as full-screen overlays.

---

## Implementation Notes for Coding Agent

1. **React for all UI panels and HUDs. PixiJS for the map only.** The left panel, corner HUDs, popups, and modals are all React components. The PixiJS canvas handles the star system rendering. They communicate via shared state (React context or a state store).

2. **Tab navigation is simple state-based tab switching.** No page reloads. No URL changes. Just mounting/unmounting panel content components based on active tab and sub-tab state.

3. **Build the tab skeleton first.** All four primary tabs clickable, all sub-tabs reachable via navigation. Breadcrumb working. Every panel renders a placeholder that says what will go there. This validates the navigation before any real content is wired up.

4. **Left panel is a React component that slides in/out.** CSS transition on transform/width. Semi-transparent background matching existing HUD style. Closes on Escape, close button, or clicking the map. Opens via toggle button at the left edge or hotkey.

5. **Corner HUDs are independent positioned React components.** They read from game state and render independently. They do not move or resize when the left panel opens. Match the existing prototype's styling exactly — it's already correct.

6. **Popups are React components rendered in a portal above the PixiJS canvas.** They receive a position prop (map coordinates → screen coordinates via camera transform) and content based on the selected object type.

7. **Modals are standard React overlays.** Dark semi-transparent backdrop. Centered content panel. Close on ✕ or Escape. Only one open at a time.

8. **The subsystem tree renderer (from SYS tab) is the generic tree-walker described in the Subsystem Architecture doc.** It receives a SubsystemNode, renders values by metadata, and handles drill-down navigation. Build this as a reusable component — it's used for every subsystem at every depth.

9. **CSS custom properties for theming.** All colors in the palette section should be CSS variables. This lets us adjust the entire visual language from one place. Match the existing prototype's dark navy and cyan as the baseline.

10. **Zoom level thresholds for map object visibility should be defined as constants.** Something like `ZOOM_SHOW_STATIONS = 0.3`, `ZOOM_SHOW_GRID = 0.2`, etc. The map renderer checks current zoom against these thresholds to toggle element visibility.

11. **First pass deliverable:** The player should be able to open the game, see the full-viewport map with floating corner HUDs (matching existing style), toggle the left panel open/closed, click through all tabs and sub-tabs with placeholder content, left-click map objects to see info popups, and close popups by clicking elsewhere. The existing map functionality (planets, routes, ship movement) should continue working unchanged. Nothing else needs to be functional yet.
