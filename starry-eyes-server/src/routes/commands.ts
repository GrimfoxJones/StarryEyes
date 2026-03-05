import { Router } from 'express';
import type { Destination } from '@starryeyes/shared';
import type { SessionStore } from '../session.js';
import type { GameServer } from '../GameServer.js';
import { extractToken } from './auth.js';

export function commandRoutes(sessions: SessionStore, game: GameServer): Router {
  const router = Router();

  // Middleware: require auth
  router.use((req, res, next) => {
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
    // Attach session to request for downstream use
    (req as unknown as { session: typeof session }).session = session;
    next();
  });

  router.post('/set-destination', (req, res) => {
    const session = (req as unknown as { session: { shipId: string } }).session;
    const { destination, acceleration } = req.body as { destination: Destination; acceleration?: number };
    if (!destination) {
      res.status(400).json({ error: 'Missing destination' });
      return;
    }

    const result = game.processCommand({
      type: 'SET_DESTINATION',
      shipId: session.shipId,
      destination,
      acceleration,
    });

    if (!result.ship) {
      res.status(400).json({ error: 'Failed to set destination (invalid target or insufficient fuel)' });
      return;
    }

    res.json({
      route: result.route,
      fuelConsumed: result.fuelConsumed,
      fuelRemaining: result.fuelRemaining,
      ship: result.ship,
    });
  });

  router.post('/cancel-route', (req, res) => {
    const session = (req as unknown as { session: { shipId: string } }).session;
    const result = game.processCommand({
      type: 'CANCEL_ROUTE',
      shipId: session.shipId,
    });

    res.json({ ship: result.ship ?? null });
  });

  router.post('/undock', (req, res) => {
    const session = (req as unknown as { session: { shipId: string } }).session;
    const result = game.processCommand({
      type: 'UNDOCK',
      shipId: session.shipId,
    });

    res.json({ ship: result.ship ?? null });
  });

  return router;
}
