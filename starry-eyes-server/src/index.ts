import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { SessionStore } from './session.js';
import { GameServer } from './GameServer.js';
import { setupWebSocket } from './ws/handler.js';
import { authRoutes } from './routes/auth.js';
import { stateRoutes } from './routes/state.js';
import { commandRoutes } from './routes/commands.js';
import { debugRoutes } from './routes/debug.js';
import { PORT } from './config.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);

// Core state
const sessions = new SessionStore();

// Broadcast helper — sends to all connected WebSocket clients
function broadcast(message: string): void {
  for (const session of sessions.allConnected()) {
    if (session.ws && session.ws.readyState === 1) { // WebSocket.OPEN = 1
      session.ws.send(message);
    }
  }
}

const game = new GameServer(sessions, broadcast);

// WebSocket
setupWebSocket(server, sessions, game, broadcast);

// REST routes
app.use('/api/auth', authRoutes(sessions, game, broadcast));
app.use('/api', stateRoutes(game, sessions));
app.use('/api/commands', commandRoutes(sessions, game));
app.use('/api/debug', debugRoutes(game, sessions));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, gameTime: game.gameTime, players: sessions.allConnected().length });
});

// Graceful shutdown — ensures port is freed even if pnpm doesn't forward signals
function shutdown(): void {
  console.log('Shutting down...');
  game.stop();
  server.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start
game.start();
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} in use — killing stale process...`);
    import('child_process').then(({ execSync }) => {
      try {
        const out = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, { encoding: 'utf8' });
        const pid = out.trim().split(/\s+/).pop();
        if (pid) {
          execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' });
          console.log(`Killed PID ${pid}, retrying...`);
          setTimeout(() => server.listen(PORT), 1000);
        }
      } catch {
        console.error(`Could not kill process on port ${PORT}. Kill it manually and retry.`);
        process.exit(1);
      }
    });
  } else {
    throw err;
  }
});
server.listen(PORT, () => {
  console.log(`StarryEyes server listening on http://localhost:${PORT}`);
});
