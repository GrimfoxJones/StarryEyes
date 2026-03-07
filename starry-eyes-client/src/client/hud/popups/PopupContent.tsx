import type { ObjectType } from '../store.ts';
import { useGameStore } from '../store.ts';
import { PlanetInfo } from './PlanetInfo.tsx';
import { ShipInfo } from './ShipInfo.tsx';
import { StarInfo } from './StarInfo.tsx';

interface PopupContentProps {
  objectId: string;
  objectType: ObjectType;
}

export function PopupContent({ objectId, objectType }: PopupContentProps) {
  const snapshot = useGameStore((s) => s.snapshot);

  switch (objectType) {
    case 'star': {
      const body = snapshot?.bodies.find((b) => b.id === objectId);
      return <StarInfo objectId={body?.name ?? objectId} starInfo={body?.starInfo} />;
    }
    case 'planet':
    case 'moon':
    case 'asteroid': {
      const body = snapshot?.bodies.find((b) => b.id === objectId);
      return <PlanetInfo objectId={objectId} objectType={objectType} body={body} />;
    }
    case 'ship':
      return <ShipInfo objectId={objectId} />;
  }
}
