import { Router } from 'express';
import type { GameServer } from '../GameServer.js';

export function debugRoutes(_game: GameServer): Router {
  const router = Router();
  return router;
}
