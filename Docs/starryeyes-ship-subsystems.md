# StarryEyes — Ship Subsystem Architecture

**Version:** 0.2 — Design Specification (Updated for Nav Computer model)
**Author:** Grimfox Games
**Date:** March 2026

---

## Design Philosophy

### The Competent Ship

A StarryEyes ship is a well-engineered machine that runs itself. Every system has automation that handles startup sequences, thermal balancing, power distribution, and fuel management without player input. The player is the captain, not the engineer. They say "go" and the ship goes.

But the automation is transparent. Every decision the control system makes is visible in the sub-menus. Every automated parameter has a manual override. The ship will never stop you from doing something suboptimal — it will faithfully simulate the consequences and let you learn.

### Core Principles

1. **Zero required micromanagement.** A player who never opens a sub-menu can fly, trade, and thrive. All subsystems auto-manage within safe operating envelopes.

2. **Total transparency.** Every automated decision is visible. Every value the simulation computes is displayed somewhere in the UI tree. Nothing is hidden.

3. **Overrides without guardrails.** Any controlled parameter can be switched to manual. The ship doesn't warn you, doesn't confirm, doesn't judge. It just does what you say and shows you the result. Players learn by experimenting, not by reading tooltips.

4. **No labeling of emergent behavior.** There is no "stealth mode" button. There is a reactor output target, a radiator deployment setting, and a drive throttle. Turning them all down makes you quiet. The game never tells you this. Players discover it, share it, wiki it.

5. **Depth through structure, not complexity.** Individual values and relationships are simple. A fusion reactor has a power output, a fuel consumption rate, and a heat generation rate. The depth comes from many simple systems interconnected — not from any single system being complicated.

6. **Ship-agnostic rendering.** The UI does not know what a FLARE drive is. It knows how to render a subsystem tree with values and metadata. A new ship type requires zero UI code — only simulation definitions.

### Navigation Model — Captain, Not Pilot

The player does not fly the ship. The player commands the ship. Right-clicking a destination on the map tells the nav computer where to go. The nav computer computes an intercept route (accounting for the target's orbital motion), calculates fuel cost and ETA, and flies the ship there automatically — accelerating for the first half, flipping at the midpoint, and decelerating to arrive at near-zero velocity.

The player never sets heading or throttle directly. They set a destination and the ship handles execution. This elevates the player's role from pilot to captain — the interesting decisions are *where* to go and *when*, not how to aim. See the companion document **StarryEyes — Navigation Refactor** for the full route computation model.

### When Subsystems Matter — Situational Depth

During routine transits, subsystems run on autopilot and the player can ignore them entirely. The depth comes alive in specific situations:

- **Pre-departure planning.** Before committing to a route, an experienced player might adjust reaction mass ratio to optimize the fuel/time/signature tradeoff for this particular trip. Running lean through a dangerous sector. Running rich when speed matters more than fuel.
- **Encounters.** A contact appears on sensors during transit. Suddenly the sensor panel matters — what can you see, what can they see, should you go passive? The drive tuning matters — can you dim your signature? Thermal management matters — how hot are you running?
- **Damage and degradation.** A subsystem takes damage or overheats. The automation adjusts, but maybe not optimally for your situation. Manual overrides become relevant when the ship's defaults don't match your priorities.
- **Resource scarcity.** Running low on fuel changes the delta-v calculus. Running low on reactor fuel changes the power budget. Scarcity makes every subsystem value suddenly important.
- **Exploration.** Operating at the margins — pushing into deep space, running dark to avoid detection, coasting through an unfamiliar sector on minimal power. The subsystems become your survival dashboard.

A new player never needs to open a sub-menu. An experienced player opens them when the situation demands it. The depth is always there; it just waits until it's relevant.

---

## Data Architecture

### The Subsystem Tree

A ship is a tree of named subsystem nodes. Each node can contain child subsystems and/or a flat set of tagged values. The UI walks this tree and renders what it finds. The simulation updates the values. The tree structure is the only contract between simulation and UI.

```typescript
interface SubsystemNode {
  id: string;                          // Unique path key: "reactor.core.coils_toroidal"
  name: string;                        // Display name: "Toroidal Confinement Coils"
  category: SubsystemCategory;         // For icon/color theming in UI
  children: SubsystemNode[];           // Child subsystems (deeper menus)
  values: Record<string, SystemValue>; // This node's values
  status: SubsystemStatus;             // OFFLINE | STARTING | NOMINAL | WARNING | CRITICAL | SHUTDOWN
  schematic?: string;                  // Optional: ID of a line-diagram SVG for this subsystem
}

type SubsystemCategory =
  | 'propulsion'
  | 'power'
  | 'thermal'
  | 'sensors'
  | 'cargo'
  | 'propellant'
  | 'structural'
  | 'comms'
  | 'navigation'
  | 'life_support';
```

### System Values

Every value in the tree carries metadata that tells the UI how to render it and tells the simulation how it behaves.

```typescript
interface SystemValue {
  value: number | boolean | string;
  unit?: string;                     // "K", "MW", "kg/s", "m/s²", "T", "%"
  precision?: number;                // Decimal places for display (default: 1)
  min?: number;                      // Minimum possible value (for gauges/sliders)
  max?: number;                      // Maximum possible value
  warnThreshold?: number;            // UI turns yellow above this
  criticalThreshold?: number;        // UI turns red above this
  warnBelow?: number;                // UI turns yellow BELOW this (for values like fuel)
  criticalBelow?: number;            // UI turns red BELOW this
  control: ValueControl;             // How this value is managed
  autoValue?: number;                // What automation WOULD set (shown as ghost in manual mode)
  displayHint?: DisplayHint;         // UI rendering suggestion
  tags?: string[];                   // Arbitrary tags for filtering/grouping
}

type ValueControl =
  | 'simulated'    // Pure physics output. Read-only. (e.g., core temperature)
  | 'controlled'   // Automation manages it. Player can override to manual. (e.g., fuel injection rate)
  | 'player';      // Always player-set. (e.g., target power output, throttle)

type DisplayHint =
  | 'number'       // Plain numeric readout (default)
  | 'gauge'        // Horizontal or radial gauge with min/max
  | 'bar'          // Fill bar (good for tank levels, percentages)
  | 'toggle'       // On/off switch (for boolean values)
  | 'slider'       // Continuous adjustment (for controlled/player values)
  | 'graph'        // Small sparkline of recent history
  | 'vector'       // 2D direction indicator
  | 'enum';        // Discrete named states (e.g., "AUTO" | "MANUAL")
```

### The Control Layer

Every subsystem node with `controlled` values has an implicit automation controller. The controller reads `player`-set targets (like `target_output`) and adjusts `controlled` values each tick to meet those targets within the physics constraints.

```typescript
interface ControlState {
  mode: 'AUTO' | 'MANUAL';          // Per-subsystem, not global
  overrides: Record<string, number>; // Manual override values (only active in MANUAL)
}
```

When `mode` is AUTO, the simulation manages `controlled` values and the UI shows them as live readouts. When `mode` is MANUAL, the player's override values are used instead, and each value shows a faint "ghost" indicator of what AUTO would choose. This lets the player see how far they've deviated from nominal.

Mode can be set per-subsystem independently. You might run your reactor in AUTO but your radiators in MANUAL.

### Ship Definition

A ship type is defined as a template that populates the subsystem tree. Different ship classes have different trees — a starter trader has a shallow tree with few subsystems, an advanced explorer has a deep tree with many. The simulation code and UI code are identical; only the data changes.

```typescript
interface ShipDefinition {
  id: string;                        // "freighter_light_mk1"
  name: string;                      // "Darter-class Light Freighter"
  description: string;
  subsystems: SubsystemNode;         // The full tree template
  mass: {
    hull: number;                    // Base mass in kg (empty, no fuel, no cargo)
    maxCargo: number;                // Maximum cargo capacity in kg
    maxPropellant: number;           // Maximum propellant capacity in kg
  };
  signature: SignatureProfile;       // Base detectability values (see Detection section)
}
```

---

## The Subsystem Tree — Starter Ship

The **Darter-class Light Freighter** is the starter vessel. Its tree is intentionally shallow — a new player sees manageable information. All the patterns are present for deeper ships, but the tree has few branches.

```
ship: "Darter-class Light Freighter"
│
├── navigation/                                       [Nav Computer]
│   ├── status: IDLE                                 (simulated: IDLE | PLOTTING | IN_TRANSIT | IN_ORBIT | DOCKED)
│   ├── current_position: [x, y] m                   (simulated)
│   ├── current_velocity: [vx, vy] m/s               (simulated, derived from route at current time)
│   ├── speed: 0 m/s                                 (simulated, derived from velocity)
│   ├── destination: —                                (player, set via map right-click)
│   ├── destination_eta: —                            (simulated, derived from route)
│   ├── route_fuel_cost: 0 kg                         (simulated, total fuel for current route)
│   ├── delta_v_remaining: 0 m/s                      (simulated, derived from propellant + mass)
│   ├── trips_remaining_estimate: 0                   (simulated, rough count of average-length trips fuel allows)
│   │
│   └── [sub-menu] route_details/
│       ├── departure_body: —                         (simulated)
│       ├── arrival_body: —                           (simulated)
│       ├── transit_distance: 0 km                    (simulated)
│       ├── transit_time: 0 s                         (simulated)
│       ├── time_elapsed: 0 s                         (simulated)
│       ├── acceleration_phase: —                     (simulated: ACCELERATING | COASTING | DECELERATING | NONE)
│       ├── flip_point_eta: —                         (simulated, time until midpoint flip)
│       └── arrival_velocity: 0 m/s                   (simulated, should approach 0 on arrival)
│
├── drive/                                            [FLARE Drive, Model: Kessler-Lin F2]
│   ├── status: OFFLINE                              (simulated: OFFLINE | STANDBY | ACTIVE | OVERHEAT)
│   ├── throttle: 0.0                                (controlled, nav computer manages during transit)
│   ├── thrust_output: 0 kN                          (simulated)
│   ├── max_thrust: 180 kN                           (simulated, varies with reaction_mass_ratio)
│   ├── current_acceleration: 0 m/s²                 (simulated, thrust / total_mass)
│   ├── fuel_flow_rate: 0 kg/s                       (simulated)
│   ├── exhaust_velocity: 31,000 m/s                 (simulated, varies with reaction_mass_ratio)
│   ├── specific_impulse: 3,160 s                    (simulated, derived)
│   ├── drive_temperature: 280 K                     (simulated)
│   ├── heat_generation: 0 MW                        (simulated)
│   │
│   └── [sub-menu] tuning/
│       ├── reaction_mass_ratio: 0.72                (controlled → overridable)
│       │   Controls the ratio of propellant to fusion product in exhaust.
│       │   Lower = more efficient (higher Isp, less thrust, dimmer signature)
│       │   Higher = more thrust (lower Isp, burns fuel faster, brighter signature)
│       │   Set BEFORE departure to affect route fuel cost, transit time, and drive signature.
│       ├── ignition_sequence: [command]              (player, triggers startup)
│       ├── shutdown_sequence: [command]              (player, triggers shutdown)
│       └── magnetic_nozzle_ratio: 0.85              (controlled → overridable)
│           Affects exhaust collimation. Higher = tighter exhaust cone.
│
├── reactor/                                          [Fusion Reactor, Model: Helios Compact 200]
│   ├── status: OFFLINE                              (simulated)
│   ├── power_output: 0 MW                           (simulated)
│   ├── target_output: 200 MW                        (player)
│   ├── load: 0.0                                    (simulated, total_draw / power_output)
│   ├── core_temperature: 280 K                      (simulated)
│   ├── fuel_remaining: 1.0                          (simulated, fraction)
│   ├── heat_generation: 0 MW                        (simulated)
│   │
│   └── [sub-menu] core/
│       ├── control_mode: AUTO                       (player, AUTO | MANUAL)
│       ├── plasma_temperature: 0 K                  (simulated)
│       ├── plasma_density: 0 /m³                    (simulated)
│       ├── confinement_field: 0 T                   (controlled → overridable)
│       ├── fuel_injection_rate: 0 mg/s              (controlled → overridable)
│       ├── core_pressure: 0 MPa                     (simulated)
│       └── neutron_flux: 0                          (simulated)
│           Meaningless to most players. Fascinating to the ones who care.
│
├── thermal/                                          [Thermal Management System]
│   ├── status: NOMINAL                              (simulated)
│   ├── total_heat_load: 0 MW                        (simulated, sum of all heat sources)
│   ├── total_rejection: 0 MW                        (simulated, radiator output)
│   ├── net_heat: 0 MW                               (simulated, load - rejection)
│   ├── hull_temperature: 280 K                      (simulated)
│   │
│   ├── radiators/
│   │   ├── deployed: true                           (controlled → overridable, boolean)
│   │   ├── deployment_fraction: 1.0                 (controlled → overridable, 0.0–1.0)
│   │   ├── surface_temperature: 280 K               (simulated)
│   │   ├── rejection_rate: 0 MW                     (simulated)
│   │   └── area: 120 m²                             (simulated, fixed for this ship)
│   │
│   └── heat_sinks/
│       ├── capacity: 2,000 MJ                       (simulated, fixed)
│       ├── stored: 0 MJ                             (simulated)
│       ├── fill_fraction: 0.0                       (simulated, derived)
│       └── time_to_full: ∞                          (simulated, derived from net_heat)
│           Shows "∞" when net_heat ≤ 0. Otherwise, seconds until heat sinks are full.
│           When heat sinks reach capacity, hull temperature rises. Systems degrade.
│
├── sensors/                                          [Sensor Suite]
│   ├── mode: PASSIVE                                (player, PASSIVE | ACTIVE)
│   │
│   ├── passive/
│   │   ├── visual/
│   │   │   ├── enabled: true                        (player, toggle)
│   │   │   ├── range: 80,000 km                     (simulated, fixed for this sensor)
│   │   │   ├── resolution: low                      (simulated)
│   │   │   └── power_draw: 0.5 MW                   (simulated)
│   │   └── infrared/
│   │       ├── enabled: true                        (player, toggle)
│   │       ├── range: 60,000 km                     (simulated, fixed)
│   │       ├── resolution: medium                   (simulated)
│   │       └── power_draw: 1.2 MW                   (simulated)
│   │
│   └── active/
│       ├── radar/
│       │   ├── enabled: false                       (player, toggle)
│       │   ├── range: 100,000 km                    (simulated, fixed)
│       │   ├── resolution: high                     (simulated)
│       │   ├── power_draw: 15 MW                    (simulated)
│       │   └── gives_away_position: true            (informational flag)
│       └── lidar/
│           ├── enabled: false                       (player, toggle)
│           ├── range: 40,000 km                     (simulated, fixed)
│           ├── resolution: very_high                (simulated)
│           ├── power_draw: 8 MW                     (simulated)
│           └── gives_away_position: true            (informational flag)
│
├── propellant/                                       [Propellant Storage]
│   ├── total_capacity: 8,000 kg                     (simulated, fixed)
│   ├── total_remaining: 8,000 kg                    (simulated)
│   ├── fraction: 1.0                                (simulated, derived)
│   │
│   └── tank_main/
│       ├── capacity: 8,000 kg                       (simulated, fixed)
│       ├── level: 8,000 kg                          (simulated)
│       ├── type: hydrogen                           (fixed)
│       └── pressure: 35 MPa                         (simulated)
│
├── cargo/                                            [Cargo Storage]
│   ├── total_capacity: 40,000 kg                    (simulated, fixed)
│   ├── total_used: 0 kg                             (simulated)
│   ├── fraction: 0.0                                (simulated, derived)
│   │
│   └── hold_main/
│       ├── capacity: 40,000 kg                      (simulated, fixed)
│       ├── used: 0 kg                               (simulated)
│       └── manifest: []                             (simulated, list of commodity + quantity)
│
├── comms/                                            [Communications]
│   ├── transponder: true                            (player, toggle — broadcasts your ID)
│   ├── transponder_id: "DTR-7741"                   (fixed)
│   └── antenna/
│       ├── power_draw: 0.2 MW                       (simulated)
│       └── range: 120,000 km                        (simulated, fixed)
│
└── structural/                                       [Hull and Structure]
    ├── hull_integrity: 1.0                          (simulated, fraction)
    ├── mass_total: 22,000 kg                        (simulated, hull + fuel + cargo)
    ├── mass_hull: 14,000 kg                         (simulated, fixed dry mass)
    ├── mass_propellant: 8,000 kg                    (simulated, current fuel)
    └── mass_cargo: 0 kg                             (simulated, current cargo)
```

---

## Advanced Ship Example — Additional Depth

For contrast, here is what additional subsystem branches look like on a larger vessel. The UI and data architecture are identical; there's just more tree.

```
drive_main/                          [FLARE Drive, heavy variant]
│   └── tuning/
│       ├── reaction_mass_ratio
│       ├── magnetic_nozzle_ratio
│       ├── plasma_injection_timing    (controlled → overridable)
│       └── thrust_vectoring/          [sub-sub-menu]
│           ├── gimbal_angle
│           └── response_rate

drive_aux/                           [Chemical RCS Thrusters]
│   ├── fuel_type: hydrazine
│   └── ... smaller, simpler tree

reactor_primary/                     [Large Fusion Reactor]
│   └── core/
│       ├── ... deeper than starter
│       ├── confinement_coils/
│       │   ├── toroidal/
│       │   │   ├── current
│       │   │   ├── temperature
│       │   │   └── power_draw
│       │   └── poloidal/
│       │       └── ...
│       ├── coolant_loop/
│       │   ├── primary/
│       │   │   ├── flow_rate
│       │   │   ├── inlet_temp
│       │   │   └── outlet_temp
│       │   └── secondary/
│       │       └── ...
│       └── plasma_diagnostics/
│           ├── instability_index
│           ├── energy_balance
│           └── confinement_time

reactor_backup/                      [RTG — tiny tree, almost no values]

thermal/
│   ├── radiator_array_port/
│   ├── radiator_array_starboard/
│   ├── heat_sinks_primary/
│   └── heat_sinks_emergency/

sensors/
│   ├── passive/
│   │   ├── visual_array/            [wider FOV, better resolution]
│   │   ├── infrared_array/
│   │   └── gravimetric/             [detects large masses — planets, loaded ships]
│   └── active/
│       ├── radar_primary/
│       ├── radar_secondary/
│       ├── lidar/
│       └── deep_scanner/            [very high power, very long range, very loud]

cargo/
│   ├── hold_1/
│   ├── hold_2/
│   ├── hold_refrigerated/           [special commodities, extra power draw]
│   └── hold_shielded/              [contraband doesn't show on scans]

countermeasures/                     [future — chaff, ECM, decoys]
```

The point: same tree walker, same value renderer, same metadata. More nodes, more depth, more knobs.

---

## Detection and Signature — Subsystem Relationships

The full detection, sensor, and stealth model is specified in the companion document **StarryEyes — Sensors, Detection & Stealth**. This section covers only how the sensor and signature systems relate to other ship subsystems.

### Signature as Derived State

Every ship has a signature profile computed each tick from actual subsystem state. This is not a separate system — it's an output of the subsystems already described above. The key couplings:

- **Drive → Signature.** Throttle level and reaction mass ratio directly determine drive signature brightness. A ship at full burn is a beacon. Engines off means drive signature zero.
- **Reactor → Signature.** Reactor power output drives thermal signature. Higher output = more heat = brighter thermal.
- **Thermal → Signature.** Radiator deployment affects both thermal rejection (good) and cross-section/IR visibility (bad). Retracting radiators reduces visible cross-section but causes internal heat buildup. A real tradeoff with cascading consequences.
- **Sensors → Signature.** Active sensors (radar, lidar) require significant power draw from the reactor AND spike the ship's electromagnetic signature. Using active sensors makes you visible to every passive EM detector in the system.
- **Comms → Signature.** Transponder broadcast contributes to EM signature. Transponder also enables radar interrogation at long range (see Sensors doc).

### Power Budget Impact

Sensors are significant power consumers. Running a full active sensor suite (radar + lidar) alongside a FLARE drive at high throttle can stress the reactor's power budget. The automation handles load-shedding if power is exceeded, but an alert player might choose to cycle sensors rather than run everything simultaneously.

### No "Stealth Mode"

There is no stealth button or mode toggle. Reduced detectability emerges from shutting down or reducing systems that contribute to signature — drive off, reactor low, radiators retracted, active sensors off, transponder off. Every one of those choices has operational consequences handled by the subsystems described in this document. The Sensors doc defines how those signature values translate into what other ships can actually detect.

---

## Simulation Dependencies — How Systems Feed Systems

This is the core of the "systems feeding systems" design. Each arrow represents a value from one subsystem influencing a value in another. The simulation evaluates these dependencies each tick.

```
REACTOR
  │
  ├──→ power_output ──→ Available power budget
  │                      (all powered subsystems draw from this)
  │
  ├──→ heat_generation ──→ THERMAL total_heat_load
  │
  └──→ fuel_consumption ──→ reactor fuel depletion

DRIVE
  │
  ├── requires: reactor power_output ≥ drive power_draw
  │   (drive won't ignite if reactor can't supply it)
  │
  ├── throttle managed by NAV COMPUTER during transit
  │   (nav computer sets throttle to execute route; player adjusts indirectly
  │    via reaction_mass_ratio which affects thrust/efficiency/signature tradeoff)
  │
  ├──→ thrust_output ──→ NAVIGATION acceleration (thrust / total_mass)
  │                      (determines transit times and fuel costs)
  │
  ├──→ fuel_flow_rate ──→ PROPELLANT tank depletion
  │
  ├──→ heat_generation ──→ THERMAL total_heat_load
  │
  └──→ throttle + reaction_mass_ratio ──→ SIGNATURE drive + thermal

THERMAL
  │
  ├── receives: heat from REACTOR + DRIVE + SENSORS
  │
  ├──→ radiator rejection_rate ──→ net_heat calculation
  │    (depends on radiator deployment + surface area + temperature differential)
  │
  ├──→ net_heat > 0 ──→ heat_sinks stored increases
  │
  ├──→ heat_sinks full ──→ hull_temperature rises
  │
  ├──→ hull_temperature > warn ──→ subsystem degradation begins
  │
  └──→ radiator deployment ──→ SIGNATURE cross_section

SENSORS
  │
  ├── requires: reactor power for each enabled sensor
  │
  ├──→ active sensors enabled ──→ SIGNATURE electromagnetic
  │
  └──→ sensor stats + target signature ──→ detection results (right panel)

PROPELLANT
  │
  ├── receives: consumption from DRIVE
  │
  ├──→ remaining propellant ──→ NAVIGATION delta_v_remaining + trips_remaining_estimate
  │
  └──→ remaining propellant ──→ STRUCTURAL mass_propellant ──→ total_mass
  │                                                            ──→ acceleration

CARGO
  │
  └──→ cargo mass ──→ STRUCTURAL mass_cargo ──→ total_mass ──→ acceleration
       (a loaded ship is slower than an empty one — always, inherently)

STRUCTURAL
  │
  └──→ mass_total (hull + propellant + cargo) ──→ DRIVE current_acceleration
       (the fundamental coupling: everything that adds mass costs you agility)
```

### The Mass Loop

The single most important emergent relationship: **mass determines acceleration.** Everything that adds mass — fuel, cargo, a bigger reactor, more armor — makes the ship slower to accelerate. A trader hauling a full hold of rare minerals is sluggish. After selling, they're nimble. This is never explained; it's just physics. Players feel it before they understand it.

```
current_acceleration = drive.thrust_output / structural.mass_total
```

### The Heat Loop

The second key loop: **activity generates heat, heat must be managed.** Running the reactor hot for more power generates heat. Burning the drive generates heat. Running active sensors generates heat (slightly). Heat is rejected by radiators. If heat input exceeds rejection, heat sinks absorb the excess. When heat sinks are full, hull temperature rises and systems begin degrading.

This creates natural operational limits. You can run everything at maximum... for a while. Then thermal reality catches up. Experienced players learn to manage thermal budgets. New players never encounter thermal issues because they're not pushing hard enough to generate them.

### The Power Budget

The reactor provides a power output. All active subsystems draw from it. If total draw exceeds output, systems brown out (automation handles load-shedding in priority order, or the player can manage it manually). A ship trying to run a FLARE drive at full burn, active radar, and all sensors simultaneously might exceed its reactor capacity. This is only a problem on undersized reactors or ships pushing beyond their design envelope.

Power priority order (automated, overridable):
1. Life support (always)
2. Navigation computer (always)
3. Drive (highest gameplay priority)
4. Thermal management (critical for survival)
5. Sensors (degraded gracefully)
6. Comms
7. Cargo systems

---

## Startup Sequence

When a player issues a "start reactor" command, the following sequence plays out automatically. The player watches values change in real time across the subsystem panels. Each step takes a brief but visible amount of real time.

1. **Magnetic confinement energizes.** Confinement field value rises from 0 to operating level. Coil temperatures rise slightly. Power drawn from capacitors/batteries (pre-reactor bootstrap).

2. **Fuel injection begins.** Fuel injection rate ramps from 0 to initial value. Plasma density begins rising.

3. **Plasma ignition.** Core temperature jumps. Plasma temperature rises rapidly. Neutron flux appears. Status changes from STARTING to NOMINAL.

4. **Power output ramps.** Output climbs from 0 toward target. Load percentage fluctuates as automation balances. Heat generation begins.

5. **Thermal systems respond.** Radiators (if deployed) begin showing rejection rate. Surface temperature rises. Heat loop establishes equilibrium.

6. **Drive available.** Once reactor output is sufficient, drive status changes from OFFLINE to STANDBY. The nav computer can now execute transit routes.

Total sequence: maybe 3–5 real seconds. Every number mentioned above is visible in the subsystem panels and updates smoothly. The schematic diagram animates — flow lines appear, components light up, temperature colors shift from cool blue to warm amber.

Shutdown is the reverse. Drive goes to standby, reactor ramps down, plasma cools, confinement fields decay, systems go dark. Thermal signature drops over the following seconds as residual heat dissipates.

None of this requires player input beyond the initial command. All of it is visible. It's pure spectacle backed by real simulation state.

---

## UI Layout

The map is full-viewport. Ship status is conveyed through semi-transparent floating HUD elements in the corners. The left panel (SYS, CREW, OPS, DOCK tabs) is collapsed by default and expands as a semi-transparent overlay. See the **UI Specification** document for full layout, interaction, and styling details.

```
┌──────────────────────────────────────────────────────────────┐
│ ┌───────────┐                        ┌─────────────────────┐ │
│ │ GAME TIME │                        │ MODE / VEL / DEST   │ │
│ │ WARP      │                        │ ETA / PHASE         │ │
│ └───────────┘                        └─────────────────────┘ │
│                                                              │
│  [≡]            MAP (FULL VIEWPORT)                          │
│                                                              │
│                  PixiJS Canvas                               │
│                                                              │
│ ┌───────────┐                                                │
│ │ FUEL %    │                                                │
│ └───────────┘                                                │
├──────────────────────────────────────────────────────────────┤
Left panel opens as semi-transparent overlay with tab system (SYS, CREW, OPS, DOCK).
Subsystem sections within SYS tab are collapsible. Click into sub-menus for depth.
```

### UI Rendering Rules

1. The UI tree-walker receives a `SubsystemNode` and renders it as a collapsible section.
2. Top-level children of the ship root render as sections in the SYS tab of the left panel.
3. Each section shows its direct values. Child subsystems render as clickable links that open a sub-panel (slide-over or drill-down).
4. Values render according to their `displayHint`. Default is `number`.
5. `controlled` values in AUTO mode show as readouts. In MANUAL mode, they become interactive (sliders, inputs).
6. The `autoValue` ghost indicator appears only when a value is in MANUAL and differs from what AUTO would choose.
7. Values exceeding `warnThreshold` render in amber/yellow. Values exceeding `criticalThreshold` render in red.
8. `warnBelow` and `criticalBelow` work the same way but trigger when the value drops below the threshold (useful for fuel, integrity).
9. Floating corner HUDs are always visible and show critical at-a-glance data: game clock, nav status, fuel. These persist regardless of left panel state.
10. Left-clicking map objects opens info popups as floating overlays. Clicking empty space dismisses them. The [More →] link opens detail modals.

### Visual Language

- **Color palette:** Dark backgrounds (near-black, dark navy). Cyan/teal for primary data. Amber for warnings. Red for critical. Dim grey for inactive/offline systems. White for labels.
- **Typography:** Monospace for numeric values. Condensed sans-serif for labels. Small is fine. Information density over readability — this is a command display, not a website.
- **Schematics:** Each major subsystem can have a simple line-diagram SVG showing its layout. Reactor shows the confinement chamber, coils, coolant paths. Drive shows the nozzle, injection system, magnetic nozzle. These are decorative but tied to real state — flow lines animate when systems are active, components change color with temperature.
- **Transitions:** Values that change smoothly (temperatures, pressures, power output) should animate/lerp in the UI, not snap. This makes startup sequences feel alive.

---

## Implementation Notes for Coding Agent

1. **The simulation module owns the subsystem tree.** It creates the tree from ship definitions, updates values each tick, and exposes the full tree as serializable state. Zero rendering dependencies.

2. **The client receives a serialized tree and renders it.** The renderer is generic — it walks SubsystemNode structures and renders values by metadata. No hardcoded subsystem names in rendering code.

3. **Ship definitions are data files (JSON or TypeScript objects), not code.** Adding a new ship class means adding a new definition file with its subsystem tree template. No new simulation code unless the ship introduces genuinely new physics (rare).

4. **The control layer (AUTO/MANUAL) is part of the simulation, not the UI.** The simulation runs controllers each tick that adjust `controlled` values toward targets. The UI merely toggles `control_mode` and sends override values as commands through the bridge.

5. **Signature computation is a derived pass.** After all subsystems are updated each tick, a final pass computes the ship's current `SignatureProfile` from subsystem state. This is what other ships' sensors evaluate against.

6. **Detection checks are evaluated on demand, not each tick.** When a client requests "what can I see," the server (or client in Phase 1) evaluates sensor stats against all ships' signatures at current ranges. This is cheap and infrequent.

7. **The startup/shutdown sequences are not scripted animations.** They are the real simulation responding to a "start reactor" command. The control layer ramps values in physically plausible order. The UI just renders whatever the values are each frame. If the simulation is correct, the startup looks correct.

8. **Mass coupling is critical to get right early.** `structural.mass_total` must correctly sum hull + propellant + cargo at all times, and `drive.current_acceleration` must derive from thrust / mass_total. This is the relationship players feel most directly.

9. **All of this exists in the `simulation/` module from the Phase 1 technical brief.** The subsystem tree is part of the ship state managed by `system.ts`. The bridge pattern still applies — the client receives serialized SubsystemNode trees through the same interface that will become WebSocket messages. The nav computer route model (see Navigation Refactor doc) means ship positions during transit are deterministic and derived from route math, not physics integration — making the subsystem simulation a parallel concern rather than a tightly coupled one.

10. **Phase 1 implementation: start with navigation + drive + propellant + structural only.** Get the route-based transit working with accurate fuel costs derived from the mass-thrust-fuel loop. The nav computer computes routes, the drive's reaction mass ratio and the ship's total mass determine transit times and fuel consumption. Then layer in reactor, thermal, and sensors as subsequent additions. The tree architecture means these additions don't require refactoring — they're just new branches on an existing tree.

11. **Subsystem simulation tick vs. route evaluation.** The nav computer model means ship position during transit is derived from route math, not integrated. But subsystems still need periodic updates — the reactor generates heat, radiators dissipate it, fuel depletes. These updates can happen at a low frequency (every few game-seconds) during routine transit, with faster updates during encounters or when the player is actively viewing subsystem panels. This is a rendering/simulation optimization, not an architectural concern — the subsystem tree doesn't care how often it's updated.
