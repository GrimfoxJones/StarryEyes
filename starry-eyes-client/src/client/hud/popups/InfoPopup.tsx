import { useGameStore } from '../store.ts';
import { PopupContent } from './PopupContent.tsx';
import './InfoPopup.css';

export function InfoPopup() {
  const popup = useGameStore((s) => s.popup);
  const showModal = useGameStore((s) => s.showModal);
  const showTravelDialog = useGameStore((s) => s.showTravelDialog);
  const snapshot = useGameStore((s) => s.snapshot);

  if (!popup) return null;

  // Viewport-aware positioning: default 20px right, 10px above click
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const popupW = 250;
  const popupH = 200;

  let left = popup.screenX + 20;
  let top = popup.screenY - 10 - popupH;

  // Flip horizontal if near right edge
  if (left + popupW > viewportW - 10) {
    left = popup.screenX - 20 - popupW;
  }

  // Flip vertical if near top edge
  if (top < 10) {
    top = popup.screenY + 20;
  }

  // Clamp to viewport
  if (top + popupH > viewportH - 10) {
    top = viewportH - 10 - popupH;
  }
  if (left < 10) {
    left = 10;
  }

  const canFlyTo = popup.objectType !== 'star' && popup.objectType !== 'ship';
  const body = canFlyTo ? snapshot?.bodies.find((b) => b.id === popup.objectId) : null;

  return (
    <div className="info-popup" style={{ left, top }}>
      <PopupContent objectId={popup.objectId} objectType={popup.objectType} />
      <div className="info-popup-footer">
        {canFlyTo && (
          <button
            className="info-popup-fly-to"
            onClick={() => {
              showTravelDialog({
                destination: { type: 'body', bodyId: popup.objectId },
                targetName: body?.name ?? popup.objectId,
                accelerationG: 1.0,
              });
            }}
          >
            [Fly To]
          </button>
        )}
        <button
          className="info-popup-more"
          onClick={() => showModal({ objectId: popup.objectId, objectType: popup.objectType })}
        >
          [More &rarr;]
        </button>
      </div>
    </div>
  );
}
