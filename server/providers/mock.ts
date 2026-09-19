import rawOffers from '../data/offers.json' with { type: 'json' };
import type { FoodIntent } from '../../shared/intent.js';
import type { OfferProvider } from './types.js';

export function mockRows(now = new Date()) {
  // These timestamps describe generation of a simulated quote, not live verification.
  return rawOffers.map((offer) => ({ ...offer, checkedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString() }));
}

export class MockOfferProvider implements OfferProvider {
  readonly id = 'demo-catalog';
  readonly kind = 'mock' as const;
  async search(_intent: FoodIntent, signal: AbortSignal) {
    signal.throwIfAborted();
    return mockRows();
  }
}
