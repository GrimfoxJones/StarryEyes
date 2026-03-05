import { useEffect, useMemo } from 'react';
import { useGameStore } from '../store.ts';
import { ModalContent } from './ModalContent.tsx';
import './DetailModal.css';

export function DetailModal() {
  const modal = useGameStore((s) => s.modal);
  const dismissModal = useGameStore((s) => s.dismissModal);
  const bodies = useGameStore((s) => s.snapshot?.bodies);

  useEffect(() => {
    if (!modal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        dismissModal();
      }
    };
    // Use capture to intercept before other Escape handlers
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [modal, dismissModal]);

  const displayName = useMemo(() => {
    if (!modal || !bodies) return '';
    const body = bodies.find(b => b.id === modal.objectId);
    return body?.name ?? modal.objectId;
  }, [modal, bodies]);

  if (!modal) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={dismissModal} />
      <div className="modal-panel">
        <div className="modal-header">
          <span className="modal-title">{displayName}</span>
          <button className="modal-close" onClick={dismissModal} title="Close (Escape)">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <ModalContent objectId={modal.objectId} objectType={modal.objectType} />
        </div>
      </div>
    </>
  );
}
