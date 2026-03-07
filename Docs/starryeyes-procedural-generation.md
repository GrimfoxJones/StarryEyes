# Procedural Star System Generation

This document describes how StarryEyes procedurally generates star systems. All generation is **deterministic** -- the same integer seed always produces the same system. The code lives in `starry-eyes-shared/src/procgen/`.

## RNG Foundation

Everything is driven by `SeededRng` (`rng.ts`), a mulberry32-based PRNG. It provides:

- `next()` -- uniform float in [0, 1)
- `range(min, max)`, `int(min, max)`, `pick(arr)`
- `weighted(items, weights)` -- weighted random selection
- `rayleigh(sigma, max)` -- Rayleigh distribution (used for eccentricities)
- `poisson(lambda)` -- Poisson-like integer draw (used for body counts)
- `chance(p)` -- boolean with probability p

## System-Level Generation

Entry point: `generateSystem(seed)` in `system.ts`.

1. **Star** is generated first (determines everything downstream)
2. **Habitable zone** is derived: inner = `sqrt(L/1.1) AU`, outer = `sqrt(L/0.53) AU`
3. **Frost line** is derived: `4.85 * sqrt(L) AU`
4. **Planets** are placed using Titius-Bode spacing scaled to stellar luminosity
5. **Asteroids** are placed in gaps between planet types
6. **Jump gate** orbit is calculated relative to luminosity and planet positions

### Orbital Zones

Zones are classified by distance relative to the habitable zone and frost line (`zones.ts`):

| Zone | Condition |
|------|-----------|
| `hot` | < 0.5x habitable zone inner edge |
| `habitable` | Within habitable zone bounds |
| `warm` | Beyond habitable zone, before frost line |
| `cold` | Frost line to 10x frost line |
| `outer` | Beyond 10x frost line |

### Output Structure (`GeneratedSystem`)

| Field | Description |
|-------|-------------|
| `seed` | The integer seed used |
| `star` | `StarParameters` object |
| `planets` | Array of `GeneratedPlanet` (each with moons) |
| `asteroids` | Array of `GeneratedAsteroid` |
| `systemAge` | Star's age in years |
| `habitableZone` | `{ inner, outer }` in meters |
| `frostLine` | Distance in meters |
| `gateOrbitRadius` | Jump gate orbital radius in meters |

---

## Star Generation

Source: `star.ts`

### Main Sequence Stars (93% of systems)

Spectral class is selected by weighted random draw reflecting real-world stellar population:

| Class | Weight | Temp Range (K) | Mass Range (M_sun) | Luminosity Range (L_sun) |
|-------|--------|-----------------|---------------------|--------------------------|
| O | 0.5 | 30,000-50,000 | 16-150 | 30,000-1,000,000 |
| B | 1.5 | 10,000-30,000 | 2.1-16 | 25-30,000 |
| A | 3 | 7,500-10,000 | 1.4-2.1 | 5-25 |
| F | 8 | 6,000-7,500 | 1.04-1.4 | 1.5-5 |
| G | 15 | 5,200-6,000 | 0.8-1.04 | 0.6-1.5 |
| K | 25 | 3,700-5,200 | 0.45-0.8 | 0.08-0.6 |
| M | 40 | 2,400-3,700 | 0.08-0.45 | 0.001-0.08 |

Within a class, a subclass (0-9) is rolled and used to interpolate all physical properties. Luminosity uses logarithmic interpolation; mass, radius, and temperature use linear.

### Special Stars (7% of systems)

| Type | Weight | Luminosity Class | Notes |
|------|--------|-----------------|-------|
| Red giant | 2.5 | III | 10-100 solar radii, 3,500-5,000 K |
| White dwarf | 2.0 | VII | 0.008-0.02 solar radii, 8,000-40,000 K |
| Brown dwarf | 1.5 | V | 500-2,400 K, sub-stellar mass |
| Neutron star | 0.5 | V | 600,000-1,000,000 K, ~10 km radius |
| T Tauri | 0.5 | V | Young pre-main-sequence, no planets generated |

### Star Parameters Tracked

- `spectralClass` / `spectralSubclass` / `luminosityClass`
- `mass` (kg), `radius` (m), `luminosity` (W), `luminositySolar`
- `surfaceTemperature` (K)
- `age` (years) -- derived from main sequence lifetime: `10^10 * M^-2.5`
- `metallicity` ([Fe/H], range -0.5 to +0.5) -- affects planet count
- `color` (hex) -- per spectral class
- `mu` -- gravitational parameter (G * mass)

### Naming

Star names are built from syllable pools: prefix + optional middle + optional suffix (e.g., "Celenar", "Tor", "Volis").

---

## Planet Generation

Source: `planet.ts`

### Planet Count

Drawn from a Poisson distribution around a class-dependent average, modified by stellar metallicity (+2 planets per +1.0 [Fe/H]). Clamped to class-specific min/max ranges.

| Star Type | Min | Max | Avg |
|-----------|-----|-----|-----|
| G | 2 | 10 | 6 |
| F, K | 1 | 8 | 4.5 |
| M | 0 | 6 | 3 |
| O | 0 | 1 | 0.2 |
| T Tauri | 0 | 0 | 0 |

### Orbital Placement

Uses Titius-Bode-like geometric spacing:
- Base distance: `0.2 * sqrt(L_solar) AU`
- Each subsequent orbit: `base * spacing^n * jitter`
- Spacing factor: random 1.4-2.2
- Jitter: random 0.8-1.2 per orbit

### Planet Classes

Selected by weighted random based on orbital zone:

| Class | Mass Range (M_earth) | Radius | Hot | Hab | Warm | Cold | Outer |
|-------|---------------------|--------|-----|-----|------|------|-------|
| `rocky` | 0.1-2 | M^0.27 | 50 | 45 | 30 | 5 | 5 |
| `super_earth` | 2-10 | M^0.27 | 25 | 30 | 25 | 10 | 5 |
| `mini_neptune` | 2-20 | ~2.5 | 10 | 15 | 25 | 15 | 10 |
| `gas_giant` | 20-4,000 | 6-11.2 | 15 | 5 | 10 | 45 | 35 |
| `ice_giant` | 10-80 | M^0.15 * 2.8 | 0 | 5 | 10 | 25 | 45 |

(Weight columns show relative probability per zone.)

For gas giants above 318 M_earth (Jupiter mass), radius *decreases* slightly with mass (degeneracy pressure), modeled as `11.2 * (M/318)^-0.04`.

### Physical Parameters

Each planet gets a full set of derived physical properties:

| Parameter | How It's Derived |
|-----------|-----------------|
| Density | mass / volume |
| Surface gravity | G*M / R^2 |
| Escape velocity | sqrt(2GM/R) |
| Orbital period | Kepler's third law |
| Rotation period | Tidally locked if close to star; gas giants 8-20 hr; rocky 8-100 hr |
| Axial tilt | 0-45 deg (95%) or 45-90 deg (5% extreme tilt) |
| Albedo | Class-dependent: gas giants 0.3-0.5, ice giants 0.25-0.4, rocky 0.1-0.4 |
| Equilibrium temp | From stellar effective temperature, distance, and albedo |
| Surface temp | Equilibrium + greenhouse effect |
| Magnetic field | Based on mass, rotation, and tidal locking (none/weak/moderate/strong) |
| Tidal locking | Checked against star-type-dependent threshold distance |

### Hot Jupiter Migration

10% chance for F, G, K stars: the outermost gas giant migrates to 0.02-0.1 AU. All interior planets are destroyed. Orbit is tidally circularized.

### Hill Sphere Stability

After placement, adjacent planets are checked against mutual Hill sphere radii. Any planet within 5x the mutual Hill radius of its neighbor is pushed outward.

### Orbital Elements

Each planet also gets:
- `eccentricity` -- Rayleigh distribution, sigma=0.05, max 0.6
- `argumentOfPeriapsis` -- random 0-2pi
- `meanAnomalyAtEpoch` -- random 0-2pi
- `direction` -- 99% prograde, 1% retrograde

### Naming

Planets are named `{StarName} {Roman Numeral}` by orbital order (e.g., "Volis III").

---

## Atmosphere Generation

Source: `atmosphere.ts`

### Presence

| Class | Chance of Atmosphere |
|-------|---------------------|
| Gas/ice giant, mini-neptune | Always |
| Super-earth | 95% |
| Rocky (habitable zone) | 80% |
| Rocky (cold/warm/outer) | 50% |
| Rocky (hot zone) | 30% |
| Dwarf | 10% |

### Composition

Determined by planet class and equilibrium temperature:

- **Gas giants** (hot, >1000K): H2/He + Na/K traces
- **Gas giants** (cool): H2/He + CH4/NH3
- **Ice giants**: H2/He + CH4/H2O
- **Mini-neptunes**: H2/He/H2O
- **Rocky/super-earth (>700K)**: CO2-dominated (Venus-like) with SO2 and N2
- **Rocky/super-earth (habitable)**: N2-dominated with CO2/H2O/Ar (pre-biotic baseline)
- **Rocky/super-earth (cold)**: N2-dominated with CO2/Ar/CH4

All compositions are normalized to sum to 1.0.

### Tracked Properties

| Property | Description |
|----------|-------------|
| `surfacePressure` | Atmospheres (gaseous = 1000, mini-neptune 100-10,000, rocky varies by zone) |
| `scaleHeight` | Meters -- scaled from Earth's 8,500m by temperature, mass, and radius |
| `composition` | Array of `{ gas, fraction }` |
| `greenhouseEffect` | Kelvin added to surface temp; driven by CO2 fraction and pressure |
| `cloudCover` | 0-1 (gas giants 0.8-1.0, others 0-0.8) |
| `cloudType` | silicate, ammonia, sulfuric_acid, water, methane, or null |
| `hazards` | Array: toxic, corrosive, extreme_pressure, extreme_heat, extreme_cold, radiation, flammable |
| `breathable` | Boolean -- requires O2 16-30%, pressure 0.5-2.0 atm, temp 230-320K, no toxins |
| `colorTint` | Hex color for rendering (Venus-yellow, Titan-orange, blue-white, etc.) |

### Biosphere Oxygen Feedback

If a biosphere produces oxygen, O2 (15-25%) is injected into the atmosphere and fractions are renormalized. Breathability is then rechecked.

---

## Surface & Interior Generation

Source: `surface.ts`

### Surface Types

Only generated for bodies with solid surfaces (not gas/ice giants).

| Surface Type | Condition |
|-------------|-----------|
| `lava` | Equilibrium temp > 1,500K |
| `greenhouse` | >700K with thick atmosphere (>10 atm) |
| `barren_rocky` | >700K without thick atmosphere, or cold without atmosphere |
| `terrestrial` | Habitable zone with atmosphere (40% chance) |
| `oceanic` | Habitable zone, super-earths (30%) or remaining habitable worlds |
| `desert` | Habitable zone fallthrough, or moderate temp |
| `frozen` / `ice_rock` | <200K with atmosphere (50/50 split) |
| `carbon` | 3% rare chance anywhere |
| `volcanic` | Hot zone (20% chance) |

### Surface Properties Tracked

| Property | Description |
|----------|-------------|
| `surfaceType` | One of the 10 types above |
| `crustComposition` | Array of `{ material, fraction }` -- specific to surface type |
| `tectonicallyActive` | 40% for non-dwarf bodies |
| `volcanism` | none / extinct / minor / moderate / extreme |
| `surfaceLiquid` | Type (water, methane, ethane, ammonia, sulfuric_acid, lava, liquid_nitrogen), coverage, depth |
| `surfacePressure` | Pascals (atmospheric pressure at surface) |
| `surfaceFeatures` | 1-3 features from surface-type pools (e.g., "dune seas", "cryovolcanoes") |

### Crust Composition Examples

- **Terrestrial**: silicate, feldspar, quartz, limestone, metal
- **Carbon**: graphite, silicon carbide, diamond, iron carbide
- **Frozen**: water ice, silicate, ammonia ice, CO2 ice
- **Volcanic**: basalt, sulfur compounds, silicate, iron

### Interior

| Property | Description |
|----------|-------------|
| `coreType` | iron_nickel, silicate, ice, metallic_hydrogen, none |
| `coreComposition` | Material fractions (e.g., iron 65%, nickel 20%, silicate 10%, sulfide 5%) |
| `mantleComposition` | Material fractions |
| `coreMassFraction` | Fraction of total mass in the core |
| `differentiated` | 80% for non-dwarf bodies |

Interior composition varies by planet class:
- **Rocky/super-earth**: iron-nickel core (70% in hot zone), silicate mantle
- **Mini-neptune**: ice or silicate core, hydrogen/helium mantle, 50-80% core mass fraction
- **Ice giant**: ice core (water/ammonia/methane), water/ammonia/methane mantle, 70-90% core
- **Gas giant**: metallic hydrogen core, hydrogen/helium mantle, 3-15% core mass fraction
- **Dwarf**: small iron-nickel or silicate core, silicate/ice mantle

---

## Biosphere Generation

Source: `biosphere.ts`

### Probability

Life probability depends on zone, atmosphere, water presence, and system age:

| Condition | Outcome |
|-----------|---------|
| No atmosphere (non-gaseous) | 1% subsurface microbial |
| Gas/ice giant | 2% aerial microbial life |
| Non-habitable, no water | 10% subsurface/hydrothermal microbial |
| Habitable + water, age >2 Gy | 3% complex multicellular |
| Habitable + water, age >2 Gy | 15% simple multicellular |
| Habitable + water, age >1 Gy | 40% microbial |
| Habitable + water, any age | 15% prebiotic chemistry |
| Habitable, no water / warm zone | 5% microbial |

### Properties Tracked

| Property | Description |
|----------|-------------|
| `complexity` | none, prebiotic, microbial, simple_multicellular, complex_multicellular, intelligent |
| `biomeTypes` | Array from: microbial_mat, subsurface, aquatic, tidal_zone, forest, grassland, desert_adapted, aerial, ice_ecosystem, hydrothermal |
| `biomass` | none, trace, sparse, moderate, abundant, extreme |
| `oxygenProducing` | Only for simple/complex multicellular -- triggers atmosphere O2 injection |
| `hazards` | incompatible_biochemistry, pathogenic, toxic_biome, aggressive_fauna |
| `compatibility` | 0-1 float indicating biochemical compatibility with human biology |

### Biome Selection by Complexity

- **Prebiotic**: no biomes
- **Microbial**: microbial_mat + hydrothermal, or subsurface
- **Simple multicellular**: microbial_mat, aquatic, possibly tidal_zone
- **Complex multicellular**: aquatic, tidal_zone, plus forest (70%), grassland (60%), desert_adapted (30%)

---

## Ring System Generation

Source: `rings.ts`

Rings are only possible for gas giants (40%), ice giants (60%), and rocky/super-earth (1%).

| Property | Description |
|----------|-------------|
| `innerRadius` | 1.5x planet radius (Roche limit) |
| `outerRadius` | 2.0-5.0x planet radius |
| `composition` | ice, rock, or mixed (ice giants favor ice) |
| `opacity` | Ice giants 0.1-0.4, gas giants 0.3-0.9 |
| `colorTint` | Ice=blue-white, rock=brown, mixed=tan |

---

## Resource Generation

Source: `resources.ts`

Seven resource categories, each rated on a 6-level scale: none, trace, poor, moderate, rich, exceptional.

| Resource | Rich When... |
|----------|-------------|
| `waterAvailability` | Ice core, oceanic/frozen surface, ice giants |
| `rareMetals` | Iron-nickel core |
| `commonMetals` | Iron-nickel core |
| `radioactives` | Volcanic surface |
| `hydrocarbons` | Carbon surface type, gas giants |
| `volatiles` | Cold/outer zones, gas/ice giants |
| `exotics` | Carbon surface type, metallic asteroids |

### Asteroid Resources

Asteroid resource profiles are driven by composition type:
- **Carbonaceous**: water + hydrocarbons
- **Silicate**: rare + common metals
- **Metallic**: rare + common metals + exotics
- **Icy**: water + volatiles

---

## Asteroid Generation

Source: `asteroid.ts`

### Belt Placement

- **Inner belt** (60% chance): between the outermost rocky planet and the innermost gas giant
- **Outer belt** (30% chance): beyond the outermost planet, extending to 2.5x that distance
- **Scattered** (fallback): if no belts form, 5-10 asteroids scattered across the system

### Asteroid Properties

| Property | Description |
|----------|-------------|
| `radius` | Largest: 200-500 km; others: power-law 1-300 km |
| `density` | 1,500-5,000 kg/m^3 |
| `composition` | carbonaceous, silicate, metallic, icy (weighted by belt type) |
| `shape` | spheroidal (large only), elongated, irregular, contact_binary |
| `rotationPeriod` | 2-100 hours |
| `eccentricity` | Rayleigh, sigma=0.10, max 0.4 |

Inner belts favor carbonaceous/silicate; outer belts favor icy composition.

### Naming

Asteroids are named `{StarName} {0001}` with zero-padded designation numbers.

---

## Moon Generation

Source: `moon.ts`

### Moon Count

Poisson-distributed around class-dependent averages:

| Parent Class | Min | Max | Avg |
|-------------|-----|-----|-----|
| Gas giant | 1 | 12 | 5 |
| Ice giant | 0 | 8 | 3 |
| Mini-neptune | 0 | 4 | 1.5 |
| Super-earth | 0 | 3 | 1.2 |
| Rocky | 0 | 2 | 1.0 |
| Dwarf | 0 | 0 | 0 |

Hot-zone rocky/super-earth planets have reduced moon counts (0.15 / 0.3 avg).

Rocky and super-earth planets may also have **captured asteroid moons** (avg 1.2, placed in wider orbits with higher eccentricity).

### Orbital Placement

- Base distance: 500,000 km minimum
- Geometric spacing factor: 1.3-1.8 per slot (with 0.85-1.15 jitter)
- Maximum orbit: fraction of Hill sphere (1.5x for small worlds, 0.4x for giants)
- Captured rocks orbit further out (up to 2.5x Hill sphere for small worlds)

### Moon Properties

Moons get the same generation pipeline as planets (atmosphere, surface, interior, biosphere, resources), with these differences:

- **Mass**: 10^-5 to 10^-2 of parent mass (captured rocks: 10^-7 to 10^-4)
- **Class**: `rocky` if >0.1 M_earth, otherwise `dwarf`
- **Tidal locking**: to parent if orbit < 1 million km
- **Tidal heating**: estimated for eccentric orbits around massive parents (>100 M_earth)
- **Eccentricity**: proper moons Rayleigh sigma=0.03; captured rocks sigma=0.20
- **Direction**: captured moons have 30% chance of retrograde orbit

### Naming

Moons are named `{PlanetName} {letter}` (e.g., "Volis III a", "Volis III b").

---

## Rendering Colors

Source: `colors.ts`

Colors are derived deterministically (separate RNG seeded from `system.seed + 99999`).

### Planet/Moon Colors by Surface Type

| Surface Type | Color Range |
|-------------|-------------|
| Barren rocky | Grey |
| Volcanic | Orange-red |
| Frozen | Ice blue |
| Desert | Tan-brown |
| Oceanic | Blue |
| Terrestrial | Blue (darker) |
| Greenhouse | Gold-yellow |
| Carbon | Near-black |
| Lava | Bright red |
| Ice-rock | Beige |
| Gas giant | Amber-brown |
| Ice giant | Cyan-teal |
| Mini-neptune | Slate blue |

### Asteroid Colors

| Composition | Color |
|-------------|-------|
| Carbonaceous | Dark olive |
| Silicate | Warm grey |
| Metallic | Light grey |
| Icy | Pale blue |

---

## Conversion to Game Bodies

`systemToBodies()` in `system.ts` converts the rich `GeneratedSystem` into the flat `CelestialBody[]` array used by the game simulation. Each body gets:

- Keplerian orbital elements (a, e, omega, M0, epoch, mu, direction)
- Rendering properties (color, radius)
- Hierarchy (parentId linking moons to planets, planets to star)

The function also places a **jump gate** in orbit, positioned to avoid overlapping planet orbits.

`findStartingBody()` selects the player's spawn location with priority: habitable-zone rocky/super-earth > largest rocky world > any planet.
