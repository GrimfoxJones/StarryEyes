import { Router } from 'express';
import type { GameServer } from '../GameServer.js';

export function debugRoutes(game: GameServer): Router {
  const router = Router();

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

  return router;
}
