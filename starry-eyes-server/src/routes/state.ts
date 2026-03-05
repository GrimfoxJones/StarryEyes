import { Router } from 'express';
import type { GameServer } from '../GameServer.js';
import type { SessionStore } from '../session.js';

export function stateRoutes(game: GameServer, sessions: SessionStore): Router {
  const router = Router();

  router.get('/state', (_req, res) => {
    res.json(game.snapshot());
  });

  router.get('/bodies', (_req, res) => {
    const bodies = game.bodies.map(b => ({
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
    const sys = game.generatedSystem;
    if (!sys) {
      res.status(404).json({ error: 'No generated system' });
      return;
    }

    // Star
    if (sys.star.id === id) {
      res.json({ type: 'star', data: sys.star });
      return;
    }

    // Planets
    for (const planet of sys.planets) {
      if (planet.id === id) {
        // Strip full moon data, return only id/name list
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

  // Lightweight sync endpoint — returns server gameTime + the player's ship
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

  return router;
}
