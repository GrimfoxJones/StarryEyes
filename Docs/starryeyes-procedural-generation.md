# StarryEyes — Procedural Star System Generation

**Version:** 0.1 — Design Specification
**Author:** Grimfox Games
**Date:** March 2026
**Companion to:** StarryEyes Codebase Summary

---

## Design Philosophy

The current Sol system is entirely hard-coded in `bodies.ts`. Every body, every orbit, every mass — hand-placed. This was fine for building out the engine, but StarryEyes needs variety. The player should be able to jump into a procedurally generated system and find something believable every time — a red dwarf with a clutch of rocky worlds huddled close, a blue-white giant with nothing but a distant ice ball, a sun-like star with a hot Jupiter parked where it shouldn't be. Realistic, but not boring.

The generator is **science-informed, not science-constrained**. We use real stellar classification, real planetary formation heuristics, and real atmospheric chemistry rules — then we bend them where the game needs us to. Hot Jupiters exist because exoplanet surveys say they do. Tidally locked worlds around red dwarfs exist because physics says they must. But we're not running n-body simulations or modeling accretion disks. We're rolling dice guided by astrophysics.

### Key Principles

1. **Deterministic from seed.** Given the same seed, the generator produces the same system. This matters for multiplayer — the server generates once, clients can reconstruct if needed.

2. **Star drives everything.** The star's spectral type, luminosity, mass, and age determine the habitable zone, frost line, planet count, and what kinds of planets can exist where. The star is the first roll; everything else follows.

3. **Realistic parameters, playable spacing.** Orbital distances, masses, and compositions should pass a sniff test from anyone who's read a Wikipedia article on exoplanets. But moon orbital distances have a gameplay floor (500,000 km minimum) so navigation isn't a nightmare.

4. **Weighted randomness, not uniform randomness.** Planet types are drawn from probability distributions that shift based on orbital zone. Gas giants are more likely beyond the frost line. Rocky worlds dominate the inner system. But migration happens — hot Jupiters are rare but real.

5. **Some stars have no planets.** That's fine. Not every system is interesting. Binary remnants, young protostars, and certain giant stars may have cleared or never formed planetary disks.

6. **Binary stars are deferred.** True binary systems introduce three-body gravitational complexity that the engine doesn't solve. We may revisit this later with wide-binary approximations (where the companion is distant enough to ignore gravitationally), but for v1 the generator produces single-star systems only.

---

## Naming Convention

### Stars

Star names are procedurally generated from a syllable pool designed to produce names that feel astronomical — short, punchy, vaguely Latin or Greek. Examples: Sol, Vega, Altair, Kael, Drenn, Typhis, Maren, Ashur.

The generator combines syllable fragments:

```
Prefixes:  Al, Ash, Bel, Cas, Del, Dren, El, Fen, Gal, Hel, Ith, Jas,
           Kae, Lar, Mar, Nal, Ori, Pel, Ras, Sel, Tar, Tyr, Val, Zan
Suffixes:  -a, -an, -ar, -el, -en, -ia, -is, -on, -or, -os, -ur, -us,
           -ax, -ix, -ex
```

Names are 1–3 syllables. The generator checks against a reject list to avoid unfortunate combinations. Duplicate names within a save file are appended with a Greek letter designation (Alpha, Beta, etc.) though this is unlikely with the combinatorial space.

### Planets

Planets are named by their parent star followed by a Roman numeral indicating orbital order outward from the star:

```
Kael I      — innermost planet
Kael II     — second planet
Kael III    — third planet
Kael VII    — seventh planet
```

This mirrors the historical convention for solar system moons (Jupiter I = Io, etc.) adapted upward to planets, and is the standard used in most space-opera fiction and many real-world exoplanet catalogs.

### Moons (Natural Satellites)

Moons are named by appending a lowercase letter to their parent planet's designation, in order of orbital distance from the planet:

```
Kael III a  — innermost moon of Kael III
Kael III b  — second moon
Kael III c  — third moon
```

Name overrides (player-chosen names for discovered bodies, or established names in populated systems) are a future feature. For now, all planets and moons use their systematic designations only.

### Asteroids

Asteroids are named sequentially by their parent star, using a zero-padded four-digit index:

```
Kael 0001   — first asteroid
Kael 0002   — second asteroid
Kael 0017   — seventeenth asteroid
```

Asteroids are numbered in order of generation (roughly by orbital distance), not by discovery order — since these are the prominent, well-known bodies in the system.

### Stations

Stations are not procedurally generated in v1 — they'll be placed by narrative or economy systems later. When they are, they'll get proper names unrelated to the orbital naming scheme: `Tycho Station`, `Ceres Depot`, etc.

---

## Star Generation

### Spectral Classification

Stars are classified on the Morgan-Keenan system. The generator uses a weighted distribution that roughly matches observed stellar populations, biased slightly toward types that produce interesting planetary systems:

| Class | Name | Temp (K) | Color | Mass (M☉) | Radius (R☉) | Luminosity (L☉) | Generation Weight |
|-------|------|----------|-------|-----------|-------------|-----------------|-------------------|
| O | Blue supergiant | 30,000–50,000 | #9BB0FF | 16–150 | 6.6–25+ | 30,000–1,000,000 | 0.5% |
| B | Blue-white giant | 10,000–30,000 | #AABFFF | 2.1–16 | 1.8–6.6 | 25–30,000 | 1.5% |
| A | White | 7,500–10,000 | #CAD7FF | 1.4–2.1 | 1.4–1.8 | 5–25 | 3% |
| F | Yellow-white | 6,000–7,500 | #F8F7FF | 1.04–1.4 | 1.15–1.4 | 1.5–5 | 8% |
| G | Yellow (Sun-like) | 5,200–6,000 | #FFF4EA | 0.8–1.04 | 0.96–1.15 | 0.6–1.5 | 15% |
| K | Orange | 3,700–5,200 | #FFD2A1 | 0.45–0.8 | 0.7–0.96 | 0.08–0.6 | 25% |
| M | Red dwarf | 2,400–3,700 | #FFB56C | 0.08–0.45 | 0.1–0.7 | 0.001–0.08 | 40% |

The generation weights don't match the actual main sequence distribution (M dwarfs are ~76% of real stars) because a universe of nothing but dim red dwarfs isn't fun. We over-represent G, F, and K types to give players more habitable-zone action while keeping M dwarfs as the most common class.

**Note:** O and B stars are unlikely to have mature planetary systems (they're young and short-lived, and their radiation tends to strip protoplanetary disks). The generator reflects this — O stars almost never get planets; B stars occasionally get distant gas giants or debris disks.

### Weird Stars (Non-Main-Sequence)

About 7% of generated stars are non-main-sequence objects, drawn from:

| Type | Description | Temp (K) | Color | Mass (M☉) | Radius (R☉) | Luminosity (L☉) | Weight |
|------|-------------|----------|-------|-----------|-------------|-----------------|--------|
| Red giant | Evolved, expanded | 3,500–5,000 | #FF8C42 | 0.8–8 | 10–100 | 100–10,000 | 2.5% |
| White dwarf | Stellar remnant | 8,000–40,000 | #E0E8FF | 0.5–1.4 | 0.008–0.02 | 0.001–0.1 | 2% |
| Brown dwarf | Sub-stellar | 500–2,400 | #8B4513 | 0.01–0.08 | 0.08–0.15 | 0.00001–0.001 | 1.5% |
| Neutron star | Collapsed core | 600,000+ (surface) | #E8E8FF | 1.1–2.1 | ~0.00001 | 0.001–10 | 0.5% |
| T Tauri | Young protostar | 3,000–5,000 | #FFAA55 | 0.2–2 | 1–5 | 0.5–10 | 0.5% |

**Gameplay implications of weird stars:**

- **Red giants** may have planets but the inner system has been engulfed. Remaining planets are far out, possibly with altered atmospheres from the giant phase.
- **White dwarfs** can have remnant planets in wide orbits. Close-in debris disks are possible. Habitable zones are tiny (very close in).
- **Brown dwarfs** can have a few small rocky worlds very close in. Dim, cold systems. Atmospheric heating is minimal.
- **Neutron stars** almost never have planets. If they do, they're strange — pulsar planets formed from fallback material after the supernova. No habitable worlds.
- **T Tauri stars** have protoplanetary disks but no formed planets yet. Debris fields, dust, maybe a forming gas giant. These are "empty" systems with flavor.

### Star Parameter Generation

Once spectral class is selected, specific parameters are rolled within the class ranges:

```typescript
interface StarParameters {
  id: string;
  name: string;
  spectralClass: SpectralClass;       // O, B, A, F, G, K, M, or special type
  spectralSubclass: number;           // 0–9 (e.g., G2 for the Sun)
  luminosityClass: LuminosityClass;   // V (main sequence), III (giant), etc.
  mass: number;                       // kg
  radius: number;                     // meters
  luminosity: number;                 // watts (bolometric)
  surfaceTemperature: number;         // kelvin
  age: number;                        // years (affects planetary system maturity)
  metallicity: number;                // [Fe/H] — affects planet formation probability
  color: string;                      // hex color for rendering
}
```

**Derived quantities:**

- **Habitable zone** (liquid water possible on a rocky world with atmosphere):
  - Inner edge: `sqrt(luminosity / 1.1)` AU
  - Outer edge: `sqrt(luminosity / 0.53)` AU
  - (Luminosity in solar luminosities)

- **Frost line** (where water ice is stable, dividing rocky/gas giant formation):
  - `frostLine = 4.85 × sqrt(luminosity)` AU

- **Gravitational parameter:**
  - `mu = G × mass` (m³/s²)

- **Main sequence lifetime estimate:**
  - `lifetime = 10^10 × (mass_solar)^(-2.5)` years
  - Stars older than their main sequence lifetime are evolved (giants, white dwarfs, etc.)

---

## Planet Generation

### How Many Planets?

The number of planets depends on the star type and a random roll:

| Star Type | Min | Max | Average | Notes |
|-----------|-----|-----|---------|-------|
| O | 0 | 1 | 0.2 | Radiation strips disks; rarely has planets |
| B | 0 | 3 | 0.8 | Occasionally distant gas giants |
| A | 0 | 5 | 2.5 | Short-lived but can form planets |
| F | 1 | 8 | 4.5 | Good planet formers |
| G | 2 | 10 | 6 | Best planet formers (Sun-like) |
| K | 1 | 8 | 4.5 | Excellent for rocky worlds |
| M | 0 | 6 | 3 | Compact systems, tidal locking common |
| Red giant | 0 | 4 | 1.5 | Inner planets consumed |
| White dwarf | 0 | 3 | 0.8 | Remnant outer planets |
| Brown dwarf | 0 | 4 | 1.5 | Small, close-in worlds |
| Neutron star | 0 | 2 | 0.3 | Pulsar planets, extremely rare |
| T Tauri | 0 | 0 | 0 | No formed planets, just debris |

The count is drawn from a distribution (roughly Poisson-like) centered on the average, clamped to [min, max]. Higher stellar metallicity (randomly assigned) increases the count slightly — metal-rich stars form more planets.

### Orbital Placement

Planets are placed using a modified Titius-Bode-like spacing rule with randomized jitter:

```
orbit_n = baseDistance × spacing^n × jitter
```

Where:
- `baseDistance` is scaled to the star's luminosity: `0.2 × sqrt(luminosity)` AU for the innermost possible orbit
- `spacing` is drawn from [1.4, 2.2] (real systems show ~1.5–2.0 spacing ratios)
- `jitter` is a multiplier in [0.8, 1.2] applied to each orbit
- `n` is the orbital index (0, 1, 2, ...)

**Hot Jupiter migration:** Before finalizing orbits, there is a 10% chance (for F, G, K stars) that the outermost gas giant, if one exists, migrates inward to an orbit of 0.02–0.1 AU. This clears inner rocky planets — any planet that was interior to the hot Jupiter's new orbit is removed.

**Minimum orbital separation:** Adjacent planets must be separated by at least 5 mutual Hill radii to ensure long-term orbital stability. If a placed planet violates this, it's nudged outward.

### Orbital Elements

Each planet gets a full set of Keplerian elements:

```typescript
interface PlanetOrbitalElements {
  semiMajorAxis: number;          // meters — from placement algorithm
  eccentricity: number;           // 0.0–0.3 typically; drawn from Rayleigh distribution σ=0.05
  argumentOfPeriapsis: number;    // radians — uniform [0, 2π)
  meanAnomalyAtEpoch: number;    // radians — uniform [0, 2π)
  inclination: number;            // degrees — small, [0, 5] for most; up to 15 for disturbed systems
  longitudeOfAscendingNode: number; // radians — uniform [0, 2π) (for 3D; ignored in 2D mode)
  direction: 1 | -1;             // almost always prograde (1); ~1% chance of retrograde
}
```

**Eccentricity distribution:** Most planets have low eccentricity (circular-ish orbits). Drawn from a Rayleigh distribution with σ = 0.05, clamped to [0, 0.6]. Hot Jupiters tend toward lower eccentricity (tidally circularized). Outer system planets can be more eccentric.

### Planet Type Selection

Planet type is determined primarily by mass and orbital zone:

```
Zone classification based on distance from star:
  Hot zone:       < 0.5 × habitable_inner_edge
  Habitable zone: habitable_inner_edge to habitable_outer_edge
  Warm zone:      habitable_outer_edge to frost_line
  Cold zone:      frost_line to 10 × frost_line
  Outer zone:     > 10 × frost_line
```

| Zone | Rocky (%) | Super-Earth (%) | Mini-Neptune (%) | Gas Giant (%) | Ice Giant (%) |
|------|-----------|----------------|-----------------|--------------|--------------|
| Hot | 50 | 25 | 10 | 15* | 0 |
| Habitable | 45 | 30 | 15 | 5 | 5 |
| Warm | 30 | 25 | 25 | 10 | 10 |
| Cold | 5 | 10 | 15 | 45 | 25 |
| Outer | 5 | 5 | 10 | 35 | 45 |

*Hot zone gas giants are the hot Jupiters — they formed in the cold zone and migrated inward.

### Planet Classification

```typescript
type PlanetClass =
  | 'rocky'           // < 2 Earth masses, solid surface
  | 'super_earth'     // 2–10 Earth masses, solid surface, thick atmosphere possible
  | 'mini_neptune'    // 2–20 Earth masses, large volatile envelope
  | 'gas_giant'       // 20–4000 Earth masses (0.06–13 Jupiter masses), H/He dominated
  | 'ice_giant'       // 10–80 Earth masses, water/ammonia/methane dominated
  | 'dwarf'           // < 0.1 Earth masses, too small to clear orbit (Pluto-like)
  ;
```

---

## Planet Parameters

Every planet gets a rich parameter set. These are the stats that show up in the UI, drive economic gameplay, and feed the narrative.

### Core Physical Parameters

```typescript
interface PlanetPhysicalParams {
  mass: number;                   // kg
  radius: number;                 // meters
  density: number;                // kg/m³ (derived from mass and radius)
  surfaceGravity: number;         // m/s² (derived)
  escapeVelocity: number;         // m/s (derived)
  orbitalPeriod: number;          // seconds (from Kepler's third law)
  rotationPeriod: number;         // seconds (day length)
  axialTilt: number;              // degrees
  tidallyLocked: boolean;         // if true, rotation period = orbital period
  magneticField: MagneticFieldStrength;  // none, weak, moderate, strong
  albedo: number;                 // 0.0–1.0, fraction of light reflected
  equilibriumTemperature: number; // kelvin (before greenhouse effects)
  surfaceTemperature: number;     // kelvin (after greenhouse, if atmosphere exists)
}

type MagneticFieldStrength = 'none' | 'weak' | 'moderate' | 'strong';
```

**Mass ranges by class:**

| Class | Mass Range (Earth = 1) | Radius Range (Earth = 1) |
|-------|----------------------|------------------------|
| Dwarf | 0.001–0.1 | 0.1–0.5 |
| Rocky | 0.1–2 | 0.5–1.3 |
| Super-Earth | 2–10 | 1.2–2.0 |
| Mini-Neptune | 2–20 | 2.0–4.0 |
| Ice Giant | 10–80 | 3.5–6.0 |
| Gas Giant | 20–4000 | 6.0–15.0 |

**Radius from mass** (empirical power laws from exoplanet data):
- Rocky/Super-Earth: `R = M^0.27` (Earth units)
- Mini-Neptune: `R ≈ 2.5` Earth radii (roughly constant radius despite mass increase — the "radius valley")
- Gas Giant: `R = 11.2 × (M/318)^(-0.04)` for M > 318 Earth masses (Jupiter-mass and above are roughly Jupiter-sized due to degeneracy pressure)
- Ice Giant: `R = M^0.15 × 2.8`

**Surface gravity:** `g = G × M / R²`

**Escape velocity:** `v_esc = sqrt(2 × G × M / R)`

**Equilibrium temperature:** `T_eq = T_star × sqrt(R_star / (2 × a)) × (1 - albedo)^0.25`
where `a` is semi-major axis.

**Tidal locking:** Planets within `0.5 × sqrt(luminosity)` AU of M-class stars, or `0.1` AU of any star, are tidally locked. Age matters — older systems have more tidal locking.

**Rotation period:** If not tidally locked, drawn from a distribution:
- Rocky: 8–100 hours (Earth-like range, with tail toward slow rotators)
- Gas giant: 8–20 hours (fast spinners due to angular momentum conservation)
- Ice giant: 12–24 hours

**Axial tilt:** Uniform 0–45 degrees, with a 5% chance of extreme tilt (45–90 degrees, like Uranus).

**Magnetic field:** Depends on mass, rotation rate, and whether the planet has a liquid metallic core:
- Gas giants: almost always strong
- Rocky planets > 0.5 Earth mass with rotation < 48h: moderate to strong
- Small or slow-rotating rocky planets: weak or none
- Tidally locked planets: usually weak (slow rotation kills the dynamo)

### Core and Interior Composition

```typescript
interface PlanetInterior {
  coreType: CoreType;
  coreComposition: MaterialFraction[];    // what the core is made of
  mantleComposition: MaterialFraction[];  // what the mantle/envelope is made of
  coreMassFraction: number;               // 0.0–1.0, fraction of total mass in core
  differentiated: boolean;                // has the planet separated into layers?
}

type CoreType = 'iron_nickel' | 'silicate' | 'ice' | 'metallic_hydrogen' | 'none';

interface MaterialFraction {
  material: string;    // e.g., "iron", "silicate", "water_ice", "metallic_hydrogen"
  fraction: number;    // 0.0–1.0, mass fraction (all fractions in a layer sum to 1.0)
}
```

**Core composition by planet class:**

| Class | Core Type | Typical Core Composition |
|-------|-----------|------------------------|
| Rocky (hot zone) | Iron-nickel | 70% iron, 20% nickel, 10% sulfide |
| Rocky (habitable) | Iron-nickel | 65% iron, 20% nickel, 10% silicate, 5% sulfide |
| Super-Earth | Iron-nickel or silicate | Varies with formation zone |
| Mini-Neptune | Ice or silicate | 40% water ice, 30% silicate, 20% iron, 10% ammonia |
| Ice Giant | Ice | 60% water ice, 20% ammonia ice, 10% methane ice, 10% silicate |
| Gas Giant | Metallic hydrogen | 85% metallic hydrogen, 10% helium, 5% heavier elements |

**Core mass fraction:**
- Rocky: 0.25–0.45 (Earth is ~0.33)
- Super-Earth: 0.20–0.40
- Mini-Neptune: 0.50–0.80 (large volatile envelope is most of the mass)
- Ice Giant: 0.70–0.90
- Gas Giant: 0.03–0.15 (tiny core relative to total mass)

### Surface and Crust

Only relevant for planets with solid surfaces (rocky, super-earth, and some mini-neptunes):

```typescript
interface PlanetSurface {
  hasSolidSurface: boolean;
  crustComposition: MaterialFraction[];
  surfaceType: SurfaceType;
  tectonicallyActive: boolean;
  volcanism: VolcanismLevel;
  surfaceLiquid: SurfaceLiquid | null;
  surfacePressure: number;        // pascals (at mean surface level)
  surfaceFeatures: string[];      // descriptive tags for flavor
}

type SurfaceType =
  | 'barren_rocky'       // Mercury-like, no atmosphere, cratered
  | 'volcanic'           // Io-like, active volcanism, lava plains
  | 'frozen'             // Europa-like, ice-covered surface
  | 'desert'             // Mars-like, thin atmosphere, dust/sand
  | 'oceanic'            // Water world, >90% surface covered in liquid
  | 'terrestrial'        // Earth-like, continents + oceans
  | 'greenhouse'         // Venus-like, thick atmosphere, extreme heat
  | 'carbon'             // Carbon-rich world, graphite/diamond surfaces
  | 'lava'               // Tidally heated or extremely close to star
  | 'ice_rock'           // Titan-like, mix of ice and rock with hydrocarbon features
  ;

type VolcanismLevel = 'none' | 'extinct' | 'minor' | 'moderate' | 'extreme';

interface SurfaceLiquid {
  type: 'water' | 'methane' | 'ethane' | 'ammonia' | 'sulfuric_acid' | 'lava' | 'liquid_nitrogen';
  coverage: number;       // 0.0–1.0, fraction of surface
  depth: string;          // 'shallow' | 'moderate' | 'deep' | 'global_ocean'
}
```

**Surface type selection logic:**

The surface type is determined by a combination of factors:

1. **Temperature + atmosphere** determines the broad category:
   - T > 1500K → `lava` (close-in worlds, tidal heating)
   - T > 700K + thick atmosphere → `greenhouse`
   - T > 700K + thin/no atmosphere → `barren_rocky`
   - T in habitable range + water available + atmosphere → `terrestrial` or `oceanic`
   - T in habitable range + no water → `desert`
   - T < 200K + volatiles → `frozen` or `ice_rock`
   - T < 200K + no volatiles → `barren_rocky`

2. **Carbon-to-oxygen ratio** (inherited from star metallicity): C/O > 0.8 produces carbon worlds.

3. **Tidal heating** from star or parent planet can override temperature expectations (e.g., Io-like volcanism on a moon far from the star).

**Crust composition** is derived from surface type:

| Surface Type | Typical Crust |
|-------------|--------------|
| barren_rocky | 60% silicate, 25% feldspar, 10% iron oxide, 5% other |
| volcanic | 50% basalt, 30% sulfur compounds, 15% silicate, 5% iron |
| frozen | 70% water ice, 15% silicate, 10% ammonia ice, 5% CO₂ ice |
| desert | 55% silicate, 25% iron oxide, 15% feldspar, 5% calcium carbonate |
| oceanic | 45% basalt (ocean floor), 30% silicate, 15% sedimentary, 10% metal |
| terrestrial | 50% silicate, 20% feldspar, 15% quartz, 10% limestone, 5% metal |
| greenhouse | 40% basalt, 30% silicate, 20% sulfur compounds, 10% iron oxide |
| carbon | 50% graphite, 25% silicon carbide, 15% diamond, 10% iron carbide |
| lava | 60% basalt, 25% silicate slag, 10% iron, 5% crystallized mineral |
| ice_rock | 40% water ice, 25% silicate, 20% hydrocarbon deposits, 15% ammonia |

### Atmosphere

```typescript
interface PlanetAtmosphere {
  present: boolean;
  surfacePressure: number;        // atmospheres (Earth = 1.0)
  scaleHeight: number;            // meters
  composition: AtmosphericGas[];
  hazards: AtmosphericHazard[];
  cloudCover: number;             // 0.0–1.0
  cloudType: string | null;       // "water", "sulfuric_acid", "ammonia", "methane", etc.
  greenhouseEffect: number;       // kelvin added to equilibrium temperature
  breathable: boolean;            // can humans survive without a suit?
  colorTint: string;              // hex color for rendering atmosphere glow
}

interface AtmosphericGas {
  gas: string;                    // chemical formula: "N2", "O2", "CO2", "H2", "He", "CH4", etc.
  fraction: number;               // 0.0–1.0 (all fractions sum to 1.0)
}

type AtmosphericHazard =
  | 'toxic'              // poisonous gases (CO, H2S, HCN)
  | 'corrosive'          // acids (sulfuric, hydrofluoric)
  | 'extreme_pressure'   // >10 atm, crushing
  | 'extreme_heat'       // surface temp > 400K
  | 'extreme_cold'       // surface temp < 150K
  | 'radiation'          // no magnetic field + close to star, or near neutron star
  | 'flammable'          // high O2 + organics, or H2 atmosphere
  ;
```

**Atmosphere generation logic:**

Whether a planet retains an atmosphere depends on escape velocity vs. thermal velocity of gases. The rule of thumb: a planet retains a gas if `v_escape > 6 × v_thermal` where `v_thermal = sqrt(k_B × T / m_gas)`.

**Atmosphere probability by class:**

| Class | Has Atmosphere? | Typical Pressure |
|-------|----------------|-----------------|
| Dwarf | Rarely (< 10%) | Trace if any |
| Rocky (hot) | Sometimes (30%) | 0.001–100 atm |
| Rocky (habitable) | Usually (80%) | 0.1–10 atm |
| Rocky (cold) | Sometimes (50%) | 0.01–2 atm |
| Super-Earth | Almost always (95%) | 1–1000 atm |
| Mini-Neptune | Always | 100–10,000 atm (no solid surface accessible) |
| Gas Giant | Always | N/A (no surface) |
| Ice Giant | Always | N/A (no surface) |

**Atmospheric composition by temperature/type:**

| Scenario | Dominant Gases | Notes |
|----------|---------------|-------|
| Hot rocky (>700K) | CO₂, SO₂, N₂ | Venus-like greenhouse |
| Temperate rocky | N₂, CO₂, H₂O (vapor) | Pre-biotic or abiotic |
| Temperate rocky + biosphere | N₂, O₂, Ar, H₂O, CO₂ | Oxygen requires life |
| Cold rocky | N₂, CO₂, Ar, CH₄ | Titan-like possible |
| Gas giant (hot) | H₂, He, Na, K, TiO | Exotic metals in upper atmosphere |
| Gas giant (cold) | H₂, He, CH₄, NH₃ | Jupiter/Saturn-like |
| Ice giant | H₂, He, CH₄, H₂O | Uranus/Neptune-like |

**Breathability check:**
An atmosphere is breathable if and only if:
- O₂ fraction is 0.16–0.30 (too little = hypoxia, too much = toxicity/fire risk)
- CO₂ fraction is < 0.01
- No toxic gases above trace levels
- Surface pressure is 0.5–2.0 atm
- Surface temperature is 230–320K
- No corrosive gases

This is intentionally strict. Breathable worlds should be rare and valuable.

### Biosphere

```typescript
interface PlanetBiosphere {
  present: boolean;
  complexity: BiosphereComplexity;
  biomeTypes: BiomeType[];
  biomass: BiomassLevel;
  oxygenProducing: boolean;       // does the biosphere generate O2?
  hazards: BiohazardType[];
  compatibility: number;          // 0.0–1.0, how compatible with human biology
}

type BiosphereComplexity =
  | 'none'
  | 'prebiotic'          // complex organic molecules, no self-replicators
  | 'microbial'          // single-celled life
  | 'simple_multicellular' // algae, fungi, simple plants
  | 'complex_multicellular' // complex ecosystems, animals, forests
  | 'intelligent'        // tool-using species (extremely rare, narrative flag only)
  ;

type BiomassLevel = 'none' | 'trace' | 'sparse' | 'moderate' | 'abundant' | 'extreme';

type BiomeType =
  | 'microbial_mat'     // bacterial colonies, stromatolites
  | 'subsurface'        // life in rock/ice, not on surface
  | 'aquatic'           // ocean/lake-based ecosystems
  | 'tidal_zone'        // coastal/tidal ecosystems
  | 'forest'            // dense vegetation
  | 'grassland'         // open terrain with ground cover
  | 'desert_adapted'    // extremophile surface life in harsh conditions
  | 'aerial'            // floating/airborne organisms (gas giant cloud life)
  | 'ice_ecosystem'     // under-ice ocean life (Europa-like)
  | 'hydrothermal'      // life around volcanic vents
  ;

type BiohazardType =
  | 'incompatible_biochemistry'  // alien proteins, allergenic
  | 'pathogenic'                 // microorganisms dangerous to humans
  | 'toxic_biome'                // plants/organisms that produce toxins
  | 'aggressive_fauna'           // macroscopic predators
  ;
```

**Biosphere probability:**
Life requires:
1. Liquid solvent (water for Earth-like, possibly methane or ammonia for exotic)
2. Energy source (stellar radiation or tidal/geothermal)
3. Time (billions of years for complex life)
4. Stable conditions

| Condition | Biosphere Probability |
|-----------|---------------------|
| In habitable zone + liquid water + >2 Gy age | 40% microbial, 15% simple multicellular, 3% complex |
| In habitable zone + liquid water + <2 Gy age | 15% prebiotic, 5% microbial |
| Outside HZ + subsurface ocean (tidal heating) | 10% microbial |
| Outside HZ + no liquid water | 1% prebiotic (extremophiles) |
| Gas giant cloud layer | 2% microbial (speculative) |
| No atmosphere, no water | 0% |

**Oxygen in the atmosphere:** Free O₂ in significant quantities (>1%) is a biosignature. It is only generated if the biosphere is at least `simple_multicellular` with `oxygenProducing: true`. This is the primary pathway to breathable atmospheres.

### Ring System

Gas giants and ice giants have a chance of ring systems:

```typescript
interface RingSystem {
  present: boolean;
  innerRadius: number;            // meters from planet center
  outerRadius: number;            // meters from planet center
  composition: 'ice' | 'rock' | 'mixed';
  opacity: number;                // 0.0–1.0 for rendering
  colorTint: string;              // hex color
}
```

- Gas giants: 40% chance of rings
- Ice giants: 60% chance of rings (usually faint)
- Rocky planets: 1% chance (captured debris, very faint, gameplay curiosity)

Ring inner radius: `1.5 × planet radius` (Roche limit)
Ring outer radius: `2.0–5.0 × planet radius`

### Resource Tags

For economic gameplay, each planet gets resource availability tags:

```typescript
interface PlanetResources {
  waterAvailability: ResourceLevel;
  rareMetals: ResourceLevel;
  commonMetals: ResourceLevel;
  radioactives: ResourceLevel;
  hydrocarbons: ResourceLevel;
  volatiles: ResourceLevel;       // H2, He, noble gases
  exotics: ResourceLevel;         // unusual/valuable materials
}

type ResourceLevel = 'none' | 'trace' | 'poor' | 'moderate' | 'rich' | 'exceptional';
```

Resource levels are derived from planet composition:
- Iron-rich cores → common metals rich
- Carbon worlds → hydrocarbons exceptional
- Gas giants → volatiles rich
- Old, differentiated rocky worlds → rare metals moderate to rich
- Ice worlds → water rich
- Volcanic worlds → radioactives moderate (tidal heating implies heavy elements)

---

## Moon (Natural Satellite) Generation

### How Many Moons?

Moon count depends on the parent planet's mass:

| Parent Class | Min | Max | Average |
|-------------|-----|-----|---------|
| Dwarf | 0 | 0 | 0 |
| Rocky | 0 | 2 | 0.3 |
| Super-Earth | 0 | 3 | 0.8 |
| Mini-Neptune | 0 | 4 | 1.5 |
| Gas Giant | 1 | 12 | 5 |
| Ice Giant | 0 | 8 | 3 |

### Moon Placement

**Minimum orbital distance: 500,000 km (5 × 10⁸ m) from parent planet center.**

This is a gameplay constraint, not a physics one. Real moons can orbit much closer (Earth's Moon is ~384,000 km), but for navigability we want more separation.

Moons are placed using a spacing rule similar to planets:

```
moon_orbit_n = 500,000 km × spacing^n × jitter
```

Where:
- `spacing` is drawn from [1.3, 1.8]
- `jitter` is [0.85, 1.15]
- Maximum orbit: `0.4 × Hill sphere radius` (beyond this, orbits are unstable)

**Hill sphere radius:** `a × (m_planet / (3 × m_star))^(1/3)`
where `a` is the planet's semi-major axis.

### Moon Properties

Moons are generated with the same parameter set as planets but with adjustments:

- **Mass:** Moons are typically 10⁻⁵ to 10⁻² of their parent's mass. Large moons (like Ganymede) can be up to 10⁻⁴ of a gas giant's mass.
- **Tidal locking:** Moons within ~1,000,000 km of their parent are almost always tidally locked to the parent (not the star). This is the majority of moons.
- **Tidal heating:** Moons in eccentric orbits close to massive parents get internal heating from tidal flexing. This can produce volcanism (Io) or subsurface oceans (Europa) even far from the star.
- **Atmosphere:** Only large moons (> 0.1 Earth mass) with sufficient gravity and magnetic shielding retain atmospheres. Titan-like moons are possible around gas giants.
- **Biosphere:** Subsurface oceans heated by tidal forces are a viable biosphere niche even in the cold outer system.

```typescript
interface MoonParameters extends PlanetPhysicalParams {
  parentPlanetId: string;
  tidalHeating: number;           // watts, from tidal flexing
  tidallyLockedToParent: boolean;
  capturedBody: boolean;          // irregular moons have eccentric/inclined/retrograde orbits
}
```

**Captured vs. regular moons:**
- Regular moons: formed in place, prograde, low eccentricity, low inclination
- Captured moons (~20% of moons): retrograde possible, higher eccentricity, higher inclination, usually smaller

---

## Asteroid Generation

Asteroids are generated as individual bodies, just like planets. They are first-class citizens in the system — they show up in navigation, can be targeted, orbited, and eventually mined. This matches the current demo (Ceres Prime, Vesta Stone, etc.) and keeps things consistent.

### Belt Zones

A star system may have 0–2 asteroid concentration zones:

- **Inner belt** (between rocky and gas giant zones): 60% chance if the system has both rocky planets and gas giants
- **Outer belt** (beyond the outermost gas giant): 30% chance

Belt zones are defined by an inner/outer radius range, centered in a gap in the planetary sequence where gravitational resonance with a nearby gas giant prevents planet formation.

### Asteroid Count

Each belt zone generates 10–20 prominent asteroids. These are the large, well-known rocks — the ones that show up on navigational charts. Err on the side of more, not fewer, because asteroids are gameplay-relevant for mining and trading.

| Belt Type | Min | Max | Average |
|-----------|-----|-----|---------|
| Inner belt | 10 | 20 | 15 |
| Outer belt | 8 | 15 | 12 |

### Asteroid Properties

Each asteroid is generated with:

```typescript
interface GeneratedAsteroid {
  id: string;
  name: string;                           // e.g., "Kael 0007"
  designation: number;                    // sequential index (1-based)

  // Orbital — placed within the belt zone
  elements: PlanetOrbitalElements;

  // Physical
  mass: number;                           // kg — power law distribution, range 10^15 to 10^21 kg
  radius: number;                         // meters — 1 km to 500 km
  density: number;                        // kg/m³
  rotationPeriod: number;                 // seconds — 2 to 100 hours, often tumbling
  shape: AsteroidShape;                   // affects visual rendering

  // Composition — drives mining/economic value
  composition: AsteroidComposition;
  resources: PlanetResources;             // same resource tag system as planets
}

type AsteroidShape = 'spheroidal' | 'elongated' | 'irregular' | 'contact_binary';

type AsteroidComposition =
  | 'carbonaceous'     // C-type: carbon, organics, water ice. Most common (~75%)
  | 'silicate'         // S-type: silicate rock, some metal. Common (~17%)
  | 'metallic'         // M-type: iron-nickel. Rare but valuable (~8%)
  | 'icy'              // Outer belt: water ice, ammonia, CO2 ice
  ;
```

**Mass distribution:** Follows a power law — many small asteroids, few large ones. The largest asteroid in a belt is typically 200–500 km radius; most are 5–50 km.

**Orbital placement:** Asteroids are spread across the belt zone with semi-major axes drawn uniformly within the zone's inner/outer radius. Eccentricities are higher than planets — drawn from a Rayleigh distribution with σ = 0.10, clamped to [0, 0.4]. This gives them more elliptical, crossing orbits.

**Composition distribution by belt type:**

| Belt Location | Carbonaceous | Silicate | Metallic | Icy |
|--------------|-------------|---------|---------|-----|
| Inner belt | 50% | 30% | 15% | 5% |
| Outer belt | 20% | 15% | 5% | 60% |

**Resource tags** are derived from composition:
- Carbonaceous: hydrocarbons rich, water moderate, rare metals poor
- Silicate: common metals moderate, rare metals moderate
- Metallic: common metals rich, rare metals rich, exotics moderate
- Icy: water rich, volatiles rich

### Future: In-Flight Asteroid Discovery

Eventually, asteroid hunting for mining will involve discovering uncharted rocks during flight — small asteroids that aren't on the navigational chart. This will likely work through the sensor/detection system (similar to ship detection) rather than the system generator. A player with good sensors sweeping a belt zone could pick up contacts that resolve into minable rocks. That's a future feature — for now, the 10–20 prominent asteroids per belt are the ones that exist.

---

## The Complete Generated System

Putting it all together, a generated system produces:

```typescript
interface GeneratedSystem {
  seed: number;                           // deterministic seed
  star: StarParameters;
  planets: GeneratedPlanet[];
  asteroids: GeneratedAsteroid[];
  systemAge: number;                      // years — affects biosphere maturity
  habitableZone: { inner: number; outer: number };  // meters
  frostLine: number;                      // meters
}

interface GeneratedPlanet {
  // Identity
  id: string;
  name: string;                           // e.g., "Kael III"
  designation: number;                    // Roman numeral index (1-based)

  // Orbital
  elements: PlanetOrbitalElements;

  // Physical
  class: PlanetClass;
  physical: PlanetPhysicalParams;

  // Composition
  interior: PlanetInterior;
  surface: PlanetSurface | null;          // null for gas giants/ice giants
  atmosphere: PlanetAtmosphere;
  biosphere: PlanetBiosphere;
  rings: RingSystem | null;
  resources: PlanetResources;

  // Satellites
  moons: GeneratedMoon[];
}

interface GeneratedMoon {
  id: string;
  name: string;                           // e.g., "Kael III a"
  designation: string;                    // lowercase letter (a, b, c, ...)

  elements: PlanetOrbitalElements;

  class: PlanetClass;                     // usually 'rocky' or 'dwarf'
  physical: PlanetPhysicalParams & MoonParameters;
  interior: PlanetInterior;
  surface: PlanetSurface | null;
  atmosphere: PlanetAtmosphere;
  biosphere: PlanetBiosphere;
  resources: PlanetResources;
}
```

---

## Conversion to CelestialBody

The generator's output must be converted to the engine's `CelestialBody` format for use by the physics and rendering systems:

```typescript
function systemToBodies(system: GeneratedSystem): CelestialBody[] {
  const bodies: CelestialBody[] = [];

  // Star
  bodies.push({
    id: system.star.id,
    name: system.star.name,
    type: 'star',
    mass: system.star.mass,
    radius: system.star.radius,
    color: system.star.color,
    parentId: null,
    elements: { semiMajorAxis: 0, eccentricity: 0, argumentOfPeriapsis: 0,
                meanAnomalyAtEpoch: 0, epochTime: 0, direction: 1 },
  });

  // Planets
  for (const planet of system.planets) {
    bodies.push({
      id: planet.id,
      name: planet.name,
      type: 'planet',
      mass: planet.physical.mass,
      radius: planet.physical.radius,
      color: deriveColor(planet),
      parentId: system.star.id,
      elements: toEngineElements(planet.elements),
    });

    // Moons
    for (const moon of planet.moons) {
      bodies.push({
        id: moon.id,
        name: moon.name,
        type: 'moon',
        mass: moon.physical.mass,
        radius: moon.physical.radius,
        color: deriveColor(moon),
        parentId: planet.id,
        elements: toEngineElements(moon.elements),
      });
    }
  }

  // Asteroids
  for (const asteroid of system.asteroids) {
    bodies.push({
      id: asteroid.id,
      name: asteroid.name,
      type: 'asteroid',
      mass: asteroid.mass,
      radius: asteroid.radius,
      color: deriveAsteroidColor(asteroid.composition),
      parentId: system.star.id,
      elements: toEngineElements(asteroid.elements),
    });
  }

  return bodies;
}
```

The rich generation data (atmosphere, biosphere, resources, etc.) is stored separately and referenced by body ID for UI display, economic systems, and narrative hooks.

---

## Rendering Hints

Planet color is derived from the generation data, not assigned randomly:

| Surface/Type | Base Color | Notes |
|-------------|-----------|-------|
| Barren rocky | #A0A0A0 – #808080 | Gray, cratered |
| Volcanic | #FF4500 – #CC3300 | Orange-red glow |
| Frozen | #E0F0FF – #B0D0E0 | Pale blue-white |
| Desert | #D2B48C – #C8A070 | Tan, sandy |
| Oceanic | #1E90FF – #0066CC | Deep blue |
| Terrestrial | #4A90E2 – #3A7BC8 | Blue-green |
| Greenhouse | #FFD700 – #CC9900 | Yellow-orange haze |
| Carbon | #2F2F2F – #1A1A1A | Very dark, near-black |
| Lava | #FF2200 – #CC0000 | Bright red-orange |
| Ice/rock | #D4C4A8 – #B0A080 | Tan with blue tint |
| Gas giant | #C88B3A – #8B6914 | Banded tan/brown/orange |
| Ice giant | #4FC3F7 – #0097A7 | Blue-cyan-green |

Atmosphere tint overlays the base color at low alpha for rendering.

---

## First Pass: Randomize Button

For the initial implementation, we add a "Randomize System" button to the debug controls (or a dedicated UI element).

### Behavior

1. **Generate seed** — `Math.floor(Math.random() * 2^32)` or allow manual seed entry for reproducibility.
2. **Run generator** — Produce a `GeneratedSystem` from the seed.
3. **Convert to bodies** — Call `systemToBodies()` to get a `CelestialBody[]`.
4. **Replace current system** — Server swaps out the body list. All connected clients receive a full state refresh.
5. **Place player ship:**
   - If the system has a habitable-zone planet, place the ship in orbit around it.
   - If no habitable planet exists, pick the most interesting planet (largest rocky world, or any planet).
   - If no planets exist, place the ship at `2 AU × sqrt(luminosity)` from the star in drift mode.
6. **Reset game time** to 0.

### Server Integration

The randomize command is a new debug endpoint:

```
POST /api/debug/randomize-system
Body: { seed?: number }    // optional seed for reproducibility
Response: { seed: number, starName: string, planetCount: number, bodies: CelestialBody[] }
```

The server:
1. Generates the system
2. Stores the `GeneratedSystem` for rich data queries
3. Replaces the body list in the game state
4. Repositions all connected players' ships
5. Broadcasts a full state refresh via WebSocket

### Client Integration

On receiving the system refresh:
1. Clear all rendering state (orbit paths, labels, body sprites)
2. Rebuild from the new body list
3. Camera focuses on the player's new position
4. HUD updates to reflect the new system name

### Seed Display

Show the current seed somewhere in the HUD (small text, bottom corner). Players can share seeds to revisit interesting systems. A text input next to the randomize button allows entering a specific seed.

---

## Implementation Order

1. **Star generator** — spectral class selection, parameter derivation, naming
2. **Planet count + orbital placement** — Titius-Bode spacing, hot Jupiter migration
3. **Planet type selection** — zone-based probability tables
4. **Core physical parameters** — mass, radius, gravity, temperature
5. **Atmosphere generation** — composition, pressure, breathability
6. **Surface and interior** — composition, surface type, volcanism
7. **Biosphere** — probability checks, complexity, biome assignment
8. **Moon generation** — count, placement, properties
9. **Asteroid generation** — belt zones, individual asteroid placement, composition
10. **Conversion to CelestialBody** — bridge to engine
11. **Randomize button + server endpoint** — wire it up end to end
12. **Rendering color derivation** — planet color from properties
13. **Rich data display in UI** — atmosphere, biosphere, resources in target info / detail modals
14. **Ring rendering** — visual rings on gas giants
15. **Resource tags** — economic implications (future system)

Steps 1–11 are the minimum for a working randomizer. Steps 12–15 are polish that can follow.

---

## Future Considerations

- **Binary stars:** Wide binaries where the companion is >1000 AU away could be added as a background object with no gravitational effect. Close binaries are a much harder problem.
- **Procedural station placement:** Economy-driven station spawning based on resources and trade routes.
- **System variety archetypes:** Pre-rolled "interesting" system templates (e.g., "dense inner system," "lonely ice world," "hot Jupiter + debris field") that the generator can be biased toward for narrative missions.
- **Persistent galaxy:** If inter-system travel is added, systems need to be regenerable from seed without storing the full generation output.
- **Spectral analysis gameplay:** Sensors could detect atmospheric composition at range, making the detailed atmosphere data gameplay-relevant.
