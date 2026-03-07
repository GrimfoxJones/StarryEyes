import { Router } from 'express';
import type { GameServer } from '../GameServer.js';
import type { SessionStore } from '../session.js';
import { extractToken } from './auth.js';
import { computeSettlement, STATION_ARCHETYPE_DEFS } from '@starryeyes/shared';
import type { StationArchetype } from '@starryeyes/shared';

export function stateRoutes(game: GameServer, sessions: SessionStore): Router {
  const router = Router();

  router.get('/state', (req, res) => {
    const token = extractToken(req.headers.authorization);
    const session = token ? sessions.get(token) : null;
    if (session) {
      res.json(game.snapshotForPlayer(session.shipId));
    } else {
      res.json(game.snapshot());
    }
  });

  router.get('/bodies', (req, res) => {
    const token = extractToken(req.headers.authorization);
    const session = token ? sessions.get(token) : null;
    const sysIndex = session ? (game.playerSystems.get(session.shipId) ?? 0) : 0;
    const systemBodies = game.getBodiesForSystem(sysIndex);

    const sys = game.getGeneratedSystemFor(sysIndex);
    const bodies = systemBodies.map(b => {
      const station = sys.stations[b.id];
      return {
        id: b.id,
        name: b.name,
        type: b.type,
        mass: b.mass,
        radius: b.radius,
        color: b.color,
        elements: b.elements,
        parentId: b.parentId,
        planetClass: b.planetClass,
        ...(station ? { hasStation: true, stationArchetype: station.archetype } : {}),
        ...(sys.settledBodies[b.id] ? { isSettled: true } : {}),
      };
    });
    res.json({ bodies });
  });

  router.get('/ships', (_req, res) => {
    res.json({ ships: game.ships.map(s => game.shipSnapshot(s)) });
  });

  // On-demand detail for a single body (procgen data)
  router.get('/bodies/:id/detail', (req, res) => {
    const id = req.params.id;
    const token = extractToken(req.headers.authorization);
    const session = token ? sessions.get(token) : null;
    const sysIndex = session ? (game.playerSystems.get(session.shipId) ?? 0) : 0;
    const sys = game.getGeneratedSystemFor(sysIndex);

    // Star — include settlement info
    if (sys.star.id === id) {
      const settlement = computeSettlement(sys, sysIndex);
      res.json({
        type: 'star',
        data: sys.star,
        settlement,
        stationCount: Object.keys(sys.stations).length,
      });
      return;
    }

    // Helper: build station info for a body if it has one
    function stationInfo(bodyId: string) {
      const stationData = sys.stations[bodyId];
      if (!stationData) return undefined;
      const archetype = stationData.archetype as StationArchetype;
      const archetypeDef = STATION_ARCHETYPE_DEFS[archetype];
      const economy = game.getEconomy(sysIndex);
      const economyState = economy?.getState(bodyId);
      return {
        ...stationData,
        archetypeDef: archetypeDef ? {
          name: archetypeDef.name,
          facilities: archetypeDef.facilities,
          consumptionProfile: archetypeDef.consumptionProfile,
          basePopulation: archetypeDef.basePopulation,
          populationCap: archetypeDef.populationCap,
        } : null,
        economy: economyState ? {
          population: Math.round(economyState.population),
          supplyScore: Math.round(economyState.supplyScore * 100),
        } : null,
      };
    }

    // Helper: build settled body info if it exists
    function settledInfo(bodyId: string) {
      const settled = sys.settledBodies[bodyId];
      if (!settled) return undefined;
      return settled;
    }

    // Planets
    for (const planet of sys.planets) {
      if (planet.id === id) {
        const { moons, ...rest } = planet;
        res.json({
          type: 'planet',
          data: {
            ...rest,
            moons: moons.map(m => ({ id: m.id, name: m.name })),
          },
          station: stationInfo(id),
          settled: settledInfo(id),
        });
        return;
      }

      // Moons
      for (const moon of planet.moons) {
        if (moon.id === id) {
          res.json({ type: 'moon', parentPlanet: planet.name, data: moon, station: stationInfo(id), settled: settledInfo(id) });
          return;
        }
      }
    }

    // Asteroids
    for (const asteroid of sys.asteroids) {
      if (asteroid.id === id) {
        res.json({ type: 'asteroid', data: asteroid, station: stationInfo(id) });
        return;
      }
    }

    res.status(404).json({ error: 'Body not found' });
  });

  // Lightweight sync endpoint
  router.get('/sync', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const session = sessions.get(auth.slice(7));
    if (!session) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }
    const ship = game.ships.find(s => s.id === session.shipId);
    res.json({
      gameTime: game.gameTime,
      ship: ship ? game.shipSnapshot(ship) : null,
    });
  });

  // Gate connections for current system
  router.get('/gate-connections', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const session = sessions.get(auth.slice(7));
    if (!session) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }
    const sysIndex = game.playerSystems.get(session.shipId) ?? 0;
    const connections = game.getGateConnectionsForSystem(sysIndex);
    res.json({ connections, systemIndex: sysIndex });
  });

  return router;
}
