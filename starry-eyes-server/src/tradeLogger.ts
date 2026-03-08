import fs from 'node:fs';
import path from 'node:path';

const LOG_DIR = path.resolve(import.meta.dirname, '../../Logs');
const LOG_FILE = path.join(LOG_DIR, 'trades.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export interface TradeLogEntry {
  wallTime: string;       // ISO 8601 real-world timestamp
  gameTime: number;       // in-game seconds
  shipId: string;
  stationId: string;
  action: 'BUY' | 'SELL';
  commodityId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  avgCostBasis: number;   // weighted avg purchase price for this commodity
  creditsAfter: number;
  cargoMassAfter: number;
  maxCargo: number;
}

export function logTrade(entry: TradeLogEntry): void {
  const profitPerUnit = entry.action === 'SELL'
    ? entry.unitPrice - entry.avgCostBasis
    : 0;

  const line = [
    `[${entry.wallTime}]`,
    `GT=${formatGameTime(entry.gameTime)}`,
    entry.action,
    `${entry.quantity}x ${entry.commodityId}`,
    `@ ${entry.unitPrice.toFixed(1)} CR/u`,
    `= ${entry.totalPrice.toFixed(1)} CR`,
    entry.action === 'SELL' ? `profit=${profitPerUnit.toFixed(1)} CR/u` : `avg_cost=${entry.avgCostBasis.toFixed(1)} CR/u`,
    `credits=${entry.creditsAfter.toFixed(0)}`,
    `cargo=${entry.cargoMassAfter}/${entry.maxCargo} kg`,
    `ship=${entry.shipId}`,
    `station=${entry.stationId}`,
  ].join(' | ');

  fs.appendFileSync(LOG_FILE, line + '\n');
}

function formatGameTime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `D${days} ${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
