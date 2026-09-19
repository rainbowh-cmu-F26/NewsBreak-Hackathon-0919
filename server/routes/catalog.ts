import { Router } from 'express';
import { createHash } from 'node:crypto';
import { quoteSchema } from '../../shared/quotes.js';
import type { DeliveryOption, PlanResponse } from '../../shared/schemas.js';
import type { MealWiseStore } from '../db/mongo.js';

export function createCatalogRouter(store: MealWiseStore) {
  const router = Router();
  router.get('/', async (_request, response) => {
    if (!store.listQuotes) return response.status(503).json({ error: 'The database catalog is not configured.' });
    try {
      const rows = await store.listQuotes(undefined, AbortSignal.timeout(5000));
      const entries: DeliveryOption[] = [];
      const comparisonKeys = new Map<string, string>();
      const eligibleTotals = new Set<string>();
      for (const row of rows) {
        const parsed = quoteSchema.safeParse(row);
        if (!parsed.success) continue;
        const q = parsed.data;
        const total = q.price_complete ? q.displayed_total_cents : null;
        const subtotal = q.subtotal_cents ?? (q.platform_items.every((item) => item.line_total_cents !== null || item.unit_price_cents !== null)
          ? q.platform_items.reduce((sum, item) => sum + (item.line_total_cents ?? item.unit_price_cents! * item.quantity), 0) : null);
        if (total === null && subtotal === null) continue;
        const price = (total ?? subtotal!) / 100;
        const capturedAt = q.captured_at ? new Date(q.captured_at).toISOString() : null;
        const id = `catalog-${createHash('sha256').update(JSON.stringify(q)).digest('hex')}`;
        comparisonKeys.set(id, JSON.stringify([q.restaurant.restaurant_id, q.comparison_key, q.platform_items.map((item) => [item.item_name, item.quantity, item.size, item.modifiers]), q.fulfillment, q.delivery_speed, q.membership, q.customer_status, q.account_context_id, q.location_id, q.tip_cents, q.data_type]));
        if (total !== null && q.availability === 'available' && q.membership === 'none' && q.customer_status !== 'new' && !q.source_offer?.newCustomerOnly && !q.offers.some((offer) => offer.applied && offer.eligibility_status !== 'confirmed')) eligibleTotals.add(id);
        entries.push({
          id,
          restaurant: q.restaurant.name, restaurant_id: q.restaurant.restaurant_id,
          item: q.platform_items.map((item) => `${item.quantity} × ${item.item_name}`).join(', '),
          sourceOffer: q.source_offer, price, originalPrice: price, fee: 0,
          ...(total !== null ? { total: price } : {}),
          eta: q.eta_max_minutes === null ? 'ETA not recorded' : `Up to ${q.eta_max_minutes} min`,
          badge: total === null ? 'Menu price · fees unknown' : q.data_type === 'synthetic' ? 'Simulated quote' : 'Stored quote',
          detail: `${q.notes} Availability: ${q.availability}. Customer: ${q.customer_status}. Membership: ${q.membership}.`,
          tags: q.dietary_tags, available: q.availability === 'available', verified: q.data_type === 'checkout_snapshot' && q.verification_status === 'verified',
          source: 'MongoDB catalog', sourceUrl: q.platform_store_url, verifiedAt: capturedAt ?? '',
          priceNote: total === null ? 'Menu price only; delivery, fees and tax are not fully recorded.' : 'Stored price snapshot, not a live checkout quote.',
          quote: { platform: q.platform, dataType: q.data_type, capturedAt, subtotal, delivery: q.delivery_fee_cents, service: q.service_fee_cents, tax: q.tax_cents, combined: q.tax_and_fees_combined_cents, other: q.other_fees, tip: q.tip_cents, discount: q.additional_discount_cents, total },
        });
      }
      const restaurants = new Map<string, DeliveryOption[]>();
      for (const entry of entries) {
        const key = entry.restaurant_id || entry.restaurant;
        restaurants.set(key, [...(restaurants.get(key) ?? []), entry]);
      }
      const options = [...restaurants.values()].map((choices) => {
        // A menu subtotal must never undercut a complete delivery total.
        const complete = choices.filter((choice) => eligibleTotals.has(choice.id));
        const candidates = complete.length ? complete : choices.filter((choice) => choice.quote?.dataType === 'menu_only');
        const best = [...(candidates.length ? candidates : choices)].sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))[0];
        const comparable = choices.filter((choice) => eligibleTotals.has(choice.id) && comparisonKeys.get(choice.id) === comparisonKeys.get(best.id));
        const platforms = new Map<string, NonNullable<DeliveryOption['comparisons']>[number]>();
        for (const choice of comparable) {
          const q = choice.quote!;
          if ([q.subtotal, q.delivery, q.service, q.tax, q.tip, q.discount, q.total].some((value) => value === null)) continue;
          const platform = q.platform!;
          const existing = platforms.get(platform);
          if (!existing || q.total! < existing.total) platforms.set(platform, { platform, subtotal: q.subtotal!, delivery: q.delivery!, service: q.service!, tax: q.tax!, tip: q.tip!, discount: q.discount!, total: q.total!, eta: choice.eta });
        }
        best.comparisons = [...platforms.values()].sort((a, b) => a.total - b.total);
        best.priceNote = eligibleTotals.has(best.id)
          ? 'Lowest qualifying stored total at this restaurant. Platform comparisons cover the same meal and order conditions; prices are not live.'
          : best.quote?.dataType === 'menu_only' ? 'Menu price only; no qualifying complete delivery total is recorded.' : 'No qualifying current total is recorded. This stored quote may have availability or eligibility conditions.';
        return best;
      }).sort((a, b) => a.price - b.price || a.restaurant.localeCompare(b.restaurant));
      const plan: PlanResponse = { options, summary: `Showing all ${options.length} restaurants, with each restaurant’s lowest qualifying stored total and matching platform quotes. Menu-only prices are labeled separately.`, savings: 0, checkedAt: new Date().toISOString(), dataSource: 'database-data' };
      return response.json(plan);
    } catch {
      return response.status(503).json({ error: 'The database catalog could not be loaded. Please retry.' });
    }
  });
  return router;
}
