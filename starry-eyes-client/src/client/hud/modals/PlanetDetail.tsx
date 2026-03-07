import { useEffect, useState } from 'react';
import type { ObjectType } from '../store.ts';
import { useGameStore } from '../store.ts';
import {
  formatMassEarth,
  formatRadiusKm,
  formatTemperature,
  formatPressure,
  formatRotation,
  formatGravity,
  formatSpeed,
  snakeCaseToTitle,
} from '../format.ts';

interface PlanetDetailProps {
  objectId: string;
  objectType: ObjectType;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DetailResponse = { type: string; data: any; parentPlanet?: string; settlement?: any; stationCount?: number; station?: any; settled?: any };

export function PlanetDetail({ objectId, objectType }: PlanetDetailProps) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bridge = useGameStore((s) => s.bridge);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDetail(null);

    const headers: Record<string, string> = {};
    const token = bridge?.getSessionToken?.();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`/api/bodies/${encodeURIComponent(objectId)}/detail`, { headers })
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? 'No detail available' : `HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setDetail(data as DetailResponse))
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [objectId]);

  if (loading) return <div className="detail-loading">Loading detail data...</div>;
  if (error) return <div className="detail-error">{error}</div>;
  if (!detail) return null;

  const { type, data } = detail;

  if (type === 'star') return <StarDetail data={data} settlement={detail.settlement} stationCount={detail.stationCount} />;
  if (type === 'asteroid') return <AsteroidDetail data={data} station={detail.station} />;
  return <BodyDetail data={data} bodyType={type} parentPlanet={detail.parentPlanet} station={detail.station} settled={detail.settled} />;
}

// ── Star Detail ──────────────────────────────────────────────────────

const SPECTRAL_LABELS: Record<string, string> = {
  O: 'O-type (Blue)', B: 'B-type (Blue-White)', A: 'A-type (White)',
  F: 'F-type (Yellow-White)', G: 'G-type (Yellow)', K: 'K-type (Orange)',
  M: 'M-type (Red Dwarf)', red_giant: 'Red Giant', white_dwarf: 'White Dwarf',
  brown_dwarf: 'Brown Dwarf', neutron_star: 'Neutron Star', t_tauri: 'T Tauri',
};

const SETTLEMENT_LABELS: Record<string, string> = {
  unexplored: 'Unexplored',
  surveyed: 'Surveyed',
  outpost: 'Outpost',
  settled: 'Settled',
  developed: 'Developed',
  prime: 'Prime',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StarDetail({ data, settlement, stationCount }: { data: any; settlement?: any; stationCount?: number }) {
  const sc = data.spectralClass as string;
  const isSpecial = ['red_giant', 'white_dwarf', 'brown_dwarf', 'neutron_star', 't_tauri'].includes(sc);
  const classification = isSpecial
    ? (SPECTRAL_LABELS[sc] ?? sc)
    : `${sc}${data.spectralSubclass} ${data.luminosityClass}`;

  return (
    <div className="detail-sections">
      <Section title="CLASSIFICATION">
        <Row label="Spectral Class" value={SPECTRAL_LABELS[sc] ?? sc} />
        <Row label="Classification" value={classification} />
      </Section>
      <Section title="PHYSICAL PARAMETERS">
        <Row label="Surface Temperature" value={formatTemperature(data.surfaceTemperature)} />
        <Row label="Luminosity" value={formatSolarLuminosity(data.luminositySolar)} />
        <Row label="Mass" value={formatSolarMass(data.mass)} />
        <Row label="Radius" value={formatRadiusKm(data.radius)} />
        <Row label="Age" value={formatAge(data.age)} />
        <Row label="Metallicity" value={`[Fe/H] ${(data.metallicity as number).toFixed(2)}`} />
      </Section>
      {settlement && (
        <Section title="SETTLEMENT">
          <Row label="Settlement Level" value={SETTLEMENT_LABELS[settlement.settlementLevel] ?? settlement.settlementLevel} />
          <Row label="Score" value={`${(settlement.score * 100).toFixed(0)}%`} />
          <Row label="Resource Diversity" value={`${(settlement.resourceDiversity * 100).toFixed(0)}%`} />
          <Row label="Habitability" value={`${(settlement.habitability * 100).toFixed(0)}%`} />
          <Row label="Stations" value={String(stationCount ?? 0)} />
        </Section>
      )}
    </div>
  );
}

// ── Asteroid Detail ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AsteroidDetail({ data, station }: { data: any; station?: any }) {
  return (
    <div className="detail-sections">
      <Section title="CLASSIFICATION">
        <Row label="Shape" value={snakeCaseToTitle(data.shape)} />
        <Row label="Composition" value={snakeCaseToTitle(data.composition)} />
      </Section>
      <Section title="PHYSICAL PARAMETERS">
        <Row label="Mass" value={formatMassEarth(data.mass)} />
        <Row label="Radius" value={formatRadiusKm(data.radius)} />
        <Row label="Density" value={`${data.density.toFixed(0)} kg/m\u00B3`} />
        <Row label="Rotation" value={formatRotation(data.rotationPeriod)} />
      </Section>
      <ResourceSection resources={data.resources} />
      <StationSection station={station} />
    </div>
  );
}

// ── Planet / Moon Detail ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BodyDetail({ data, bodyType, parentPlanet, station, settled }: { data: any; bodyType: string; parentPlanet?: string; station?: any; settled?: any }) {
  const phys = data.physical;
  const atmo = data.atmosphere;
  const surf = data.surface;
  const bio = data.biosphere;
  const rings = data.rings;

  return (
    <div className="detail-sections">
      <Section title="CLASSIFICATION">
        <Row label="Class" value={snakeCaseToTitle(data.planetClass)} />
        {bodyType === 'moon' && parentPlanet && <Row label="Parent" value={parentPlanet} />}
        {phys.tidallyLocked && <Row label="Tidally Locked" value="Yes" />}
        {data.tidallyLockedToParent && <Row label="Tidally Locked" value="Yes" />}
        {data.capturedBody && <Row label="Captured Body" value="Yes" />}
      </Section>

      <Section title="PHYSICAL PARAMETERS">
        <Row label="Mass" value={formatMassEarth(phys.mass)} />
        <Row label="Radius" value={formatRadiusKm(phys.radius)} />
        <Row label="Density" value={`${phys.density.toFixed(0)} kg/m\u00B3`} />
        <Row label="Surface Gravity" value={formatGravity(phys.surfaceGravity)} />
        <Row label="Escape Velocity" value={formatSpeed(phys.escapeVelocity)} />
        <Row label="Rotation Period" value={formatRotation(phys.rotationPeriod)} />
        <Row label="Axial Tilt" value={`${phys.axialTilt.toFixed(1)}\u00B0`} />
        <Row label="Magnetic Field" value={snakeCaseToTitle(phys.magneticField)} />
        <Row label="Surface Temp" value={formatTemperature(phys.surfaceTemperature)} />
      </Section>

      {atmo.present && (
        <Section title="ATMOSPHERE">
          <Row label="Breathable" value={atmo.breathable ? 'Yes' : 'No'} />
          <Row label="Pressure" value={formatPressure(atmo.surfacePressure)} />
          <Row label="Greenhouse Effect" value={`+${atmo.greenhouseEffect.toFixed(0)} K`} />
          {atmo.composition.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {atmo.composition.slice(0, 5).map((g: { gas: string; fraction: number }) => (
                <div className="detail-gas-row" key={g.gas}>
                  <span className="detail-row-label">{snakeCaseToTitle(g.gas)}</span>
                  <div className="detail-gas-bar">
                    <div className="detail-gas-fill" style={{ width: Math.max(2, g.fraction * 80) }} />
                    <span className="detail-row-value">{(g.fraction * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {atmo.hazards.length > 0 && (
            <div className="detail-tags" style={{ marginTop: 6 }}>
              {atmo.hazards.map((h: string) => (
                <span key={h} className="detail-tag detail-tag--hazard">{snakeCaseToTitle(h)}</span>
              ))}
            </div>
          )}
        </Section>
      )}

      {surf && (
        <Section title="SURFACE">
          <Row label="Type" value={snakeCaseToTitle(surf.surfaceType)} />
          <Row label="Volcanism" value={snakeCaseToTitle(surf.volcanism)} />
          <Row label="Tectonics" value={surf.tectonicallyActive ? 'Active' : 'Inactive'} />
          {surf.surfaceLiquid && (
            <>
              <Row label="Liquid" value={snakeCaseToTitle(surf.surfaceLiquid.type)} />
              <Row label="Coverage" value={`${(surf.surfaceLiquid.coverage * 100).toFixed(0)}%`} />
            </>
          )}
          {surf.surfaceFeatures.length > 0 && (
            <div className="detail-tags" style={{ marginTop: 4 }}>
              {surf.surfaceFeatures.map((f: string) => (
                <span key={f} className="detail-tag">{snakeCaseToTitle(f)}</span>
              ))}
            </div>
          )}
        </Section>
      )}

      {bio.present && (
        <Section title="BIOSPHERE">
          <Row label="Complexity" value={snakeCaseToTitle(bio.complexity)} />
          <Row label="Biomass" value={snakeCaseToTitle(bio.biomass)} />
          <Row label="Oxygen Producing" value={bio.oxygenProducing ? 'Yes' : 'No'} />
          {bio.biomeTypes.length > 0 && (
            <div className="detail-tags" style={{ marginTop: 4 }}>
              {bio.biomeTypes.map((b: string) => (
                <span key={b} className="detail-tag detail-tag--biome">{snakeCaseToTitle(b)}</span>
              ))}
            </div>
          )}
          {bio.hazards.length > 0 && (
            <div className="detail-tags" style={{ marginTop: 4 }}>
              {bio.hazards.map((h: string) => (
                <span key={h} className="detail-tag detail-tag--hazard">{snakeCaseToTitle(h)}</span>
              ))}
            </div>
          )}
        </Section>
      )}

      {rings?.present && (
        <Section title="RINGS">
          <Row label="Composition" value={snakeCaseToTitle(rings.composition)} />
          <Row label="Inner Radius" value={formatRadiusKm(rings.innerRadius)} />
          <Row label="Outer Radius" value={formatRadiusKm(rings.outerRadius)} />
          <Row label="Opacity" value={`${(rings.opacity * 100).toFixed(0)}%`} />
        </Section>
      )}

      <ResourceSection resources={data.resources} />
      <SettlementSection settled={settled} atmo={atmo} surf={surf} />
      <StationSection station={station} />
    </div>
  );
}

// ── Settlement Section ────────────────────────────────────────────────

function deriveHabitatType(atmo: any, surf: any): string {
  if (atmo?.breathable) return 'Surface';
  if (atmo?.present && atmo.surfacePressure > 0.01) {
    // Atmosphere present but not breathable — domes
    if (surf?.volcanism === 'extreme' || surf?.surfaceType === 'lava') return 'Underground';
    return 'Dome';
  }
  // No meaningful atmosphere — underground
  return 'Underground';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SettlementSection({ settled, atmo, surf }: { settled?: any; atmo?: any; surf?: any }) {
  if (!settled) return null;
  const habitatType = deriveHabitatType(atmo, surf);
  return (
    <Section title="SURFACE SETTLEMENT">
      <Row label="Population" value={formatPopulation(settled.surfacePopulation)} />
      <Row label="Habitat Type" value={habitatType} />
      <Row label="Surface Gravity" value={`${settled.surfaceGravityG.toFixed(2)}g`} />
      <Row label="Habitability" value={`${(settled.habitabilityScore * 100).toFixed(0)}%`} />
    </Section>
  );
}

function formatPopulation(pop: number): string {
  if (pop >= 1e6) return `${(pop / 1e6).toFixed(1)}M`;
  if (pop >= 1e3) return `${(pop / 1e3).toFixed(1)}K`;
  return String(pop);
}

// ── Shared Components ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="detail-section-title">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-row-label">{label}</span>
      <span className="detail-row-value">{value}</span>
    </div>
  );
}

const RESOURCE_LABELS: [string, string][] = [
  ['waterAvailability', 'Water'],
  ['rareMetals', 'Rare Metals'],
  ['commonMetals', 'Common Metals'],
  ['radioactives', 'Radioactives'],
  ['hydrocarbons', 'Hydrocarbons'],
  ['volatiles', 'Volatiles'],
  ['exotics', 'Exotics'],
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ResourceSection({ resources }: { resources: any }) {
  if (!resources) return null;
  return (
    <Section title="RESOURCES">
      {RESOURCE_LABELS.map(([key, label]) => {
        const level = (resources[key] ?? 'none') as string;
        return (
          <div className="detail-resource-row" key={key}>
            <span className="detail-row-label">{label}</span>
            <span className="detail-resource-level" data-level={level}>{level}</span>
          </div>
        );
      })}
    </Section>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StationSection({ station }: { station?: any }) {
  if (!station) return null;
  return (
    <>
      <Section title="STATION">
        <Row label="Name" value={station.name} />
        <Row label="Type" value={snakeCaseToTitle(station.archetype)} />
        <Row label="Kind" value={station.kind === 'orbital' ? 'Orbital Station' : 'Ground Base'} />
        {station.archetypeDef && (
          <Row label="Population Cap" value={String(station.archetypeDef.populationCap)} />
        )}
        {station.economy && (
          <>
            <Row label="Population" value={String(station.economy.population)} />
            <Row label="Supply Score" value={`${station.economy.supplyScore}%`} />
          </>
        )}
      </Section>
      {station.archetypeDef?.facilities && station.archetypeDef.facilities.length > 0 && (
        <Section title="FACILITIES">
          {station.archetypeDef.facilities.map((f: { type: string; commodity: string }, i: number) => (
            <Row key={i} label={snakeCaseToTitle(f.type)} value={snakeCaseToTitle(f.commodity)} />
          ))}
        </Section>
      )}
    </>
  );
}

// ── Local format helpers ─────────────────────────────────────────────

function formatSolarMass(kg: number): string {
  const solar = kg / 1.989e30;
  return `${solar.toFixed(2)} M\u2609`;
}

function formatSolarLuminosity(solar: number): string {
  if (solar >= 1000) return `${(solar / 1000).toFixed(1)}k L\u2609`;
  if (solar >= 1) return `${solar.toFixed(1)} L\u2609`;
  return `${solar.toFixed(3)} L\u2609`;
}

function formatAge(years: number): string {
  if (years >= 1e9) return `${(years / 1e9).toFixed(1)} Gyr`;
  if (years >= 1e6) return `${(years / 1e6).toFixed(0)} Myr`;
  return `${(years / 1e3).toFixed(0)} kyr`;
}
