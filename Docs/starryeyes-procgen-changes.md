# StarryEyes — Procedural Generation Changes

**Project:** StarryEyes (Working Title)
**Studio:** Grimfox Games
**Document Type:** Engineering Change Spec
**Date:** March 2026

---

## Overview

This document describes required changes to the procedural generation system (`starry-eyes-shared/src/procgen/`) to support the Phase 3 economy. Most changes are additive — the existing system is solid and maps well onto the commodity design. No existing resource categories need to be removed.

---

## 1. Resource Category Changes

**File:** `resources.ts`

### Add Three New Resource Categories

The existing seven categories (`waterAvailability`, `rareMetals`, `commonMetals`, `radioactives`, `hydrocarbons`, `volatiles`, `exotics`) need three additions to fully cover the commodity list.

#### `silicates`

Silicates are the primary structural and electronics feedstock. They are not currently tracked as a resource despite being well-represented in the interior and surface composition data.

| Body Type | Rating |
|-----------|--------|
| S-type asteroids | Rich → Exceptional |
| Rocky planets / super-earths (silicate mantle) | Moderate → Rich |
| Rocky moons | Moderate |
| M-type asteroids | Poor → Moderate (present but not the primary yield) |
| Ice giants, gas giants | None |

Trigger condition: body has silicate mantle composition or silicate surface type.

#### `carbon`

Solid carbon — graphite, carbides, complex refractory organics. Distinct from hydrocarbons. Stable at high temperatures, found in C-type asteroids and carbon-surface bodies. This is the commodity input for Polymers and Fertilizer.

| Body Type | Rating |
|-----------|--------|
| C-type asteroids | Rich → Exceptional |
| Carbon-surface planets (existing `carbon` surface type) | Moderate → Rich |
| Inner rocky planets | Trace → Poor |
| Any other body | None |

Trigger condition: asteroid composition is `carbonaceous`, or planet surface type is `carbon`.

#### `hydrocarbons`

Volatile carbon-hydrogen compounds — methane ice, ethane, tholins. Found on cold outer bodies and in gas giant atmospheres. **Not wired to any Phase 3 commodity.** Tracked now for future use (chemical feedstocks, alternative fuel precursors, exotic manufacturing). Same treatment as `radioactives`.

| Body Type | Rating |
|-----------|--------|
| Gas giants (cool, CH4-bearing) | Moderate → Rich |
| Ice giants | Moderate |
| Cold/outer zone rocky bodies with carbon surface | Poor → Moderate |
| Titan-analog moons (cold, dense N2/CH4 atmosphere) | Rich |
| Any other body | None |

Trigger condition: gas/ice giant with methane in atmosphere, or cold-zone body with carbon surface type. Existing `hydrocarbons` category already tracks this — verify existing logic covers the above and adjust if needed.

---

### Updated Full Resource Category List

| Category | Phase 3 Commodity | Status |
|----------|------------------|--------|
| `waterAvailability` | Water | Active |
| `commonMetals` | Iron | Active |
| `rareMetals` | Copper, Titanium | Active |
| `silicates` | Silicates | **New — add** |
| `carbon` | Carbon | **New — add** |
| `hydrocarbons` | *(none yet)* | **New — add, future use** |
| `volatiles` | *(none yet)* | Existing, future use |
| `radioactives` | *(none yet)* | Existing, future use |
| `exotics` | *(none yet)* | Existing, future use |

---

### Asteroid Resource Profile Updates

The existing asteroid resource profiles need `silicates` and `carbon` wired in:

| Composition | Resource Ratings |
|-------------|-----------------|
| Carbonaceous | waterAvailability (moderate), hydrocarbons (poor), **carbon (rich)** |
| Silicate | rareMetals (moderate), commonMetals (moderate), **silicates (rich)** |
| Metallic | rareMetals (rich), commonMetals (rich), exotics (moderate), **silicates (poor)** |
| Icy | waterAvailability (rich), volatiles (moderate) |

---

## 2. Settlement Scoring System

**New file:** `settlement.ts`

A deterministic settlement scoring system derived entirely from existing procgen outputs. No new simulation state — scores are computed from `GeneratedSystem` at load time and cached.

### Step 1: Remoteness Score

Derived from system ID alone. System 0 (prime) is the core; higher IDs are more remote.

```typescript
function remotenessScore(systemId: number): number {
  // Exponential decay with long tail
  // k controls dropoff rate — tune so that systems at ID ~1000 are at ~0.8 remoteness
  const k = 0.003;
  return 1 - Math.exp(-k * systemId);
}
```

Output: 0.0 (prime) → 1.0 (fully remote). Never actually reaches 1.0 — the long tail means even very high IDs have a small settlement chance if their resource/habitability score is high enough.

### Step 2: Resource Diversity Score

Rewards balanced multi-resource systems over single-resource bonanzas. Uses all resource categories that have active commodity mappings in Phase 3.

```typescript
const RESOURCE_LEVELS = { none: 0, trace: 0.1, poor: 0.3, moderate: 0.6, rich: 0.85, exceptional: 1.0 };

const ACTIVE_RESOURCES = [
  'waterAvailability',
  'commonMetals',
  'rareMetals',
  'silicates',
  'carbon',
];

function resourceDiversityScore(system: GeneratedSystem): number {
  // Aggregate resource levels across all bodies in the system
  const systemTotals: Record<string, number> = {};

  for (const body of [...system.planets, ...system.asteroids, ...allMoons(system)]) {
    for (const resource of ACTIVE_RESOURCES) {
      const level = RESOURCE_LEVELS[body.resources[resource] ?? 'none'];
      systemTotals[resource] = Math.max(systemTotals[resource] ?? 0, level);
    }
  }

  // Diversity bonus: sum of sqrt(value) per resource, normalized
  // sqrt rewards having many moderate resources over one exceptional one
  const raw = ACTIVE_RESOURCES.reduce((sum, r) => {
    return sum + Math.sqrt(systemTotals[r] ?? 0);
  }, 0);

  return raw / ACTIVE_RESOURCES.length; // 0.0 → 1.0
}
```

### Step 3: Habitability Bonus

A flat additive bonus applied when truly habitable bodies are present. These are rare and dominate settlement regardless of other factors.

```typescript
function habitabilityBonus(system: GeneratedSystem): number {
  let bonus = 0;

  for (const body of allBodiesIncludingMoons(system)) {
    if (body.atmosphere?.breathable) {
      bonus += 0.4; // Breathable atmosphere is the baseline

      if (body.surface?.type === 'oceanic' || body.surface?.type === 'terrestrial') {
        bonus += 0.2; // Liquid water surface
      }

      const complexity = body.biosphere?.complexity;
      if (complexity === 'complex_multicellular') bonus += 0.2;
      else if (complexity === 'simple_multicellular') bonus += 0.1;
    }
  }

  return Math.min(bonus, 1.0); // Cap at 1.0
}
```

### Step 4: Combined Settlement Score

```typescript
function settlementScore(system: GeneratedSystem, systemId: number): number {
  const remoteness = remotenessScore(systemId);
  const resources = resourceDiversityScore(system);
  const habitability = habitabilityBonus(system);

  const baseScore = (resources * 0.5) + (habitability * 0.5);
  return baseScore * (1 - remoteness * 0.8);
}
```

The `0.8` remoteness weight means even a fully remote system retains 20% of its base score — exceptional systems far from prime will still have some presence.

### Step 5: Settlement Level

Map the final score to a discrete settlement level:

| Score | Level | Description |
|-------|-------|-------------|
| < 0.05 | `unexplored` | No permanent presence |
| 0.05–0.20 | `surveyed` | Scientific or prospecting outpost only |
| 0.20–0.40 | `outpost` | Early resource extraction underway |
| 0.40–0.60 | `settled` | Functioning multi-commodity economy |
| 0.60–0.80 | `developed` | Full station archetype range, growing population |
| > 0.80 | `prime` | Dense station network, high population, established trade lanes |

### Station Presence by Settlement Level

| Level | Station Types Spawned |
|-------|----------------------|
| `unexplored` | None |
| `surveyed` | 1 small mining outpost near best resource body |
| `outpost` | 2–3 mining outposts, 1 water depot |
| `settled` | Full commodity range, 1 habitat colony, basic shipyard |
| `developed` | All archetypes, multiple habitat colonies, weapon factory |
| `prime` | Dense networks, military bases, multiple shipyards |

Station placement is determined by resource ratings on individual bodies — a mining outpost goes on the body with the highest relevant resource rating, not randomly.

---

## 3. Initial Economic State

**New file:** `economyState.ts` (or integrate into `settlement.ts`)

When a system is first instantiated, stations need starting stockpile levels. These should be seeded from the settlement level so players entering a developed system find a functioning economy, not empty shelves.

```typescript
function initialStockpileFraction(settlementLevel: SettlementLevel): number {
  // Returns a fraction of target stockpile to start with
  const fractions = {
    surveyed:  0.2,  // Skeletal — mostly empty, high prices
    outpost:   0.4,
    settled:   0.6,
    developed: 0.75,
    prime:     0.9,  // Well-stocked, competitive prices
  };
  return fractions[settlementLevel] ?? 0;
}
```

Starting population follows the same pattern — surveyed systems have skeleton crews, prime systems have established populations near their carrying capacity.

---

## 4. Notes & Constraints

- **All scoring is deterministic.** Same system seed + same system ID always produces the same settlement level. No runtime randomness beyond what the procgen RNG already provides.
- **`radioactives`, `volatiles`, `hydrocarbons`, `exotics`** remain in `resources.ts` and are generated as before. They are not wired to economy commodities in Phase 3 but their data is available for future phases.
- **Settlement level is an output, not an input.** Nothing in procgen changes based on settlement. The scoring reads from the generated system; it does not feed back into generation.
- **Thresholds are tuning targets, not hard values.** The score cutoffs for settlement levels and the formula weights (`0.5`, `0.8`, etc.) will need playtesting adjustment. The structure is correct; the numbers are first-pass estimates.
