import { v4 as uuidv4 } from 'uuid';
import type { WebSocket } from 'ws';

export interface Session {
  token: string;
  playerId: string;
  playerName: string;
  shipId: string;
  ws: WebSocket | null;
}

export class SessionStore {
  private sessions = new Map<string, Session>();

  create(playerName: string): Session {
    const token = uuidv4();
    const playerId = uuidv4();
    const shipId = `ship_${playerId.slice(0, 8)}`;
    const session: Session = { token, playerId, playerName, shipId, ws: null };
    this.sessions.set(token, session);
    return session;
  }

  get(token: string): Session | undefined {
    return this.sessions.get(token);
  }

  remove(token: string): void {
    this.sessions.delete(token);
  }

  allConnected(): Session[] {
    return [...this.sessions.values()].filter(s => s.ws !== null);
  }

  all(): Session[] {
    return [...this.sessions.values()];
  }
}
