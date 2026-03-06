import { useMemo } from 'react';
import { useGameStore } from '../store.ts';
import { SchematicViewer } from './SchematicViewer.tsx';
import { SectionHighlight } from './SectionHighlight.tsx';
import { FuelGauge } from './FuelGauge.tsx';
import { shipSchematic, compartments } from './ship-overview.schematic.ts';
import { reactorSchematic } from './reactor.schematic.ts';
import { extractReactorParams } from './reactorParamsFromSnapshot.ts';
import { driveSchematic } from './drive.schematic.ts';
import { extractDriveParams } from './driveParamsFromSnapshot.ts';
import { getSchematicMapping, getCompartmentsForSubTab, resolveBinding, resolveNodeValue } from './schematic-mapping.ts';

const fuelTanks = compartments.filter(c => c.group === 'fuel');

// Drill node IDs that swap to detail schematics
const REACTOR_DRILL_IDS = new Set(['reactor.core']);
const DRIVE_DRILL_IDS = new Set(['drive.tuning']);

export function SchematicPanel() {
  const activeTab = useGameStore(s => s.activeTab);
  const activeSubTab = useGameStore(s => s.activeSubTab);
  const hoveredSubTab = useGameStore(s => s.hoveredSubTab);
  const sysDrillNodeId = useGameStore(s => s.sysDrillNodeId);
  const subsystemSnapshot = useGameStore(s => s.subsystemSnapshot);

  const effectiveSubTab = hoveredSubTab ?? activeSubTab;
  const mapping = useMemo(() => getSchematicMapping(effectiveSubTab), [effectiveSubTab]);
  const highlightSections = useMemo(() => getCompartmentsForSubTab(effectiveSubTab), [effectiveSubTab]);
  const activeLayers = useMemo(() => mapping.overlayLayers, [mapping]);

  const throttle = useMemo(
    () => resolveNodeValue(subsystemSnapshot, 'drive', 'throttle', 0),
    [subsystemSnapshot],
  );
  const shipDoc = useMemo(
    () => shipSchematic({ shipName: 'DSV NEMESIS-7', fuelFlowRate: throttle, driveThrottle: throttle }),
    [throttle],
  );

  const reactorParams = useMemo(
    () => extractReactorParams(subsystemSnapshot),
    [subsystemSnapshot],
  );
  const reactorDoc = useMemo(() => reactorSchematic(reactorParams), [reactorParams]);

  const driveParams = useMemo(
    () => extractDriveParams(subsystemSnapshot),
    [subsystemSnapshot],
  );
  const driveDoc = useMemo(() => driveSchematic(driveParams), [driveParams]);

  if (activeTab !== 'SYS') return null;

  // Swap to detail schematics when drilled into subsystem children
  const showReactor = sysDrillNodeId != null && REACTOR_DRILL_IDS.has(sysDrillNodeId);
  const showDrive = !showReactor && sysDrillNodeId != null && DRIVE_DRILL_IDS.has(sysDrillNodeId);
  const showDetail = showReactor || showDrive;

  const showFuel = !showDetail && effectiveSubTab === 'PROPELLANT';

  const overlay = (!showDetail && (highlightSections.length > 0 || showFuel))
    ? () => (
        <>
          <SectionHighlight sections={highlightSections} />
          {showFuel && fuelTanks.map(tank => (
            <FuelGauge
              key={tank.id}
              tank={tank}
              level={resolveBinding(tank.id, subsystemSnapshot)}
            />
          ))}
        </>
      )
    : undefined;

  const doc = showReactor ? reactorDoc : showDrive ? driveDoc : shipDoc;

  // Fixed aspect ratio matching ship overview (900:450 = 2:1)
  // so swapping schematics doesn't change the panel height
  return (
    <div style={{ aspectRatio: '900 / 450', background: doc.background ?? '#040c14', overflow: 'hidden' }}>
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SchematicViewer
          doc={doc}
          activeLayers={!showDetail && activeLayers.length > 0 ? activeLayers : undefined}
          overlay={overlay}
          hideHeader
          hideClassification
        />
      </div>
    </div>
  );
}
