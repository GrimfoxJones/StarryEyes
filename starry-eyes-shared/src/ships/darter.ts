import type { SubsystemNode } from '../subsystems.js';

export const DARTER_SCHEMATIC_ID = 'darter-freighter';

/** Darter-class Light Freighter mass configuration */
export const DARTER_MASS = {
  hull: 14000,
  maxCargo: 40000,
  maxPropellant: 8000,
  fuelConsumptionRate: 0.02, // kg/s at full thrust
  maxAcceleration: 9.81, // m/s² (~1g)
} as const;

/** Darter-class Light Freighter subsystem tree template */
export const DARTER_DEFINITION: SubsystemNode = {
  id: 'ship',
  name: 'Darter-class Light Freighter',
  category: 'structural',
  status: 'NOMINAL',
  values: {},
  children: [
    // ── Navigation ────────────────────────────────────────────────
    {
      id: 'navigation',
      name: 'Navigation',
      category: 'navigation',
      status: 'NOMINAL',
      values: {
        status: { value: 'IDLE', control: 'simulated', displayHint: 'enum' },
        speed: { value: '0 m/s', control: 'simulated', displayHint: 'enum' },
        destination: { value: '--', control: 'simulated', displayHint: 'enum' },
        destination_eta: { value: '--', control: 'simulated', displayHint: 'enum' },
        route_fuel_cost: { value: 0, unit: 'kg', precision: 1, control: 'simulated', displayHint: 'number', interpolation: 'snap' },
        delta_v_remaining: { value: 0, unit: 'm/s', precision: 0, control: 'simulated', displayHint: 'number' },
      },
      children: [
        {
          id: 'navigation.route_details',
          name: 'Route Details',
          category: 'navigation',
          status: 'NOMINAL',
          values: {
            departure_body: { value: '--', control: 'simulated', displayHint: 'enum' },
            arrival_body: { value: '--', control: 'simulated', displayHint: 'enum' },
            transit_distance: { value: 0, unit: 'km', precision: 0, control: 'simulated', displayHint: 'number', interpolation: 'snap' },
            transit_time: { value: 0, unit: 's', precision: 0, control: 'simulated', displayHint: 'number', interpolation: 'snap' },
            time_elapsed: { value: 0, unit: 's', precision: 0, control: 'simulated', displayHint: 'number' },
            acceleration_phase: { value: 'NONE', control: 'simulated', displayHint: 'enum' },
            flip_point_eta: { value: 0, unit: 's', precision: 0, control: 'simulated', displayHint: 'number' },
            arrival_velocity: { value: 0, unit: 'm/s', precision: 1, control: 'simulated', displayHint: 'number' },
          },
          children: [],
        },
      ],
    },

    // ── Drive ─────────────────────────────────────────────────────
    {
      id: 'drive',
      name: 'FLARE Drive',
      category: 'propulsion',
      status: 'OFFLINE',
      values: {
        status: { value: 'OFFLINE', control: 'simulated', displayHint: 'enum' },
        throttle: { value: 0, min: 0, max: 1, precision: 2, control: 'controlled', displayHint: 'gauge' },
        thrust_output: { value: 0, unit: 'kN', precision: 1, min: 0, max: 180, control: 'simulated', displayHint: 'gauge' },
        max_thrust: { value: 180, unit: 'kN', precision: 0, control: 'simulated', displayHint: 'number' },
        current_acceleration: { value: 0, unit: 'm/s\u00B2', precision: 2, control: 'simulated', displayHint: 'number' },
        fuel_flow_rate: { value: 0, unit: 'kg/s', precision: 3, control: 'simulated', displayHint: 'number' },
        exhaust_velocity: { value: 31000, unit: 'm/s', precision: 0, control: 'simulated', displayHint: 'number' },
        specific_impulse: { value: 3160, unit: 's', precision: 0, control: 'simulated', displayHint: 'number' },
        drive_temperature: { value: 280, unit: 'K', precision: 0, min: 0, max: 2000, warnThreshold: 1200, criticalThreshold: 1600, control: 'simulated', displayHint: 'gauge' },
        heat_generation: { value: 0, unit: 'MW', precision: 1, control: 'simulated', displayHint: 'number' },
      },
      children: [
        {
          id: 'drive.tuning',
          name: 'Drive Tuning',
          category: 'propulsion',
          status: 'NOMINAL',
          values: {
            reaction_mass_ratio: { value: 0.72, min: 0.3, max: 1.0, precision: 2, control: 'controlled', displayHint: 'slider' },
            magnetic_nozzle_ratio: { value: 0.85, min: 0.5, max: 1.0, precision: 2, control: 'controlled', displayHint: 'slider' },
          },
          children: [],
        },
      ],
    },

    // ── Reactor ───────────────────────────────────────────────────
    {
      id: 'reactor',
      name: 'Fusion Reactor',
      category: 'power',
      status: 'NOMINAL',
      values: {
        status: { value: 'NOMINAL', control: 'simulated', displayHint: 'enum', interpolation: 'snap' },
        power_output: { value: 200, unit: 'MW', precision: 1, min: 0, max: 200, control: 'simulated', displayHint: 'gauge', interpolation: 'exponential' },
        target_output: { value: 200, unit: 'MW', precision: 0, min: 0, max: 200, control: 'player', displayHint: 'slider' },
        load: { value: 0, min: 0, max: 1, precision: 2, control: 'simulated', displayHint: 'bar', interpolation: 'exponential' },
        core_temperature: { value: 280, unit: 'K', precision: 0, min: 0, max: 5000, warnThreshold: 3500, criticalThreshold: 4500, control: 'simulated', displayHint: 'gauge', interpolation: 'exponential' },
        fuel_remaining: { value: 1.0, min: 0, max: 1, precision: 3, control: 'simulated', warnBelow: 0.2, criticalBelow: 0.05, displayHint: 'bar' },
        heat_generation: { value: 0, unit: 'MW', precision: 1, control: 'simulated', displayHint: 'number', interpolation: 'exponential' },
      },
      children: [
        {
          id: 'reactor.core',
          name: 'Reactor Core',
          category: 'power',
          status: 'NOMINAL',
          values: {
            plasma_temperature: { value: 0, unit: 'MK', precision: 1, control: 'simulated', displayHint: 'number', interpolation: 'exponential' },
            plasma_density: { value: 0, unit: '\u00D710\u00B2\u2070/m\u00B3', precision: 2, control: 'simulated', displayHint: 'number', interpolation: 'exponential' },
            confinement_field: { value: 0, unit: 'T', precision: 2, min: 0, max: 12, control: 'controlled', displayHint: 'gauge', interpolation: 'exponential' },
            fuel_injection_rate: { value: 0, unit: 'mg/s', precision: 1, min: 0, max: 100, control: 'controlled', displayHint: 'slider', interpolation: 'exponential' },
            core_pressure: { value: 0, unit: 'MPa', precision: 2, control: 'simulated', displayHint: 'number', interpolation: 'exponential' },
            neutron_flux: { value: 0, precision: 1, control: 'simulated', displayHint: 'number', interpolation: 'exponential' },
          },
          children: [],
        },
      ],
    },

    // ── Thermal ───────────────────────────────────────────────────
    {
      id: 'thermal',
      name: 'Thermal Management',
      category: 'thermal',
      status: 'NOMINAL',
      values: {
        status: { value: 'NOMINAL', control: 'simulated', displayHint: 'enum' },
        total_heat_load: { value: 0, unit: 'MW', precision: 1, control: 'simulated', displayHint: 'number' },
        total_rejection: { value: 0, unit: 'MW', precision: 1, control: 'simulated', displayHint: 'number' },
        net_heat: { value: 0, unit: 'MW', precision: 1, control: 'simulated', displayHint: 'number' },
        hull_temperature: { value: 280, unit: 'K', precision: 0, min: 0, max: 1000, warnThreshold: 400, criticalThreshold: 600, control: 'simulated', displayHint: 'gauge' },
      },
      children: [
        {
          id: 'thermal.radiators',
          name: 'Radiators',
          category: 'thermal',
          status: 'NOMINAL',
          values: {
            deployed: { value: true, control: 'controlled', displayHint: 'toggle' },
            deployment_fraction: { value: 1.0, min: 0, max: 1, precision: 2, control: 'controlled', displayHint: 'slider' },
            surface_temperature: { value: 280, unit: 'K', precision: 0, control: 'simulated', displayHint: 'number' },
            rejection_rate: { value: 0, unit: 'MW', precision: 1, control: 'simulated', displayHint: 'number' },
            area: { value: 500, unit: 'm\u00B2', precision: 0, control: 'simulated', displayHint: 'number' },
          },
          children: [],
        },
        {
          id: 'thermal.heat_sinks',
          name: 'Heat Sinks',
          category: 'thermal',
          status: 'NOMINAL',
          values: {
            capacity: { value: 6000, unit: 'MJ', precision: 0, control: 'simulated', displayHint: 'number' },
            stored: { value: 0, unit: 'MJ', precision: 1, min: 0, max: 6000, control: 'simulated', displayHint: 'bar' },
            fill_fraction: { value: 0, min: 0, max: 1, precision: 3, control: 'simulated', displayHint: 'bar' },
            time_to_full: { value: '--', control: 'simulated', displayHint: 'enum' },
          },
          children: [],
        },
      ],
    },

    // ── Sensors ───────────────────────────────────────────────────
    {
      id: 'sensors',
      name: 'Sensor Suite',
      category: 'sensors',
      status: 'NOMINAL',
      values: {
        mode: { value: 'PASSIVE', control: 'player', displayHint: 'enum' },
      },
      children: [
        {
          id: 'sensors.passive',
          name: 'Passive Sensors',
          category: 'sensors',
          status: 'NOMINAL',
          values: {},
          children: [
            {
              id: 'sensors.passive.visual',
              name: 'Visual',
              category: 'sensors',
              status: 'NOMINAL',
              values: {
                enabled: { value: true, control: 'player', displayHint: 'toggle' },
                range: { value: 80000, unit: 'km', precision: 0, control: 'simulated', displayHint: 'number' },
                resolution: { value: 'low', control: 'simulated', displayHint: 'enum' },
                power_draw: { value: 0.5, unit: 'MW', precision: 1, control: 'simulated', displayHint: 'number' },
              },
              children: [],
            },
            {
              id: 'sensors.passive.infrared',
              name: 'Infrared',
              category: 'sensors',
              status: 'NOMINAL',
              values: {
                enabled: { value: true, control: 'player', displayHint: 'toggle' },
                range: { value: 60000, unit: 'km', precision: 0, control: 'simulated', displayHint: 'number' },
                resolution: { value: 'medium', control: 'simulated', displayHint: 'enum' },
                power_draw: { value: 1.2, unit: 'MW', precision: 1, control: 'simulated', displayHint: 'number' },
              },
              children: [],
            },
          ],
        },
        {
          id: 'sensors.active',
          name: 'Active Sensors',
          category: 'sensors',
          status: 'OFFLINE',
          values: {},
          children: [
            {
              id: 'sensors.active.radar',
              name: 'Radar',
              category: 'sensors',
              status: 'OFFLINE',
              values: {
                enabled: { value: false, control: 'player', displayHint: 'toggle' },
                range: { value: 100000, unit: 'km', precision: 0, control: 'simulated', displayHint: 'number' },
                resolution: { value: 'high', control: 'simulated', displayHint: 'enum' },
                power_draw: { value: 15, unit: 'MW', precision: 1, control: 'simulated', displayHint: 'number' },
              },
              children: [],
            },
            {
              id: 'sensors.active.lidar',
              name: 'Lidar',
              category: 'sensors',
              status: 'OFFLINE',
              values: {
                enabled: { value: false, control: 'player', displayHint: 'toggle' },
                range: { value: 40000, unit: 'km', precision: 0, control: 'simulated', displayHint: 'number' },
                resolution: { value: 'very_high', control: 'simulated', displayHint: 'enum' },
                power_draw: { value: 8, unit: 'MW', precision: 1, control: 'simulated', displayHint: 'number' },
              },
              children: [],
            },
          ],
        },
      ],
    },

    // ── Propellant ────────────────────────────────────────────────
    {
      id: 'propellant',
      name: 'Fuel Storage',
      category: 'propellant',
      status: 'NOMINAL',
      values: {
        total_capacity: { value: 8000, unit: 'kg', precision: 0, control: 'simulated', displayHint: 'number', interpolation: 'snap' },
        total_remaining: { value: 8000, unit: 'kg', precision: 1, min: 0, max: 8000, warnBelow: 1600, criticalBelow: 400, control: 'simulated', displayHint: 'bar', interpolation: 'snap' },
        mass_fraction: { value: 1.0, min: 0, max: 1, precision: 3, control: 'simulated', displayHint: 'bar', interpolation: 'snap' },
      },
      children: [
        {
          id: 'propellant.tank_1',
          name: 'Main Tank 1',
          category: 'propellant',
          status: 'NOMINAL',
          values: {
            capacity: { value: 4000, unit: 'kg', precision: 0, control: 'simulated', displayHint: 'number', interpolation: 'snap' },
            level: { value: 4000, unit: 'kg', precision: 1, min: 0, max: 4000, control: 'simulated', displayHint: 'bar', interpolation: 'snap' },
            mass_fraction: { value: 1.0, min: 0, max: 1, precision: 3, control: 'simulated', displayHint: 'bar', interpolation: 'snap' },
            type: { value: 'hydrogen', control: 'simulated', displayHint: 'enum' },
            pressure: { value: 35, unit: 'MPa', precision: 1, control: 'simulated', displayHint: 'number' },
          },
          children: [],
        },
        {
          id: 'propellant.tank_2',
          name: 'Main Tank 2',
          category: 'propellant',
          status: 'NOMINAL',
          values: {
            capacity: { value: 4000, unit: 'kg', precision: 0, control: 'simulated', displayHint: 'number', interpolation: 'snap' },
            level: { value: 4000, unit: 'kg', precision: 1, min: 0, max: 4000, control: 'simulated', displayHint: 'bar', interpolation: 'snap' },
            mass_fraction: { value: 1.0, min: 0, max: 1, precision: 3, control: 'simulated', displayHint: 'bar', interpolation: 'snap' },
            type: { value: 'hydrogen', control: 'simulated', displayHint: 'enum' },
            pressure: { value: 35, unit: 'MPa', precision: 1, control: 'simulated', displayHint: 'number' },
          },
          children: [],
        },
      ],
    },

    // ── Cargo ─────────────────────────────────────────────────────
    {
      id: 'cargo',
      name: 'Cargo Storage',
      category: 'cargo',
      status: 'OFFLINE',
      values: {
        total_capacity: { value: 40000, unit: 'kg', precision: 0, control: 'simulated', displayHint: 'number', interpolation: 'snap' },
        total_used: { value: 0, unit: 'kg', precision: 0, min: 0, max: 40000, control: 'simulated', displayHint: 'bar', interpolation: 'snap' },
        mass_fraction: { value: 0, min: 0, max: 1, precision: 3, control: 'simulated', displayHint: 'bar', interpolation: 'snap' },
      },
      children: [
        {
          id: 'cargo.hold_main',
          name: 'Main Hold',
          category: 'cargo',
          status: 'OFFLINE',
          values: {
            capacity: { value: 40000, unit: 'kg', precision: 0, control: 'simulated', displayHint: 'number' },
            used: { value: 0, unit: 'kg', precision: 0, min: 0, max: 40000, control: 'simulated', displayHint: 'bar' },
          },
          children: [],
        },
      ],
    },

    // ── Comms ─────────────────────────────────────────────────────
    {
      id: 'comms',
      name: 'Communications',
      category: 'comms',
      status: 'NOMINAL',
      values: {
        transponder: { value: true, control: 'player', displayHint: 'toggle' },
        transponder_id: { value: 'DTR-7741', control: 'simulated', displayHint: 'enum' },
      },
      children: [
        {
          id: 'comms.antenna',
          name: 'Antenna',
          category: 'comms',
          status: 'NOMINAL',
          values: {
            power_draw: { value: 0.2, unit: 'MW', precision: 1, control: 'simulated', displayHint: 'number' },
            range: { value: 120000, unit: 'km', precision: 0, control: 'simulated', displayHint: 'number' },
          },
          children: [],
        },
      ],
    },

    // ── Structural ────────────────────────────────────────────────
    {
      id: 'structural',
      name: 'Hull & Structure',
      category: 'structural',
      status: 'NOMINAL',
      values: {
        hull_integrity: { value: 1.0, min: 0, max: 1, precision: 3, warnBelow: 0.5, criticalBelow: 0.2, control: 'simulated', displayHint: 'bar' },
        fuel_mass: { value: 8000, unit: 'kg', precision: 0, control: 'simulated', displayHint: 'number', interpolation: 'snap' },
        cargo_mass: { value: 0, unit: 'kg', precision: 0, control: 'simulated', displayHint: 'number', interpolation: 'snap' },
        current_mass: { value: 22000, unit: 'kg', precision: 0, control: 'simulated', displayHint: 'number', interpolation: 'snap' },
      },
      children: [
        {
          id: 'structural.design',
          name: 'Design Specs',
          category: 'structural',
          status: 'NOMINAL',
          values: {
            empty_mass: { value: 14000, unit: 'kg', precision: 0, control: 'simulated', displayHint: 'number' },
            gross_mass: { value: 62000, unit: 'kg', precision: 0, control: 'simulated', displayHint: 'number' },
            max_fuel: { value: 8000, unit: 'kg', precision: 0, control: 'simulated', displayHint: 'number' },
            max_cargo: { value: 40000, unit: 'kg', precision: 0, control: 'simulated', displayHint: 'number' },
          },
          children: [],
        },
      ],
    },
  ],
};
