import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store.ts';
import type { MarketListing } from '@starryeyes/shared';
import { COMMODITY_DEFS } from '@starryeyes/shared';
import type { CommodityId } from '@starryeyes/shared';
import type { RemoteBridge } from '../../../../RemoteBridge.ts';

function TrendIndicator({ trend }: { trend: 'rising' | 'falling' | 'stable' }) {
  if (trend === 'rising') return <span style={{ color: 'var(--status-danger)' }}>{'\u25B2'}</span>;
  if (trend === 'falling') return <span style={{ color: 'var(--status-nominal)' }}>{'\u25BC'}</span>;
  return <span style={{ color: 'var(--text-hint)' }}>{'\u2500'}</span>;
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function priceVsAvg(price: number, sysAvg: number, role: 'export' | 'import'): string {
  if (sysAvg <= 0) return 'var(--text-primary)';
  if (role === 'export') {
    // Player buying: green if cheaper than avg
    return price < sysAvg * 0.95 ? 'var(--status-nominal)' : price > sysAvg * 1.05 ? 'var(--status-danger)' : 'var(--text-primary)';
  }
  // Player selling: green if pays more than avg
  return price > sysAvg * 1.05 ? 'var(--status-nominal)' : price < sysAvg * 0.95 ? 'var(--status-danger)' : 'var(--text-primary)';
}

const actionBtnStyle = (enabled: boolean, role: 'export' | 'import') => ({
  background: enabled
    ? (role === 'export' ? 'rgba(0, 200, 100, 0.2)' : 'rgba(255, 150, 0, 0.2)')
    : 'var(--bg-surface)',
  border: '1px solid',
  borderColor: enabled
    ? (role === 'export' ? 'rgba(0, 200, 100, 0.4)' : 'rgba(255, 150, 0, 0.4)')
    : 'var(--border-subtle)',
  color: enabled
    ? (role === 'export' ? 'var(--status-nominal)' : 'var(--status-warning)')
    : 'var(--text-hint)',
  borderRadius: 2,
  fontSize: 10,
  padding: '2px 4px',
  cursor: enabled ? 'pointer' : 'default',
  fontFamily: 'var(--font-mono)',
  flex: 1,
});

export function MarketPanel() {
  const bridge = useGameStore((s) => s.bridge) as RemoteBridge | null;
  const snapshot = useGameStore((s) => s.snapshot);
  const listings = useGameStore((s) => s.marketListings);
  const cargoManifest = useGameStore((s) => s.cargoManifest);
  const cargoMass = useGameStore((s) => s.cargoMass);
  const maxCargo = useGameStore((s) => s.maxCargo);
  const credits = useGameStore((s) => s.credits);
  const costBasis = useGameStore((s) => s.costBasis);

  const [error, setError] = useState<string | null>(null);

  const myShip = snapshot?.ships.find(s => s.id === bridge?.getMyShipId());
  const stationId = myShip?.orbitBodyId ?? null;
  const stationBody = snapshot?.bodies.find(b => b.id === stationId && b.hasStation);

  useEffect(() => {
    if (!bridge || !stationId || !stationBody) return;
    bridge.subscribeMarket(stationId);
    bridge.fetchCargo();
    return () => { bridge.unsubscribeMarket(); };
  }, [bridge, stationId, stationBody]);

  const executeTrade = useCallback(async (commodityId: string, qty: number, isBuy: boolean) => {
    if (!bridge || !stationId || qty <= 0) return;
    setError(null);
    const result = await bridge.executeTrade(stationId, commodityId, qty, isBuy);
    if (!result.success) {
      setError(result.error ?? 'Trade failed');
    }
  }, [bridge, stationId]);

  if (!stationBody) {
    return (
      <div style={{ padding: '12px 8px', color: 'var(--text-label)' }}>
        Not docked at a station.
      </div>
    );
  }

  if (!listings) {
    return (
      <div style={{ padding: '12px 8px', color: 'var(--text-label)' }}>
        Loading market data...
      </div>
    );
  }

  const exportListings = listings.filter(l => l.role === 'export');
  const importListings = listings.filter(l => l.role === 'import');

  // Max buy for exports
  const maxBuy = (listing: MarketListing): number => {
    const def = COMMODITY_DEFS[listing.commodityId as CommodityId];
    if (!def) return 0;
    const byCredits = listing.price > 0 ? Math.floor(credits / listing.price) : 0;
    const byCargo = def.baseMass > 0 ? Math.floor((maxCargo - cargoMass) / def.baseMass) : 0;
    const byStock = listing.available;
    return Math.max(0, Math.min(byCredits, byCargo, byStock));
  };

  // Max sell for imports
  const maxSell = (listing: MarketListing): number => {
    const held = cargoManifest?.[listing.commodityId as CommodityId] ?? 0;
    return Math.max(0, Math.min(held, listing.available));
  };

  // Hold value and summary
  const heldItems = Object.entries(cargoManifest ?? {})
    .filter(([, qty]) => (qty as number) > 0)
    .map(([commodityId, qty]) => ({ commodityId, qty: qty as number }));
  const holdValue = heldItems.reduce((sum, item) => {
    const listing = importListings.find(l => l.commodityId === item.commodityId);
    return sum + item.qty * (listing?.price ?? 0);
  }, 0);

  return (
    <div style={{ padding: '4px 4px', fontSize: 'var(--font-size-md)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 4px 8px',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 6,
      }}>
        <div>
          <div style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)', letterSpacing: 1 }}>MARKET</div>
          <div style={{ color: 'var(--text-bright)', fontSize: 13 }}>{stationBody.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--text-label)', fontSize: 'var(--font-size-sm)' }}>CREDITS</div>
          <div style={{ color: 'var(--accent-cyan)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
            {Math.round(credits).toLocaleString()} CR
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '4px 8px',
          marginBottom: 4,
          color: 'var(--status-danger)',
          fontSize: 'var(--font-size-sm)',
          background: 'rgba(255, 68, 68, 0.1)',
          borderRadius: 3,
        }}>
          {error}
        </div>
      )}

      {/* Two-panel layout */}
      <div style={{ display: 'flex', gap: 4 }}>
        {/* Left: Station Exports (player can BUY) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: 'var(--text-label)',
            fontSize: 'var(--font-size-xs)',
            letterSpacing: 0.5,
            padding: '4px 2px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: 2,
          }}>
            STATION EXPORTS
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 28px 42px 42px 14px',
            gap: 2,
            padding: '2px 2px',
            color: 'var(--text-hint)',
            fontSize: 9,
            letterSpacing: 0.3,
          }}>
            <span>ITEM</span>
            <span style={{ textAlign: 'right' }}>STK</span>
            <span style={{ textAlign: 'right' }}>ASK</span>
            <span style={{ textAlign: 'right' }}>AVG</span>
            <span></span>
          </div>

          {exportListings.length === 0 ? (
            <div style={{ padding: '8px 2px', color: 'var(--text-hint)', fontSize: 11 }}>
              No exports
            </div>
          ) : exportListings.map((listing) => {
            const max = maxBuy(listing);
            const disabled = listing.outOfStock || max < 1;

            return (
              <div key={listing.commodityId} style={{ borderBottom: '1px solid rgba(100, 180, 255, 0.05)' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 28px 42px 42px 14px',
                  gap: 2,
                  padding: '3px 2px 1px',
                  alignItems: 'center',
                }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {listing.name}
                  </span>
                  <span style={{ textAlign: 'right', color: listing.outOfStock ? 'var(--text-hint)' : 'var(--text-primary)', fontSize: 11 }}>
                    {listing.outOfStock ? '---' : formatNumber(listing.available)}
                  </span>
                  <span style={{ textAlign: 'right', color: priceVsAvg(listing.price, listing.systemAvgPrice, 'export'), fontSize: 11 }}>
                    {listing.price.toFixed(0)}
                  </span>
                  <span style={{ textAlign: 'right', color: 'var(--text-hint)', fontSize: 10 }}>
                    {listing.systemAvgPrice.toFixed(0)}
                  </span>
                  <TrendIndicator trend={listing.trend} />
                </div>
                {listing.outOfStock ? (
                  <div style={{ padding: '1px 2px 3px', color: 'var(--text-hint)', fontSize: 9, fontStyle: 'italic' }}>
                    Out of Stock
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 3, padding: '1px 2px 3px' }}>
                    <button onClick={() => executeTrade(listing.commodityId, 1, true)} disabled={disabled} style={actionBtnStyle(!disabled, 'export')}>
                      BUY 1
                    </button>
                    <button onClick={() => executeTrade(listing.commodityId, Math.min(10, max), true)} disabled={disabled} style={actionBtnStyle(!disabled, 'export')}>
                      BUY 10
                    </button>
                    <button onClick={() => executeTrade(listing.commodityId, max, true)} disabled={disabled} style={actionBtnStyle(!disabled, 'export')}>
                      MAX
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: 'var(--border-subtle)', flexShrink: 0 }} />

        {/* Right: Station Imports (player can SELL) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            color: 'var(--text-label)',
            fontSize: 'var(--font-size-xs)',
            letterSpacing: 0.5,
            padding: '4px 2px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: 2,
          }}>
            STATION IMPORTS
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 28px 42px 42px 14px',
            gap: 2,
            padding: '2px 2px',
            color: 'var(--text-hint)',
            fontSize: 9,
            letterSpacing: 0.3,
          }}>
            <span>ITEM</span>
            <span style={{ textAlign: 'right' }}>HELD</span>
            <span style={{ textAlign: 'right' }}>BID</span>
            <span style={{ textAlign: 'right' }}>AVG</span>
            <span></span>
          </div>

          {importListings.length === 0 ? (
            <div style={{ padding: '8px 2px', color: 'var(--text-hint)', fontSize: 11 }}>
              No imports
            </div>
          ) : importListings.map((listing) => {
            const held = cargoManifest?.[listing.commodityId as CommodityId] ?? 0;
            const max = maxSell(listing);
            const disabled = listing.fullyStocked || held < 1;
            const avgCost = costBasis[listing.commodityId] ?? 0;
            const profitPerUnit = held > 0 ? listing.price - avgCost : 0;

            return (
              <div key={listing.commodityId} style={{ borderBottom: '1px solid rgba(100, 180, 255, 0.05)' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 28px 42px 42px 14px',
                  gap: 2,
                  padding: '3px 2px 1px',
                  alignItems: 'center',
                }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {listing.name}
                  </span>
                  <span style={{ textAlign: 'right', color: held > 0 ? 'var(--text-primary)' : 'var(--text-hint)', fontSize: 11 }}>
                    {held > 0 ? held : '-'}
                  </span>
                  <span style={{ textAlign: 'right', color: priceVsAvg(listing.price, listing.systemAvgPrice, 'import'), fontSize: 11 }}>
                    {listing.price.toFixed(0)}
                  </span>
                  <span style={{ textAlign: 'right', color: 'var(--text-hint)', fontSize: 10 }}>
                    {listing.systemAvgPrice.toFixed(0)}
                  </span>
                  <TrendIndicator trend={listing.trend} />
                </div>
                {/* Profit indicator */}
                {held > 0 && avgCost > 0 && (
                  <div style={{ padding: '0 2px', fontSize: 9, color: profitPerUnit >= 0 ? 'var(--status-nominal)' : 'var(--status-danger)' }}>
                    Cost: {avgCost.toFixed(0)} | {profitPerUnit >= 0 ? '+' : ''}{profitPerUnit.toFixed(0)}/unit ({avgCost > 0 ? `${((profitPerUnit / avgCost) * 100).toFixed(0)}%` : ''})
                  </div>
                )}
                {listing.fullyStocked ? (
                  <div style={{ padding: '1px 2px 3px', color: 'var(--text-hint)', fontSize: 9, fontStyle: 'italic' }}>
                    Fully Stocked
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 3, padding: '1px 2px 3px' }}>
                    <button onClick={() => executeTrade(listing.commodityId, 1, false)} disabled={disabled} style={actionBtnStyle(!disabled, 'import')}>
                      SELL 1
                    </button>
                    <button onClick={() => executeTrade(listing.commodityId, Math.min(10, max), false)} disabled={disabled} style={actionBtnStyle(!disabled, 'import')}>
                      SELL 10
                    </button>
                    <button onClick={() => executeTrade(listing.commodityId, max, false)} disabled={disabled} style={actionBtnStyle(!disabled, 'import')}>
                      ALL
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Cargo summary */}
          <div style={{
            marginTop: 'auto',
            padding: '8px 2px 4px',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-label)' }}>CARGO</span>
              <span style={{
                color: cargoMass > maxCargo * 0.9 ? 'var(--status-warning)' : 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}>
                {formatNumber(cargoMass)} / {formatNumber(maxCargo)} kg
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 2 }}>
              <span style={{ color: 'var(--text-label)' }}>VALUE</span>
              <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                {Math.round(holdValue).toLocaleString()} CR
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
