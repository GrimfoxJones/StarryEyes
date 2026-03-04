export function PlanetInfo({ objectId }: { objectId: string }) {
  return (
    <>
      <div className="info-popup-header">
        <span className="info-popup-title">{objectId}</span>
        <span className="info-popup-type">PLANET</span>
      </div>
      <div className="info-popup-body">
        <div className="info-popup-row">
          <span className="info-popup-row-label">Type</span>
          <span className="info-popup-row-value">Rocky</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Orbit</span>
          <span className="info-popup-row-value">--</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Period</span>
          <span className="info-popup-row-value">--</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Stations</span>
          <span className="info-popup-row-value">0</span>
        </div>
      </div>
    </>
  );
}
