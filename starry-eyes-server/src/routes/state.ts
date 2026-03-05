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
    }));
    res.json({ bodies });
  });

  router.get('/ships', (_req, res) => {
    res.json({ ships: game.ships.map(s => game.shipSnapshot(s)) });
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
