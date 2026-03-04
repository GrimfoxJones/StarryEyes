export function StationInfo({ objectId }: { objectId: string }) {
  return (
    <>
      <div className="info-popup-header">
        <span className="info-popup-title">{objectId}</span>
        <span className="info-popup-type">STATION</span>
      </div>
      <div className="info-popup-body">
        <div className="info-popup-row">
          <span className="info-popup-row-label">Class</span>
          <span className="info-popup-row-value">Trading Post</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Faction</span>
          <span className="info-popup-row-value">Independent</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Services</span>
          <span className="info-popup-row-value">3</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Range</span>
          <span className="info-popup-row-value">--</span>
        </div>
      </div>
    </>
  );
}
