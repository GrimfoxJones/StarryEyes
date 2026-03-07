import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store.ts';
import type { MarketListing } from '@starryeyes/shared';
import { COMMODITY_DEFS } from '@starryeyes/shared';
import type { CommodityId } from '@starryeyes/shared';
import type { RemoteBridge } from '../../../../RemoteBridge.ts';

function TrendIndicator({ trend }: { trend: 'rising' | 'falling' | 'stable' }) {
  if (trend === 'rising') return <span style={{ color: 'var(--status-danger)' }}>▲</span>;
  if (trend === 'falling') return <span style={{ color: 'var(--status-nominal)' }}>▼</span>;
  return <span style={{ color: 'var(--text-hint)' }}>─</span>;
}

function priceColor(price: number, basePrice: number): string {
  if (price < basePrice * 0.9) return 'var(--status-nominal)';
  if (price > basePrice * 1.1) return 'var(--status-danger)';
  return 'var(--text-primary)';
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

const buyBtnStyle = (enabled: boolean) => ({
  background: enabled ? 'rgba(0, 200, 100, 0.2)' : 'var(--bg-surface)',
  border: '1px solid',
  borderColor: enabled ? 'rgba(0, 200, 100, 0.4)' : 'var(--border-subtle)',
  color: enabled ? 'var(--status-nominal)' : 'var(--text-hint)',
  borderRadius: 2,
  fontSize: 10,
  padding: '2px 4px',
  cursor: enabled ? 'pointer' : 'default',
  fontFamily: 'var(--font-mono)',
  flex: 1,
});

const sellBtnStyle = (enabled: boolean) => ({
  background: enabled ? 'rgba(255, 150, 0, 0.2)' : 'var(--bg-surface)',
  border: '1px solid',
  borderColor: enabled ? 'rgba(255, 150, 0, 0.4)' : 'var(--border-subtle)',
  color: enabled ? 'var(--status-warning)' : 'var(--text-hint)',
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

  // Compute max buy for a commodity
  const maxBuy = (listing: MarketListing): number => {
    const def = COMMODITY_DEFS[listing.commodityId as CommodityId];
    if (!def) return 0;
    const byCredits = listing.price > 0 ? Math.floor(credits / listing.price) : 0;
    const byCargo = def.baseMass > 0 ? Math.floor((maxCargo - cargoMass) / def.baseMass) : 0;
    const byStock = listing.stockpile;
    return Math.max(0, Math.min(byCredits, byCargo, byStock));
  };

  // Build held items list
  const heldItems = Object.entries(cargoManifest ?? {})
    .filter(([, qty]) => (qty as number) > 0)
    .map(([commodityId, qty]) => {
      const listing = listings.find(l => l.commodityId === commodityId);
      return {
        commodityId,
        qty: qty as number,
        name: listing?.name ?? commodityId,
        avgCost: costBasis[commodityId] ?? 0,
        stationPrice: listing?.price ?? 0,
      };
    });

  // Total hold value at station prices
  const holdValue = heldItems.reduce((sum, item) => sum + item.qty * item.stationPrice, 0);

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
        {/* Left: Station Exchange */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: 'var(--text-label)',
            fontSize: 'var(--font-size-xs)',
            letterSpacing: 0.5,
            padding: '4px 2px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: 2,
          }}>
            STATION EXCHANGE
          </div>

          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 38px 42px 14px',
            gap: 2,
            padding: '2px 2px',
            color: 'var(--text-hint)',
            fontSize: 9,
            letterSpacing: 0.3,
          }}>
            <span>ITEM</span>
            <span style={{ textAlign: 'right' }}>STK</span>
            <span style={{ textAlign: 'right' }}>PRICE</span>
            <span></span>
          </div>

          {listings.map((listing: MarketListing) => {
            const max = maxBuy(listing);

            return (
              <div key={listing.commodityId} style={{ borderBottom: '1px solid rgba(100, 180, 255, 0.05)' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 38px 42px 14px',
                  gap: 2,
                  padding: '3px 2px 1px',
                  alignItems: 'center',
                }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {listing.name}
                  </span>
                  <span style={{ textAlign: 'right', color: 'var(--text-primary)', fontSize: 11 }}>
                    {formatNumber(listing.stockpile)}
                  </span>
                  <span style={{ textAlign: 'right', color: priceColor(listing.price, listing.basePrice), fontSize: 11 }}>
                    {listing.price.toFixed(0)}
                  </span>
                  <TrendIndicator trend={listing.trend} />
                </div>
                <div style={{ display: 'flex', gap: 3, padding: '1px 2px 3px' }}>
                  <button
                    onClick={() => executeTrade(listing.commodityId, 1, true)}
                    disabled={max < 1}
                    style={buyBtnStyle(max >= 1)}
                  >BUY 1</button>
                  <button
                    onClick={() => executeTrade(listing.commodityId, Math.min(10, max), true)}
                    disabled={max < 1}
                    style={buyBtnStyle(max >= 1)}
                  >BUY 10</button>
                  <button
                    onClick={() => executeTrade(listing.commodityId, max, true)}
                    disabled={max < 1}
                    style={buyBtnStyle(max >= 1)}
                  >MAX</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: 'var(--border-subtle)', flexShrink: 0 }} />

        {/* Right: Ship Hold */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            color: 'var(--text-label)',
            fontSize: 'var(--font-size-xs)',
            letterSpacing: 0.5,
            padding: '4px 2px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: 2,
          }}>
            SHIP HOLD
          </div>

          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 28px 42px 42px',
            gap: 2,
            padding: '2px 2px',
            color: 'var(--text-hint)',
            fontSize: 9,
            letterSpacing: 0.3,
          }}>
            <span>ITEM</span>
            <span style={{ textAlign: 'right' }}>QTY</span>
            <span style={{ textAlign: 'right' }}>AVG</span>
            <span style={{ textAlign: 'right' }}>NOW</span>
          </div>

          {heldItems.length === 0 ? (
            <div style={{ padding: '8px 2px', color: 'var(--text-hint)', fontSize: 11 }}>
              Hold empty
            </div>
          ) : (
            heldItems.map((item) => {
              const profitColor = item.stationPrice > item.avgCost
                ? 'var(--status-nominal)'
                : item.stationPrice < item.avgCost
                  ? 'var(--status-danger)'
                  : 'var(--text-primary)';

              return (
                <div key={item.commodityId} style={{ borderBottom: '1px solid rgba(100, 180, 255, 0.05)' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 28px 42px 42px',
                    gap: 2,
                    padding: '3px 2px 1px',
                    alignItems: 'center',
                  }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--text-primary)', fontSize: 11 }}>
                      {item.qty}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--text-label)', fontSize: 11 }}>
                      {item.avgCost.toFixed(0)}
                    </span>
                    <span style={{ textAlign: 'right', color: profitColor, fontSize: 11 }}>
                      {item.stationPrice.toFixed(0)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 3, padding: '1px 2px 3px' }}>
                    <button
                      onClick={() => executeTrade(item.commodityId, 1, false)}
                      disabled={item.qty < 1}
                      style={sellBtnStyle(item.qty >= 1)}
                    >SELL 1</button>
                    <button
                      onClick={() => executeTrade(item.commodityId, Math.min(10, item.qty), false)}
                      disabled={item.qty < 1}
                      style={sellBtnStyle(item.qty >= 1)}
                    >SELL 10</button>
                    <button
                      onClick={() => executeTrade(item.commodityId, item.qty, false)}
                      disabled={item.qty < 1}
                      style={sellBtnStyle(item.qty >= 1)}
                    >ALL</button>
                  </div>
                </div>
              );
            })
          )}

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
