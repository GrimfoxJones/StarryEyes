import type { ObjectType } from '../store.ts';
import { PlanetInfo } from './PlanetInfo.tsx';
import { StationInfo } from './StationInfo.tsx';
import { ShipInfo } from './ShipInfo.tsx';

interface PopupContentProps {
  objectId: string;
  objectType: ObjectType;
}

export function PopupContent({ objectId, objectType }: PopupContentProps) {
  switch (objectType) {
    case 'planet':
    case 'moon':
    case 'asteroid':
      return <PlanetInfo objectId={objectId} />;
    case 'station':
      return <StationInfo objectId={objectId} />;
    case 'ship':
      return <ShipInfo objectId={objectId} />;
  }
}
