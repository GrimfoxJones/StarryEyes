import { Router } from 'express';
import type { SessionStore } from '../session.js';
import type { GameServer } from '../GameServer.js';
import { extractToken } from './auth.js';
import { DARTER_MASS } from '@starryeyes/shared';

export function economyRoutes(sessions: SessionStore, game: GameServer): Router {
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
    (req as unknown as { session: typeof session }).session = session;
    next();
  });

  router.get('/market/:stationId', (req, res) => {
    const session = (req as unknown as { session: { shipId: string } }).session;
    const sysIndex = game.playerSystems.get(session.shipId) ?? 0;
    const economy = game.getEconomy(sysIndex);
    if (!economy) {
      res.json({ listings: [] });
      return;
    }
    const listings = economy.getMarketListings(req.params.stationId);
    res.json({ listings });
  });

  router.get('/trade-summary', (req, res) => {
    const session = (req as unknown as { session: { shipId: string } }).session;
    const sysIndex = game.playerSystems.get(session.shipId) ?? 0;
    const economy = game.getEconomy(sysIndex);
    if (!economy) {
      res.json({ summaries: [] });
      return;
    }
    const summaries = economy.getTradeSummaries();
    res.json({ summaries });
  });

  router.get('/system-prices', (req, res) => {
    const session = (req as unknown as { session: { shipId: string } }).session;
    const sysIndex = game.playerSystems.get(session.shipId) ?? 0;
    const economy = game.getEconomy(sysIndex);
    if (!economy) {
      res.json({ averages: {} });
      return;
    }
    res.json({ averages: economy.getSystemAverages() });
  });

  router.post('/buy', (req, res) => {
    const session = (req as unknown as { session: { shipId: string } }).session;
    const { stationId, commodityId, quantity } = req.body as { stationId: string; commodityId: string; quantity: number };
    if (!stationId || !commodityId || !quantity || quantity <= 0) {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }

    const result = game.processCommand({
      type: 'BUY_COMMODITY',
      shipId: session.shipId,
      stationId,
      commodityId,
      quantity,
    });

    const tradeResult = (result as { tradeResult?: unknown }).tradeResult;
    res.json(tradeResult ?? { success: false, error: 'Trade failed' });
  });

  router.post('/sell', (req, res) => {
    const session = (req as unknown as { session: { shipId: string } }).session;
    const { stationId, commodityId, quantity } = req.body as { stationId: string; commodityId: string; quantity: number };
    if (!stationId || !commodityId || !quantity || quantity <= 0) {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }

    const result = game.processCommand({
      type: 'SELL_COMMODITY',
      shipId: session.shipId,
      stationId,
      commodityId,
      quantity,
    });

    const tradeResult = (result as { tradeResult?: unknown }).tradeResult;
    res.json(tradeResult ?? { success: false, error: 'Trade failed' });
  });

  router.post('/refuel', (req, res) => {
    const session = (req as unknown as { session: { shipId: string } }).session;
    const { amount } = req.body as { amount: number };
    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    const result = game.processCommand({
      type: 'REFUEL',
      shipId: session.shipId,
      amount,
    });

    const refuelResult = (result as { refuelResult?: unknown }).refuelResult;
    res.json(refuelResult ?? { success: false, error: 'Refuel failed' });
  });

  router.get('/cargo', (req, res) => {
    const session = (req as unknown as { session: { shipId: string } }).session;
    const cargo = game.shipCargo.get(session.shipId) ?? {};
    const cargoMass = game.getCargoMass(session.shipId);
    const credits = game.playerCredits.get(session.shipId) ?? 0;
    const costBasis = game.playerCostBasis.get(session.shipId) ?? {};
    res.json({ cargo, cargoMass, maxCargo: DARTER_MASS.maxCargo, credits, costBasis });
  });

  return router;
}
