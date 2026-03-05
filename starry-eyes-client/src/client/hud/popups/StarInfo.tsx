import type { StarInfo as StarInfoData } from '@starryeyes/shared';

interface StarInfoProps {
  objectId: string;
  starInfo?: StarInfoData;
}

const SPECTRAL_LABELS: Record<string, string> = {
  O: 'O-type (Blue)',
  B: 'B-type (Blue-White)',
  A: 'A-type (White)',
  F: 'F-type (Yellow-White)',
  G: 'G-type (Yellow)',
  K: 'K-type (Orange)',
  M: 'M-type (Red Dwarf)',
  red_giant: 'Red Giant',
  white_dwarf: 'White Dwarf',
  brown_dwarf: 'Brown Dwarf',
  neutron_star: 'Neutron Star',
  t_tauri: 'T Tauri',
};

function formatClassification(info: StarInfoData): string {
  const sc = info.spectralClass;
  if (['red_giant', 'white_dwarf', 'brown_dwarf', 'neutron_star', 't_tauri'].includes(sc)) {
    return SPECTRAL_LABELS[sc] ?? sc;
  }
  return `${sc}${info.spectralSubclass} ${info.luminosityClass}`;
}

function formatTemperature(kelvin: number): string {
  if (kelvin >= 10000) return `${(kelvin / 1000).toFixed(0)}k K`;
  return `${kelvin.toFixed(0)} K`;
}

function formatLuminosity(solar: number): string {
  if (solar >= 1000) return `${(solar / 1000).toFixed(1)}k L\u2609`;
  if (solar >= 1) return `${solar.toFixed(1)} L\u2609`;
  return `${solar.toFixed(3)} L\u2609`;
}

function formatMass(solar: number): string {
  return `${solar.toFixed(2)} M\u2609`;
}

function formatAge(years: number): string {
  if (years >= 1e9) return `${(years / 1e9).toFixed(1)} Gyr`;
  if (years >= 1e6) return `${(years / 1e6).toFixed(0)} Myr`;
  return `${(years / 1e3).toFixed(0)} kyr`;
}

function getTypeLabel(info?: StarInfoData): string {
  if (!info) return 'STAR';
  return SPECTRAL_LABELS[info.spectralClass] ?? 'STAR';
}

export function StarInfo({ objectId, starInfo }: StarInfoProps) {
  if (!starInfo) {
    return (
      <>
        <div className="info-popup-header">
          <span className="info-popup-title">{objectId}</span>
          <span className="info-popup-type">STAR</span>
        </div>
        <div className="info-popup-body">
          <div className="info-popup-row">
            <span className="info-popup-row-label">Class</span>
            <span className="info-popup-row-value">--</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="info-popup-header">
        <span className="info-popup-title">{objectId}</span>
        <span className="info-popup-type">{getTypeLabel(starInfo)}</span>
      </div>
      <div className="info-popup-body">
        <div className="info-popup-row">
          <span className="info-popup-row-label">Class</span>
          <span className="info-popup-row-value">{formatClassification(starInfo)}</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Temp</span>
          <span className="info-popup-row-value">{formatTemperature(starInfo.surfaceTemperature)}</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Luminosity</span>
          <span className="info-popup-row-value">{formatLuminosity(starInfo.luminositySolar)}</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Mass</span>
          <span className="info-popup-row-value">{formatMass(starInfo.massSolar)}</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Age</span>
          <span className="info-popup-row-value">{formatAge(starInfo.age)}</span>
        </div>
      </div>
    </>
  );
}
