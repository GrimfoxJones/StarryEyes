import { WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { SessionStore } from '../session.js';
import type { GameServer } from '../GameServer.js';
import { EVENT_PLAYER_JOINED, EVENT_PLAYER_LEFT } from './events.js';

export function setupWebSocket(
  server: Server,
  sessions: SessionStore,
  game: GameServer,
  _broadcast: (message: string) => void,
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

    // Determine player's system
    const sysIndex = game.playerSystems.get(sess.shipId) ?? 0;

    // Notify others in same system
    const ship = game.ships.find(s => s.id === sess.shipId);
    game.broadcastToSystem(sysIndex, EVENT_PLAYER_JOINED, {
      playerId: sess.playerId,
      playerName: sess.playerName,
      shipId: sess.shipId,
      ship: ship ? game.shipSnapshot(ship) : null,
    });

    // Send initial full snapshot scoped to player's system
    ws.send(JSON.stringify({
      type: 'INITIAL_STATE',
      gameTime: game.gameTime,
      data: game.snapshotForSystem(sysIndex),
    }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { type: string; data?: unknown };
        switch (msg.type) {
          case 'SUBSCRIBE_SUBSYSTEMS':
            sess.subsystemsSubscribed = true;
            break;
          case 'UNSUBSCRIBE_SUBSYSTEMS':
            sess.subsystemsSubscribed = false;
            break;
          case 'SUBSYSTEM_COMMAND':
            game.handleSubsystemCommand(sess.shipId, msg.data);
            break;
          case 'SUBSCRIBE_MARKET': {
            const marketData = msg.data as { stationId: string } | undefined;
            if (marketData?.stationId) {
              sess.marketSubscription = marketData.stationId;
              // Send initial market data
              const sysIndex = game.playerSystems.get(sess.shipId) ?? 0;
              const economy = game.getEconomy(sysIndex);
              if (economy) {
                const listings = economy.getMarketListings(marketData.stationId);
                ws.send(JSON.stringify({
                  type: 'MARKET_UPDATE',
                  gameTime: game.gameTime,
                  data: { stationId: marketData.stationId, listings },
                }));
              }
            }
            break;
          }
          case 'UNSUBSCRIBE_MARKET':
            sess.marketSubscription = null;
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      console.log(`WebSocket disconnected: ${sess.playerName}`);
      sess.ws = null;
      sess.subsystemsSubscribed = false;
      sess.marketSubscription = null;

      const currentSysIndex = game.playerSystems.get(sess.shipId) ?? 0;
      game.broadcastToSystem(currentSysIndex, EVENT_PLAYER_LEFT, {
        playerId: sess.playerId,
        playerName: sess.playerName,
        shipId: sess.shipId,
      });
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for ${sess.playerName}:`, err.message);
    });
  });

  return wss;
}
