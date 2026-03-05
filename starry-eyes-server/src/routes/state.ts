import { Router } from 'express';
import type { GameServer } from '../GameServer.js';
import type { SessionStore } from '../session.js';
import { extractToken } from './auth.js';

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

    const bodies = systemBodies.map(b => ({
      id: b.id,
      name: b.name,
      type: b.type,
      mass: b.mass,
      radius: b.radius,
      color: b.color,
      elements: b.elements,
      parentId: b.parentId,
      planetClass: b.planetClass,
    }));
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

    // Star
    if (sys.star.id === id) {
      res.json({ type: 'star', data: sys.star });
      return;
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
        });
        return;
      }

      // Moons
      for (const moon of planet.moons) {
        if (moon.id === id) {
          res.json({ type: 'moon', parentPlanet: planet.name, data: moon });
          return;
        }
      }
    }

    // Asteroids
    for (const asteroid of sys.asteroids) {
      if (asteroid.id === id) {
        res.json({ type: 'asteroid', data: asteroid });
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
