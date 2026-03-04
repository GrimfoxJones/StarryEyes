# StarryEyes — Sensors, Detection & Stealth

**Version:** 0.1 — Design Specification
**Author:** Grimfox Games
**Date:** March 2026
**Companion to:** StarryEyes Ship Subsystem Architecture

---

## Design Philosophy

Detection in StarryEyes is **stat-driven, not physically simulated**. We do not model photon propagation, thermal radiation physics, or radar cross-section calculations. Instead, ships have signature profiles derived from their subsystem state, and sensors have detection stats that determine what they can resolve at what range. The math is simple. The emergent gameplay is not.

The core tension: **information costs visibility.** Active sensors give you better data but announce your presence. Passive sensors are silent but limited. Running your ship hot and fast makes you easy to find. Running quiet limits what you can do. Every detection decision is a tradeoff with no correct answer — only the answer that's right for your situation.

### Key Principles

1. **No fog of war toggle.** What you can see is determined entirely by your sensors, the target's signature, and range. The server computes this honestly.

2. **No "stealth mode" button.** Reduced detectability is an emergent consequence of shutting down or reducing systems. Every choice that makes you quieter has operational costs (see Subsystem Architecture doc).

3. **Transponders are the social contract.** Civilian ships are expected to run transponders. Turning yours off is legal in uninhabited systems and practical on the fringe, but in policed space it marks you as suspicious. It's the first decision that teaches players the detection game exists.

4. **Stat-driven, not simulation-driven.** Sensor ranges, detection thresholds, and resolution tiers are tunable game design numbers, not outputs of physics equations. This keeps the system digestible for io-game players while still feeling grounded.

5. **The server is the authority.** The client never computes detection. It receives a contact package from the server and displays it. What you see is what the server says you see.

---

## Signature Profile

Every ship emits a composite signature computed each tick from subsystem state (see Subsystem Architecture doc for the dependency map). The signature is not a single number — it's a profile across multiple channels, each detected by different sensor types.

```typescript
interface SignatureProfile {
  thermal: number;          // 0–100. Heat output: reactor + drive + radiator state.
  drive: number;            // 0–100. FLARE exhaust brightness: throttle + reaction mass ratio.
  electromagnetic: number;  // 0–100. EM emissions: active sensors + comms + transponder.
  crossSection: number;     // 0–100. Physical size + reflectivity: hull class + radiator deployment.
  transponder: TransponderState;  // Special: not a 0–100 value (see Transponder section).
}

interface TransponderState {
  active: boolean;
  shipId: string;           // Registered vessel identifier (e.g., "DTR-7741")
  shipClass: string;        // Registered vessel class (e.g., "Darter-class Light Freighter")
  owner: string;            // Registered owner / affiliation
}
```

### How Signatures Are Derived

These values are computed by the simulation, not set by the player. The player controls subsystems; the signature is a consequence.

**Thermal (0–100)**

Primary contributors: reactor power output, drive heat generation, heat sink saturation. Radiator deployment increases thermal rejection (good for the ship) but also increases IR-visible surface temperature (bad for hiding). A ship with reactor at minimum, drive off, and radiators retracted has very low thermal signature — but is accumulating heat internally, so this state is time-limited.

```
thermal = f(reactor.power_output, drive.heat_generation, thermal.radiator_surface_temp, thermal.heat_sink_fill)
```

The exact function is a weighted sum, tunable for game balance. Not a physics equation.

**Drive (0–100)**

Dominated by FLARE drive operation. Scales with throttle level and reaction mass ratio. A richer reaction mass ratio produces a brighter, more energetic exhaust plume. Drive off = 0. Full throttle at high reaction mass ratio = near 100.

```
drive = f(drive.throttle, drive.reaction_mass_ratio)
```

This is the loudest single signature source. A ship under thrust is visible at enormous range to IR sensors. This is intentional — it creates the fundamental tradeoff between going fast and being seen.

**Electromagnetic (0–100)**

Spikes with active sensor use. Radar is the loudest. LIDAR is moderate. Transponder broadcast adds a baseline. Passive sensors contribute nothing. Comms antenna adds a small amount when transmitting.

```
electromagnetic = f(sensors.radar.enabled, sensors.lidar.enabled, comms.transponder, comms.transmitting)
```

EM signature is what makes active scanning a meaningful decision. Every ship running passive EM detection can detect your radar pulse. You learn about them, but they learn about you.

**Cross-Section (0–100)**

Mostly fixed per ship class (a freighter is bigger than a scout). Modified by radiator deployment — extended radiators increase physical profile. This channel is primarily relevant for radar and lidar returns (active detection), where the sensor is bouncing energy off the target and measuring the return.

```
crossSection = shipClass.baseCrossSection + f(thermal.radiator_deployment)
```

---

## Sensor Types

### Overview

| Sensor | Mode | Detects Via | Gives Away Position | Best For |
|--------|------|-------------|--------------------|----|
| Visual | Passive | Drive signature, cross-section (reflected light) | No | Spotting ships under thrust at medium range |
| Infrared | Passive | Thermal signature, drive signature | No | Detecting hot or thrusting ships at long range |
| Passive EM | Passive | Electromagnetic signature | No | Detecting ships using active sensors, radar, or transponders |
| Radar | Active | Cross-section, transponder interrogation | **Yes** | Long-range detection, transponder interrogation, accurate ranging |
| LIDAR | Active | Cross-section | **Yes** | High-resolution close/medium range data |

### Passive Sensors

Passive sensors receive energy that the target is already emitting or reflecting. They are invisible to use — no one can tell you're watching.

**Visual**

Optical detection. Effective against ships with visible drive plumes or ships reflecting starlight (cross-section dependent, but only at relatively close range). Poor against dark, cold targets. Low power draw.

Primary detection channels: `drive`, `crossSection` (minor, close range only)

**Infrared**

Thermal detection. The workhorse passive sensor. Effective against anything generating heat — running reactors, active drives, hot radiators. This is how you spot a trader crossing the system under thrust from across the entire map. Less effective against cold, shut-down targets.

Primary detection channels: `thermal`, `drive`

**Passive EM**

Listens for electromagnetic emissions. This is how you detect someone else's radar pulse, LIDAR sweep, or transponder broadcast. Critical for the "who's scanning who" meta-game. If someone lights up their radar, every ship with passive EM detection knows roughly where they are and that they're looking.

Primary detection channel: `electromagnetic`

### Active Sensors

Active sensors emit energy and analyze the return. They provide much better data — accurate range, velocity, cross-section measurements — but the emission itself is detectable by other ships' passive EM sensors.

**Radar**

The primary active sensor. Long range, good resolution, accurate ranging. Radar has a unique secondary function: **transponder interrogation.** A radar pulse will trigger any active transponder in range to respond with its identification data. This means radar is not just a detection tool — it's how the system identifies ships at long range.

Primary detection channels: `crossSection`, `transponder` (interrogation)
Emission cost: High `electromagnetic` signature

**LIDAR**

Shorter range than radar but significantly higher resolution. Provides detailed cross-section data that can help identify ship class even without transponder data. Lower EM emission than radar, but still detectable.

Primary detection channel: `crossSection`
Emission cost: Moderate `electromagnetic` signature

---

## Transponder System

The transponder is the most important single element in the detection model because it sits at the intersection of game mechanics and social dynamics.

### How Transponders Work

A transponder is a radio device that responds to radar interrogation with a standardized data packet containing the ship's registered ID, class, and owner. It is the spacefaring equivalent of AIS in maritime shipping or Mode S in aviation.

**Key characteristics:**

- Transponders are **passive-responsive**, not continuously broadcasting. They respond when interrogated by a radar pulse. The ship does emit a low-level carrier signal (contributing to EM signature), but the main data transmission is triggered by interrogation.
- Transponder response range is very long — effectively, if your radar can reach the target, their transponder can respond. This is by design; transponders exist for safety and traffic management.
- Transponder data is **authoritative**. The server guarantees that transponder data is accurate (it comes from the ship's registration, not player input). You cannot set a false transponder ID. What you can do is turn it off entirely.
- When interrogated, the transponder response reveals accurate position, velocity, ship ID, ship class, and registered owner. This is a lot of information — which is why turning it off is so appealing in dangerous space.

### Transponder On/Off Decision

**Transponder ON (default, expected behavior):**
- Any radar in range can interrogate and get your full identification at long range
- You appear on traffic maps and station approach systems
- Other ships know you're a registered trader, not a threat (or at least, not an anonymous one)
- Required in policed systems. Stations may refuse docking to ships with transponders off.

**Transponder OFF:**
- Radar can still detect you via cross-section return, but gets no identification data
- You're "unidentified contact" to everyone. This is suspicious in busy systems and unremarkable in frontier systems
- Protects your identity and cargo information from pirates scanning the spacelanes
- Common practice for experienced traders in fringe systems. Technically a violation in core systems, but enforcement varies.
- Reduces EM signature slightly (no carrier signal)

The transponder toggle is the game's gentlest introduction to the detection system. New players leave it on and never think about it. At some point, a player reads a tip or gets jumped and thinks "wait, they knew what I was carrying because my transponder was on." First lesson learned.

---

## Drive Signature Analysis

A ship's FLARE drive exhaust has characteristics that depend on the drive model and operating parameters — particularly the reaction mass ratio. Different drive models produce different spectral signatures, and the same drive at different settings looks different.

### What IR Sensors Can Determine From Drive Signature

At sufficient resolution (close enough range, good enough sensor), infrared analysis of a drive plume can provide:

- **Estimated thrust class.** Rough categorization: light/medium/heavy. A Darter running at full burn looks different from a heavy freighter at full burn.
- **Drive type identification.** FLARE drives look different from chemical rockets. Different FLARE drive models have subtly different signatures. This narrows down the possible ship classes.
- **Operating parameters hint.** An unusual reaction mass ratio might be detectable as an atypical spectral profile. This doesn't directly reveal the setting, but an experienced player might recognize "that drive is running lean" from the signature data.

### Drive Signature Spoofing

Players can adjust their reaction mass ratio to alter their drive's spectral characteristics. This is the closest thing to "active" signature management beyond simply turning systems on/off.

**What spoofing CAN do:**
- Make your drive signature less recognizable. Instead of clearly reading as "Darter-class FLARE drive," the signature becomes ambiguous. The contact shows as "FLARE drive, class unconfirmed" or similar.
- At extreme settings, make your drive look like a different thrust class (running very lean to look smaller, running very rich to look bigger).

**What spoofing CANNOT do:**
- Make you invisible while thrusting. A drive under power is always detectable on IR. You can obscure *what* you are, not *that* you are.
- Convincingly impersonate a specific other ship. Drive signatures are complex enough that faking a particular vessel's exact profile isn't practical. At best you become "unidentified" rather than "falsely identified."

The practical effect: spoofing turns you from a known quantity into an unknown one. In dangerous space, being unidentified is often better than being identified as a fat trader.

---

## Contact Packages — Server to Client

The server is the sole authority on what each ship can detect. The client never runs detection logic. Instead, the server computes detection results and delivers them as **contact packages** at a fixed interval.

### Update Cycle

Every ~1 second (tunable), the server evaluates each ship's sensor suite against all other entities in the system and builds a contact list. This list is pushed to the client as a single update.

```typescript
interface ContactUpdate {
  gameTime: number;                    // Game time of this evaluation
  contacts: Contact[];                 // All currently detected entities
}

interface Contact {
  contactId: string;                   // Server-assigned tracking ID (stable across updates)
  detectionMethod: DetectionMethod[];  // Which sensors are currently detecting this contact
  confidence: number;                  // 0.0–1.0, composite detection quality
  
  // Always available (if detected at all)
  bearing: number;                     // Bearing from own ship, degrees
  range: number;                       // Distance in meters (accuracy varies by method)
  rangeAccuracy: 'exact' | 'approximate' | 'estimated';
  
  // Available at sufficient resolution
  velocity?: Vec2;                     // Target velocity vector (if resolved)
  massClass?: 'small' | 'medium' | 'large' | 'unknown';
  driveActive?: boolean;               // Is the target under thrust?
  driveType?: string;                  // "FLARE" | "chemical" | "unknown"
  
  // Available via transponder interrogation (radar + transponder active)
  transponder?: TransponderData | null;  // null = transponder off or not interrogated
  
  // Available at high resolution / close range
  shipClass?: string;                  // Identified ship class (if sensors can resolve)
  thermalOutput?: number;              // Estimated thermal signature
  cargoEstimate?: 'empty' | 'light' | 'heavy' | 'full' | 'unknown';
  
  // Drive analysis (IR at sufficient resolution)
  driveAnalysis?: DriveAnalysis | null;
}

type DetectionMethod = 
  | 'visual'
  | 'infrared'  
  | 'passive_em'
  | 'radar_return'       // Cross-section return from radar
  | 'radar_transponder'  // Transponder interrogation response
  | 'lidar';

interface TransponderData {
  shipId: string;                      // "DTR-7741"
  shipClass: string;                   // "Darter-class Light Freighter"
  owner: string;                       // Registered owner name
  position: Vec2;                      // Accurate position from transponder response
  velocity: Vec2;                      // Accurate velocity from transponder response
}

interface DriveAnalysis {
  thrustClass: 'light' | 'medium' | 'heavy' | 'unknown';
  driveModel: string | 'unknown';      // "Kessler-Lin F2" if identified, else "unknown"
  signatureNominal: boolean;           // false if reaction mass ratio appears atypical (spoofing hint)
}
```

### Contact Identification Flow

The data a player receives about a contact depends on which sensors detected it and at what quality. Here's the typical flow as a contact gets closer or sensors improve:

**Long range — transponder interrogation (radar on, target transponder on):**
This is often the first detection. Radar pulse hits the target, transponder responds. Immediately provides ship ID, class, owner, accurate position and velocity. This is the "normal" case in policed space — ships see each other on radar via transponder long before they're close enough for detailed sensor resolution.

If the target's transponder is off, radar still gets a cross-section return (range + bearing + rough mass class) but no identification.

**Long range — IR detection (target under thrust):**
A FLARE drive at full burn is visible on IR across most of the system. Initially just "IR contact, bearing X, estimated range Y." As the contact gets closer or sensor dwell time increases, drive analysis becomes available — thrust class, drive type, signature anomalies.

**Medium range — passive EM detection (target using active sensors):**
If the target is running radar or LIDAR, passive EM picks up their emissions. Gives bearing and rough range. Tells you someone is actively scanning — useful tactical information.

**Medium range — visual detection (target under thrust or reflecting light):**
Visual confirmation of a contact. Corroborates IR or radar data. At close enough range, visual can provide cross-section data for ship class estimation.

**Close range — composite high-resolution:**
Multiple sensors contributing data. Ship class identifiable from cross-section profile. Thermal output measurable. Cargo loading estimable from mass/acceleration characteristics. At this range, you know almost everything about the target regardless of their transponder state.

### Detection Methods and What They Provide

| Data Field | Transponder | IR | Visual | Passive EM | Radar Return | LIDAR |
|---|---|---|---|---|---|---|
| Bearing | Yes | Yes | Yes | Yes | Yes | Yes |
| Range (exact) | Yes | — | — | — | Yes | Yes |
| Range (estimated) | — | Yes | Yes | Yes | — | — |
| Velocity | Yes | Partial | — | — | Yes | Yes |
| Ship ID | Yes | — | — | — | — | — |
| Ship Class | Yes | — | Close range | — | — | Close range |
| Mass Class | — | — | — | — | Yes | Yes |
| Drive Active | — | Yes | Yes | — | — | — |
| Drive Type | — | Yes (analysis) | — | — | — | — |
| Thermal Output | — | Yes | — | — | — | — |
| Cargo Estimate | — | — | — | — | Close range | Close range |
| "Is Scanning" | — | — | — | Yes | — | — |

### Multiple Sensor Correlation

When multiple sensors detect the same contact, the server merges their data into a single contact entry with the best available data from each source. The `detectionMethod` array lists all contributing sensors. The `confidence` value increases with more corroborating sensors.

A contact detected on IR only has lower confidence than one confirmed on IR + radar + visual. The confidence value is primarily cosmetic (displayed to the player) but could influence gameplay in the future (e.g., auto-targeting requiring minimum confidence).

---

## Contact History and Stale Contacts

The client maintains a local contact history. When a contact drops out of the server's contact update (no longer detected), the client does not immediately remove it from the display. Instead, it transitions to a **stale contact** state.

### Stale Contact Behavior

```typescript
interface StaleContact {
  lastKnown: Contact;                  // Last received server data
  lastUpdateTime: number;              // Game time of last server update
  age: number;                         // Game-seconds since last update
  projectedPosition: Vec2;             // Dead-reckoned from last known velocity
  reliability: 'recent' | 'aging' | 'stale' | 'expired';
}
```

**Reliability tiers (game-time since last update):**

| Tier | Age | Display | Behavior |
|---|---|---|---|
| Recent | < 30s | Full brightness, "(last update Xs ago)" | Projected position shown with uncertainty ring |
| Aging | 30s – 2min | Dimmed, amber tint | Uncertainty ring grows. Position increasingly unreliable. |
| Stale | 2min – 10min | Very dim, grey tint, dashed icon | Large uncertainty ring. "Last known" label prominent. |
| Expired | > 10min | Removed from display | Moved to contact log (accessible but not rendered on map) |

The **projected position** is a simple dead-reckoning extrapolation: last known position + (last known velocity × time since last update). If the contact was under thrust when lost, the projection is flagged as low confidence (they could have changed course). If coasting, the projection is more reliable.

The **uncertainty ring** is a circle around the projected position that grows over time, representing the volume of space the contact could plausibly be in. It grows faster if the contact was under thrust when lost (more possible course changes) and slower if they were coasting.

### Client-Side Implementation

Contact history is entirely client-side. The server sends only current detections. The client is responsible for:

1. Maintaining a contact list with stable IDs across updates
2. Detecting when a previously-tracked contact is absent from the latest update
3. Transitioning absent contacts to stale state with dead-reckoning
4. Managing aging, reliability tiers, and eventual expiration
5. Rendering stale contacts distinctly from active contacts
6. Storing a scrollable contact log of all contacts seen this session

This keeps the server's job simple (evaluate sensors, send results) and gives the client a rich historical display. The contact log gives players a sense of traffic patterns — "I've seen six ships cross through this area in the last hour, all headed rimward."

---

## EMCON — Emission Control

EMCON is not a game mechanic or a mode. It's a player concept — a way of thinking about managing your ship's emissions. The game never uses the word. But players will.

The spectrum of emission control:

**EMCON 0 — Full Active (Default)**
Everything on. Transponder broadcasting. Radar scanning. All sensors active. Drive at whatever throttle you want. Maximum information, maximum visibility. This is how a new player flies. It's fine in safe space.

**EMCON 1 — Selective**
Transponder on, but active sensors off. Relying on passive sensors only. You're still visible via transponder interrogation, but you're not painting the whole system with radar pulses. Reduces EM signature. Common for traders who want to mind their own business.

**EMCON 2 — Low Observable**
Transponder off. Active sensors off. Passive only. Drive at reduced throttle or off. You're trying not to be noticed. Your remaining signature is thermal (reactor) and whatever drive output you're using. Common for traders in dangerous space, especially on approach to an unfamiliar system.

**EMCON 3 — Running Dark**
Everything off or minimum. Transponder off. Drive off (coasting). Reactor at bare minimum. Radiators retracted (heat building internally). Passive sensors only, maybe reduced gain. You are a cold rock drifting through space. You can see very little and nobody can see you unless they get very close or you drift into their active sensor sweep. Time-limited by heat buildup. This is a deliberate, planned state — you coast into it on a pre-calculated trajectory and hope nobody's in your path.

None of these are game states or buttons. They're patterns of subsystem configuration that players will name, discuss, and refine. The wiki will have an EMCON page within a week of launch.

---

## Detection Ranges — Baseline Tuning

These are starting-point numbers for game balance. All tunable. The goal is that a system feels large enough that careful ships can avoid detection, but small enough that busy spacelanes have real traffic and encounters.

### Approximate Detection Ranges for a "Standard" Ship

(Darter-class, normal operating state, signature values around 50-70)

| Sensor | Target State | Approx. Range |
|---|---|---|
| Radar (transponder interrogation) | Transponder ON | ~system-wide (100,000 km) |
| Radar (cross-section return) | Any | 40,000 – 60,000 km |
| IR | Full thrust | 60,000 – 80,000 km |
| IR | Reactor only (no drive) | 10,000 – 20,000 km |
| IR | Running dark | < 2,000 km |
| Visual | Full thrust (drive plume) | 30,000 – 50,000 km |
| Visual | Coasting (reflected light) | 5,000 – 15,000 km |
| Passive EM | Radar emission | 80,000 – 100,000 km |
| Passive EM | LIDAR emission | 40,000 – 60,000 km |
| Passive EM | Transponder carrier only | 15,000 – 25,000 km |
| LIDAR | Any (cross-section) | 20,000 – 35,000 km |

These numbers mean:
- In a 100,000 km system, a ship with transponder on and radar active is visible basically everywhere.
- A ship running with transponder off but under full thrust is visible on IR across most of the system.
- A ship coasting with reactor on minimum is hard to spot beyond 20,000 km.
- A ship running dark is nearly invisible beyond 2,000 km — but blind and heating up.

This creates interesting geography. Busy transit corridors between planets are well-lit with drive signatures. The spaces between — the dark lanes — are where quiet ships pass unnoticed. Players learn to read the traffic map and pick their routes.

---

## Signature Computation — Implementation

The server computes each ship's signature profile each tick (or at the sensor update interval, whichever is less frequent). The computation is a simple weighted evaluation of subsystem state.

```typescript
function computeSignature(ship: ShipState): SignatureProfile {
  const drive = ship.subsystems.drive;
  const reactor = ship.subsystems.reactor;
  const thermal = ship.subsystems.thermal;
  const sensors = ship.subsystems.sensors;
  const comms = ship.subsystems.comms;

  return {
    thermal: clamp(0, 100,
      weight_reactor * normalize(reactor.values.power_output, 0, reactor.values.max_output) * 100
      + weight_drive_heat * normalize(drive.values.heat_generation, 0, drive.max_heat) * 100
      + weight_radiator * normalize(thermal.radiators.values.surface_temperature, 280, 2000) * 100
      + weight_heatsink * normalize(thermal.heat_sinks.values.fill_fraction, 0, 1) * 30
    ),

    drive: clamp(0, 100,
      normalize(drive.values.throttle, 0, 1)
      * (0.5 + 0.5 * normalize(drive.tuning.values.reaction_mass_ratio, 0, 1))
      * 100
    ),

    electromagnetic: clamp(0, 100,
      (sensors.active.radar.values.enabled ? 60 : 0)
      + (sensors.active.lidar.values.enabled ? 30 : 0)
      + (comms.values.transponder ? 8 : 0)
      + (comms.values.transmitting ? 5 : 0)
    ),

    crossSection: clamp(0, 100,
      ship.definition.baseCrossSection
      + 15 * normalize(thermal.radiators.values.deployment_fraction, 0, 1)
    ),

    transponder: {
      active: comms.values.transponder,
      shipId: ship.registration.id,
      shipClass: ship.definition.name,
      owner: ship.registration.owner,
    }
  };
}
```

The weight values and normalization ranges are **tuning knobs for game balance**. This is not physics. It's game design math dressed in physics clothing. Adjust until detection ranges and stealth gameplay feel right.

---

## Sensor Evaluation — Implementation

When building a contact package for a ship, the server checks each sensor against each potential target.

```typescript
function evaluateDetection(
  observer: ShipState,
  target: ShipState,
  targetSignature: SignatureProfile
): Contact | null {
  const range = distance(observer.position, target.position);
  const bearing = angleTo(observer.position, target.position);
  const detectionMethods: DetectionMethod[] = [];
  let bestConfidence = 0;

  // Check each enabled sensor
  for (const sensor of getEnabledSensors(observer)) {
    const relevantSignature = getSignatureForChannel(targetSignature, sensor.channel);
    const effectiveRange = sensor.baseRange * Math.pow(relevantSignature / 100, sensor.rangeScaling);

    if (range <= effectiveRange) {
      detectionMethods.push(sensor.detectionMethod);
      const rangeRatio = 1 - (range / effectiveRange); // 0 at max range, 1 at point blank
      bestConfidence = Math.max(bestConfidence, rangeRatio);
    }
  }

  // Special: transponder interrogation (if observer has radar on + target transponder on)
  if (observerHasRadar(observer) && targetSignature.transponder.active) {
    if (range <= observer.sensors.active.radar.baseRange) {
      detectionMethods.push('radar_transponder');
      bestConfidence = Math.max(bestConfidence, 0.9); // Transponder data is high confidence
    }
  }

  if (detectionMethods.length === 0) return null;

  // Build contact with data appropriate to best confidence level
  return buildContact(target, targetSignature, detectionMethods, bestConfidence, range, bearing);
}
```

The `buildContact` function populates the Contact interface fields based on confidence level and which detection methods are active. Higher confidence and more detection methods = more fields populated. The resolution tiers from the table above guide which fields appear at which confidence levels.

---

## Implementation Notes for Coding Agent

1. **Signature computation belongs in the simulation module.** It runs each tick alongside subsystem updates. No rendering dependencies.

2. **Sensor evaluation runs at the contact update interval (~1 second), not every tick.** It's a separate pass that reads current ship positions and signatures. This keeps it decoupled from the physics tick rate.

3. **The contact package is the only detection data the client receives.** The client never sees raw signature values for other ships. It only sees what its sensors resolved. This is important for multiplayer integrity.

4. **Contact history and stale tracking are client-side only.** The server sends current contacts. The client manages persistence, dead-reckoning, aging, and expiration. This means no server storage cost for contact history.

5. **All detection range numbers and signature weights are tuning parameters.** Store them in a configuration object, not hardcoded. We will be adjusting these constantly during development.

6. **Transponder interrogation is a special case in the detection flow, not a separate system.** It piggybacks on radar — if radar is on and can reach the target, and the target's transponder is on, the transponder data is included in the contact. No separate "interrogation request" needed.

7. **Drive signature analysis (identifying ship class from IR) is a resolution-dependent data field.** It only populates when IR detection confidence is above a threshold. The analysis compares the target's drive signature against known drive profiles — this is a simple lookup table, not a simulation.

8. **For Phase 1 (single player, client-side), the detection system still runs server-side-style.** The simulation module computes signatures and evaluates sensors. The client receives contact packages through the bridge interface. This ensures the code migrates to a real server without changes.

9. **The EMCON concept is never referenced in code.** There is no EMCON enum, no EMCON state, no EMCON command. EMCON is a player-facing concept that emerges from subsystem configuration. The code only knows about individual subsystem toggles and values.

10. **Priority for implementation:** Get transponder + radar interrogation working first (it's the simplest detection path and the most common case). Then add IR detection of drive signatures. Then passive EM. Visual and LIDAR can come later. Contact history and stale tracking can be added to the client independently at any time.
