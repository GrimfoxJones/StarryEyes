import { WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { SessionStore } from '../session.js';
import type { GameServer } from '../GameServer.js';
import { EVENT_PLAYER_JOINED, EVENT_PLAYER_LEFT } from './events.js';

export function setupWebSocket(
  server: Server,
  sessions: SessionStore,
  game: GameServer,
  broadcast: (message: string) => void,
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token');
    if (!token) {
      socket.destroy();
      return;
    }

    const session = sessions.get(token);
    if (!session) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, session);
    });
  });

  wss.on('connection', (ws, session: { token: string; playerId: string; playerName: string; shipId: string }) => {
    const sess = sessions.get(session.token);
    if (!sess) {
      ws.close();
      return;
    }

    sess.ws = ws;
    console.log(`WebSocket connected: ${sess.playerName} (${sess.shipId})`);

    // Notify others (include full ship snapshot so clients can add the ship)
    const ship = game.ships.find(s => s.id === sess.shipId);
    broadcast(JSON.stringify({
      type: EVENT_PLAYER_JOINED,
      gameTime: game.gameTime,
      data: {
        playerId: sess.playerId,
        playerName: sess.playerName,
        shipId: sess.shipId,
        ship: ship ? game.shipSnapshot(ship) : null,
      },
    }));

    // Send initial full snapshot
    ws.send(JSON.stringify({
      type: 'INITIAL_STATE',
      gameTime: game.gameTime,
      data: game.snapshot(),
    }));

    ws.on('close', () => {
      console.log(`WebSocket disconnected: ${sess.playerName}`);
      sess.ws = null;

      broadcast(JSON.stringify({
        type: EVENT_PLAYER_LEFT,
        gameTime: game.gameTime,
        data: {
          playerId: sess.playerId,
          playerName: sess.playerName,
          shipId: sess.shipId,
        },
      }));
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for ${sess.playerName}:`, err.message);
    });
  });

  return wss;
}
