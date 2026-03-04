export function ShipInfo({ objectId }: { objectId: string }) {
  return (
    <>
      <div className="info-popup-header">
        <span className="info-popup-title">{objectId}</span>
        <span className="info-popup-type">CONTACT</span>
      </div>
      <div className="info-popup-body">
        <div className="info-popup-row">
          <span className="info-popup-row-label">ID</span>
          <span className="info-popup-row-value">{objectId}</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Bearing</span>
          <span className="info-popup-row-value">--</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Range</span>
          <span className="info-popup-row-value">--</span>
        </div>
        <div className="info-popup-row">
          <span className="info-popup-row-label">Velocity</span>
          <span className="info-popup-row-value">--</span>
        </div>
      </div>
    </>
  );
}
