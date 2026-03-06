import type { ShipState } from '@starryeyes/shared';
import type { SubsystemNode, SubsystemSnapshot, SubsystemCommand } from '@starryeyes/shared';
import { DARTER_DEFINITION, DARTER_MASS } from '@starryeyes/shared';
import { vec2Length, transitPositionAtTime } from '@starryeyes/shared';

const STEFAN_BOLTZMANN = 5.67e-8; // W/(m²·K⁴)
const WASTE_HEAT_FRACTION = 0.15; // fraction of reactor output that becomes waste heat
const DRIVE_HEAT_FRACTION = 0.10; // fraction of drive thrust power that becomes heat
const REACTOR_TIME_CONSTANT = 3; // seconds — controls ease-out ramp speed
const REACTOR_FUEL_DEPLETION_RATE = 1e-7; // fraction/s at full output
const AMBIENT_TEMP = 3; // space background temperature (K)

function formatSpeed(mps: number): string {
  if (mps > 1000) return `${(mps / 1000).toFixed(1)} km/s`;
  return `${mps.toFixed(0)} m/s`;
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}

function findNode(root: SubsystemNode, id: string): SubsystemNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function setValue(node: SubsystemNode, key: string, value: number | boolean | string): void {
  const sv = node.values[key];
  if (sv) sv.value = value;
}

export class SubsystemSimulator {
  private tree: SubsystemNode;

  // Core simulated state (integrated over time)
  private reactorOutput = 200; // MW — starts at nominal
  private reactorCoreFuel = 1.0; // fraction
  private heatStored = 0; // MJ
  private cargoMass = 0; // kg
  private lastOrbitBodyId: string | null = null; // tracks departure body

  constructor() {
    this.tree = structuredClone(DARTER_DEFINITION);
  }

  tick(gameDt: number, ship: ShipState, gameTime: number, bodyName?: (id: string) => string): void {
    const dt = Math.min(gameDt, 10); // clamp to avoid huge jumps

    // ── Reactor ──────────────────────────────────────────────
    const reactor = findNode(this.tree, 'reactor')!;
    const reactorCore = findNode(this.tree, 'reactor.core')!;
    const targetOutput = (reactor.values['target_output']?.value as number) ?? 200;

    // Exponential ease-out toward target: fast initially, slows as it approaches
    const alpha = 1 - Math.exp(-dt / REACTOR_TIME_CONSTANT);
    this.reactorOutput += (targetOutput - this.reactorOutput) * alpha;

    // Deplete reactor fuel
    const outputFraction = this.reactorOutput / 200;
    this.reactorCoreFuel = Math.max(0, this.reactorCoreFuel - REACTOR_FUEL_DEPLETION_RATE * outputFraction * dt);

    const reactorHeat = this.reactorOutput * WASTE_HEAT_FRACTION;

    // Core derived values
    const plasmaTemp = this.reactorOutput > 0 ? 100 * outputFraction : 0; // in MK (millions of K)
    const plasmaDensity = this.reactorOutput > 0 ? outputFraction : 0; // in units of 10²⁰/m³
    const confinementField = this.reactorOutput > 0 ? 10 * outputFraction : 0;
    const fuelInjection = this.reactorOutput > 0 ? 50 * outputFraction : 0;
    const corePressure = this.reactorOutput > 0 ? 2.5 * outputFraction : 0;
    const neutronFlux = this.reactorOutput > 0 ? 8 * outputFraction : 0;
    const coreTemp = 280 + (plasmaTemp > 0 ? 2500 * outputFraction : 0);

    setValue(reactor, 'power_output', Math.round(this.reactorOutput * 10) / 10);
    setValue(reactor, 'load', 0); // updated below after computing total draw
    setValue(reactor, 'core_temperature', Math.round(coreTemp));
    setValue(reactor, 'fuel_remaining', this.reactorCoreFuel);
    setValue(reactor, 'heat_generation', Math.round(reactorHeat * 10) / 10);
    setValue(reactor, 'status', this.reactorOutput > 0 ? 'NOMINAL' : 'OFFLINE');
    reactor.status = this.reactorOutput > 0 ? 'NOMINAL' : 'OFFLINE';

    setValue(reactorCore, 'plasma_temperature', Math.round(plasmaTemp));
    setValue(reactorCore, 'plasma_density', plasmaDensity);
    setValue(reactorCore, 'confinement_field', Math.round(confinementField * 100) / 100);
    setValue(reactorCore, 'fuel_injection_rate', Math.round(fuelInjection * 10) / 10);
    setValue(reactorCore, 'core_pressure', Math.round(corePressure * 100) / 100);
    setValue(reactorCore, 'neutron_flux', Math.round(neutronFlux * 10) / 10);

    // ── Drive ────────────────────────────────────────────────
    const drive = findNode(this.tree, 'drive')!;
    const tuning = findNode(this.tree, 'drive.tuning')!;
    const reactionMassRatio = (tuning.values['reaction_mass_ratio']?.value as number) ?? 0.72;
    const nozzleRatio = (tuning.values['magnetic_nozzle_ratio']?.value as number) ?? 0.85;

    const totalMass = DARTER_MASS.hull + ship.fuel + this.cargoMass;
    let thrustOutput = 0;
    let driveHeat = 0;
    let fuelFlowRate = 0;
    let throttle = 0;

    const isTransit = ship.mode === 'transit' && ship.route;
    if (isTransit) {
      // Drive is active during transit
      thrustOutput = 180 * reactionMassRatio * nozzleRatio;
      throttle = 1.0;
      fuelFlowRate = ship.fuelConsumptionRate;
      driveHeat = thrustOutput * DRIVE_HEAT_FRACTION;
      drive.status = 'NOMINAL';
      setValue(drive, 'status', 'ACTIVE');
    } else {
      drive.status = this.reactorOutput > 0 ? 'NOMINAL' : 'OFFLINE';
      setValue(drive, 'status', this.reactorOutput > 0 ? 'STANDBY' : 'OFFLINE');
    }

    const exhaustVelocity = 31000 * (1 + (1 - reactionMassRatio) * 0.5);
    const specificImpulse = Math.round(exhaustVelocity / 9.81);
    const currentAccel = totalMass > 0 ? (thrustOutput * 1000) / totalMass : 0;
    const driveTemp = 280 + (isTransit ? 800 * throttle : 0);

    setValue(drive, 'throttle', throttle);
    setValue(drive, 'thrust_output', Math.round(thrustOutput * 10) / 10);
    setValue(drive, 'max_thrust', Math.round(180 * reactionMassRatio * nozzleRatio));
    setValue(drive, 'current_acceleration', Math.round(currentAccel * 100) / 100);
    setValue(drive, 'fuel_flow_rate', Math.round(fuelFlowRate * 1000) / 1000);
    setValue(drive, 'exhaust_velocity', Math.round(exhaustVelocity));
    setValue(drive, 'specific_impulse', specificImpulse);
    setValue(drive, 'drive_temperature', Math.round(driveTemp));
    setValue(drive, 'heat_generation', Math.round(driveHeat * 10) / 10);

    // ── Sensors power draw ───────────────────────────────────
    let sensorPowerDraw = 0;
    const visualSensor = findNode(this.tree, 'sensors.passive.visual');
    const irSensor = findNode(this.tree, 'sensors.passive.infrared');
    const radar = findNode(this.tree, 'sensors.active.radar');
    const lidar = findNode(this.tree, 'sensors.active.lidar');

    if (visualSensor?.values['enabled']?.value === true)
      sensorPowerDraw += (visualSensor.values['power_draw']?.value as number) ?? 0;
    if (irSensor?.values['enabled']?.value === true)
      sensorPowerDraw += (irSensor.values['power_draw']?.value as number) ?? 0;
    if (radar?.values['enabled']?.value === true)
      sensorPowerDraw += (radar.values['power_draw']?.value as number) ?? 0;
    if (lidar?.values['enabled']?.value === true)
      sensorPowerDraw += (lidar.values['power_draw']?.value as number) ?? 0;

    // Update sensor node statuses
    const sensors = findNode(this.tree, 'sensors')!;
    const passiveSensors = findNode(this.tree, 'sensors.passive')!;
    const activeSensors = findNode(this.tree, 'sensors.active')!;
    sensors.status = 'NOMINAL';
    passiveSensors.status = 'NOMINAL';
    const hasActiveSensor = radar?.values['enabled']?.value === true || lidar?.values['enabled']?.value === true;
    activeSensors.status = hasActiveSensor ? 'NOMINAL' : 'OFFLINE';
    if (radar) radar.status = radar.values['enabled']?.value === true ? 'NOMINAL' : 'OFFLINE';
    if (lidar) lidar.status = lidar.values['enabled']?.value === true ? 'NOMINAL' : 'OFFLINE';

    // Update reactor load
    const totalPowerDraw = sensorPowerDraw + 0.2; // + comms antenna
    const load = this.reactorOutput > 0 ? totalPowerDraw / this.reactorOutput : 0;
    setValue(reactor, 'load', Math.min(Math.round(load * 100) / 100, 1));

    // ── Thermal ──────────────────────────────────────────────
    const thermal = findNode(this.tree, 'thermal')!;
    const radiators = findNode(this.tree, 'thermal.radiators')!;
    const heatSinks = findNode(this.tree, 'thermal.heat_sinks')!;

    const deployed = radiators.values['deployed']?.value !== false;
    const deployFrac = deployed ? ((radiators.values['deployment_fraction']?.value as number) ?? 1.0) : 0;
    const radArea = 500; // m² effective radiator area (high-efficiency heat-pipe panels)
    const emissivity = 0.95; // near-blackbody coated panels
    const totalHeat = reactorHeat + driveHeat;

    // Radiator surface temp: driven by both incoming heat and stored heat bleeding out.
    // Stored heat raises the radiator temp above what steady-state input alone would require,
    // so radiators actively drain the heat sinks when they have excess capacity.
    const effectiveArea = radArea * deployFrac * emissivity;
    const heatSinkCapacity = 6000; // MJ
    const thermalLoad = totalHeat + this.heatStored * 0.01; // sinks bleed into radiator loop (MW)
    let surfaceTemp: number;
    if (effectiveArea > 0 && thermalLoad > 0) {
      const t4 = (thermalLoad * 1e6) / (STEFAN_BOLTZMANN * effectiveArea) + Math.pow(AMBIENT_TEMP, 4);
      surfaceTemp = Math.pow(t4, 0.25);
    } else {
      surfaceTemp = 280 + (this.heatStored / 100);
    }
    surfaceTemp = Math.max(surfaceTemp, 280);

    // Stefan-Boltzmann rejection at current surface temp
    const rejection = effectiveArea > 0
      ? STEFAN_BOLTZMANN * effectiveArea * (Math.pow(surfaceTemp, 4) - Math.pow(AMBIENT_TEMP, 4)) / 1e6
      : 0;

    const netHeat = totalHeat - rejection;

    // Update heat stored
    if (netHeat > 0) {
      this.heatStored = Math.min(this.heatStored + netHeat * dt, heatSinkCapacity);
    } else {
      this.heatStored = Math.max(0, this.heatStored + netHeat * dt);
    }

    const fillFraction = this.heatStored / heatSinkCapacity;
    const timeToFull = netHeat > 0 ? (heatSinkCapacity - this.heatStored) / netHeat : Infinity;

    // Determine thermal status
    if (fillFraction > 0.9) thermal.status = 'CRITICAL';
    else if (fillFraction > 0.6) thermal.status = 'WARNING';
    else thermal.status = 'NOMINAL';

    setValue(thermal, 'status', thermal.status);
    setValue(thermal, 'total_heat_load', Math.round(totalHeat * 10) / 10);
    setValue(thermal, 'total_rejection', Math.round(rejection * 10) / 10);
    setValue(thermal, 'net_heat', Math.round(netHeat * 10) / 10);
    setValue(thermal, 'hull_temperature', Math.round(280 + this.heatStored / 100));

    setValue(radiators, 'surface_temperature', Math.round(surfaceTemp));
    setValue(radiators, 'rejection_rate', Math.round(rejection * 10) / 10);

    setValue(heatSinks, 'stored', Math.round(this.heatStored * 10) / 10);
    setValue(heatSinks, 'fill_fraction', Math.round(fillFraction * 1000) / 1000);
    setValue(heatSinks, 'time_to_full', isFinite(timeToFull) && timeToFull > 0 ? formatEta(timeToFull) : '\u221E');

    // ── Navigation ───────────────────────────────────────────
    const nav = findNode(this.tree, 'navigation')!;
    const routeDetails = findNode(this.tree, 'navigation.route_details')!;

    // Compute speed: during transit, derive from route; otherwise from ship velocity
    let speed: number;
    if (ship.mode === 'transit' && ship.route) {
      const result = transitPositionAtTime(ship.route, gameTime);
      speed = vec2Length(result.velocity);
    } else {
      speed = vec2Length(ship.velocity);
    }

    // Track last orbited body as departure reference
    if (ship.orbitBodyId) this.lastOrbitBodyId = ship.orbitBodyId;

    const resolveName = (id: string | null) => {
      if (!id) return '--';
      return bodyName ? bodyName(id) : id;
    };

    let navStatus = 'IDLE';
    if (ship.mode === 'transit') navStatus = 'IN_TRANSIT';
    else if (ship.mode === 'orbit') navStatus = 'IN_ORBIT';
    else if (ship.mode === 'drift' && speed > 1) navStatus = 'DRIFTING';

    // Delta-V remaining: Tsiolkovsky rocket equation
    const mDry = DARTER_MASS.hull + this.cargoMass;
    const mTotal = mDry + ship.fuel;
    const deltaV = mDry > 0 && ship.fuel > 0 ? exhaustVelocity * Math.log(mTotal / mDry) : 0;

    setValue(nav, 'status', navStatus);
    setValue(nav, 'speed', formatSpeed(speed));
    setValue(nav, 'delta_v_remaining', Math.round(deltaV));
    nav.status = 'NOMINAL';

    if (ship.route) {
      const elapsed = gameTime - ship.route.startTime;
      const remaining = Math.max(0, ship.route.totalTime - elapsed);
      setValue(nav, 'destination_eta', formatEta(remaining));
      setValue(nav, 'route_fuel_cost', Math.round(ship.route.fuelConsumptionRate * ship.route.totalTime * 10) / 10);
      setValue(nav, 'destination', resolveName(ship.route.targetBodyId));

      setValue(routeDetails, 'departure_body', resolveName(this.lastOrbitBodyId));
      setValue(routeDetails, 'arrival_body', ship.route.targetBodyId ? resolveName(ship.route.targetBodyId) : 'SPACE');
      setValue(routeDetails, 'transit_distance', Math.round(ship.route.arcLength / 1000));
      setValue(routeDetails, 'transit_time', Math.round(ship.route.totalTime));
      setValue(routeDetails, 'time_elapsed', Math.round(elapsed));

      const halfTime = ship.route.totalTime / 2;
      const isDecel = elapsed > halfTime;
      setValue(routeDetails, 'acceleration_phase', isDecel ? 'DECELERATING' : 'ACCELERATING');
      setValue(routeDetails, 'flip_point_eta', Math.round(Math.max(0, halfTime - elapsed)));
      setValue(routeDetails, 'arrival_velocity', 0);
    } else {
      setValue(nav, 'destination_eta', '--');
      setValue(nav, 'route_fuel_cost', 0);
      setValue(nav, 'destination', '--');

      setValue(routeDetails, 'departure_body', '--');
      setValue(routeDetails, 'arrival_body', '--');
      setValue(routeDetails, 'transit_distance', 0);
      setValue(routeDetails, 'transit_time', 0);
      setValue(routeDetails, 'time_elapsed', 0);
      setValue(routeDetails, 'acceleration_phase', 'NONE');
      setValue(routeDetails, 'flip_point_eta', 0);
      setValue(routeDetails, 'arrival_velocity', 0);
    }

    // ── Propellant (read from ship state) ────────────────────
    const propellant = findNode(this.tree, 'propellant')!;
    const tank1 = findNode(this.tree, 'propellant.tank_1')!;
    const tank2 = findNode(this.tree, 'propellant.tank_2')!;
    const fuelFraction = ship.fuel / DARTER_MASS.maxPropellant;

    setValue(propellant, 'total_remaining', Math.round(ship.fuel * 10) / 10);
    setValue(propellant, 'mass_fraction', Math.round((ship.fuel / totalMass) * 1000) / 1000);
    propellant.status = fuelFraction < 0.05 ? 'CRITICAL' : fuelFraction < 0.2 ? 'WARNING' : 'NOMINAL';

    // Split fuel evenly across both tanks
    const perTank = ship.fuel / 2;
    const tankCapacity = 4000;
    const tankFraction = Math.round((perTank / tankCapacity) * 1000) / 1000;
    const tankPressure = Math.round(35 * (perTank / tankCapacity) * 10) / 10;

    setValue(tank1, 'level', Math.round(perTank * 10) / 10);
    setValue(tank1, 'mass_fraction', tankFraction);
    setValue(tank1, 'pressure', tankPressure);

    setValue(tank2, 'level', Math.round(perTank * 10) / 10);
    setValue(tank2, 'mass_fraction', tankFraction);
    setValue(tank2, 'pressure', tankPressure);

    // ── Cargo ────────────────────────────────────────────────
    const cargo = findNode(this.tree, 'cargo')!;
    const holdMain = findNode(this.tree, 'cargo.hold_main')!;
    const cargoFraction = this.cargoMass / DARTER_MASS.maxCargo;

    setValue(cargo, 'total_used', Math.round(this.cargoMass));
    setValue(cargo, 'mass_fraction', Math.round((this.cargoMass / totalMass) * 1000) / 1000);
    cargo.status = this.cargoMass > 0 ? 'NOMINAL' : 'OFFLINE';

    setValue(holdMain, 'used', Math.round(this.cargoMass));
    holdMain.status = this.cargoMass > 0 ? 'NOMINAL' : 'OFFLINE';

    // ── Comms ────────────────────────────────────────────────
    const comms = findNode(this.tree, 'comms')!;
    comms.status = 'NOMINAL';

    // ── Structural ───────────────────────────────────────────
    const structural = findNode(this.tree, 'structural')!;
    structural.status = 'NOMINAL';
    setValue(structural, 'fuel_mass', Math.round(ship.fuel));
    setValue(structural, 'cargo_mass', Math.round(this.cargoMass));
    setValue(structural, 'current_mass', Math.round(totalMass));
  }

  snapshot(gameTime: number): SubsystemSnapshot {
    return {
      gameTime,
      root: structuredClone(this.tree),
    };
  }

  applyCommand(cmd: SubsystemCommand): void {
    if (cmd.type === 'SET_VALUE') {
      const node = findNode(this.tree, cmd.nodeId);
      if (!node) return;
      const sv = node.values[cmd.key];
      if (!sv) return;
      // Only allow setting player or controlled values
      if (sv.control === 'player' || sv.control === 'controlled') {
        sv.value = cmd.value;
      }
    }
  }
}
