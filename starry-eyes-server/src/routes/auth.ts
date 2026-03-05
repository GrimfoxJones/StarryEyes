import { Router } from 'express';
import type { SessionStore } from '../session.js';
import type { GameServer } from '../GameServer.js';

export function authRoutes(sessions: SessionStore, game: GameServer, _broadcast: (msg: string) => void): Router {
  const router = Router();

  router.post('/join', (req, res) => {
    const playerName = (req.body as { playerName?: string })?.playerName ?? `Player_${Date.now().toString(36)}`;
    const session = sessions.create(playerName);

    // Create ship in game world (starting system 0)
    game.addShip(session.shipId, 0);

    console.log(`Player joined: ${playerName} → ship ${session.shipId}`);

    res.json({
      sessionToken: session.token,
      shipId: session.shipId,
      playerId: session.playerId,
      playerName: session.playerName,
      gameTime: game.gameTime,
      systemIndex: 0,
    });
  });

  router.post('/leave', (req, res) => {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ error: 'Missing authorization token' });
      return;
    }

    const session = sessions.get(token);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Close WebSocket if active
    if (session.ws) {
      session.ws.close();
    }

    // Remove ship and session
    game.removeShip(session.shipId);
    sessions.remove(token);

    console.log(`Player left: ${session.playerName}`);

    res.json({ ok: true });
  });

  return router;
}

export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') return parts[1];
  return null;
}
