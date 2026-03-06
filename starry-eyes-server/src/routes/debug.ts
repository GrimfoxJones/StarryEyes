import { Router } from 'express';
import type { GameServer } from '../GameServer.js';
import type { SessionStore } from '../session.js';
import { extractToken } from './auth.js';

export function debugRoutes(game: GameServer, sessions: SessionStore): Router {
  const router = Router();

  router.get('/info', (_req, res) => {
    res.json({ worldSeed: game.worldSeed });
  });

  router.post('/randomize-system', (req, res) => {
    const { seed } = req.body as { seed?: number };
    const result = game.randomizeSystem(seed);
    res.json({
      seed: result.seed,
      starName: result.starName,
      planetCount: result.planetCount,
      bodyCount: result.bodies.length,
    });
  });

  router.post('/jump-to-system', (req, res) => {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ error: 'Missing authorization token' });
      return;
    }
    const session = sessions.get(token);
    if (!session) {
      res.status(401).json({ error: 'Invalid session token' });
      return;
    }
    const { targetSystemIndex } = req.body as { targetSystemIndex: number };
    if (targetSystemIndex == null || typeof targetSystemIndex !== 'number') {
      res.status(400).json({ error: 'Missing targetSystemIndex' });
      return;
    }
    const result = game.debugJumpToSystem(session.shipId, targetSystemIndex);
    if (!result.ship) {
      res.status(400).json({ error: 'Jump failed' });
      return;
    }
    res.json({ ship: result.ship });
  });

  return router;
}
