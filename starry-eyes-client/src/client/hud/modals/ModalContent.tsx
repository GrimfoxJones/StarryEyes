import type { ObjectType } from '../store.ts';
import { PlanetDetail } from './PlanetDetail.tsx';
import { StationDetail } from './StationDetail.tsx';

interface ModalContentProps {
  objectId: string;
  objectType: ObjectType;
}

export function ModalContent({ objectId, objectType }: ModalContentProps) {
  switch (objectType) {
    case 'star':
    case 'planet':
    case 'moon':
    case 'asteroid':
      return <PlanetDetail objectId={objectId} objectType={objectType} />;
    case 'station':
      return <StationDetail objectId={objectId} />;
    case 'ship':
      return (
        <div style={{ padding: 16 }}>
          <div style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)', letterSpacing: 1, marginBottom: 8 }}>
            CONTACT DETAIL
          </div>
          <div style={{ color: 'var(--text-primary)' }}>
            Ship contact: {objectId}
          </div>
          <div style={{ color: 'var(--text-hint)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic', marginTop: 12 }}>
            Detailed ship information not yet available
          </div>
        </div>
      );
  }
}
