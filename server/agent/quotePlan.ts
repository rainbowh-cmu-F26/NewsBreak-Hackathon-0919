import type { DeliveryOption, PlanRequest, PlanResponse } from '../../shared/schemas.js';
import { quoteSchema } from '../../shared/quotes.js';
import { quoteToOffer } from '../providers/database.js';
import { baseIntent } from './intent.js';
import { planOffers } from './search.js';

/** Offline quote-import evaluation. Runtime chat uses DatabaseOfferProvider. */
export function planQuoteRows(request: PlanRequest & { mode?: 'menu' | 'simulation' }, rows: unknown[]): PlanResponse {
  const terms = request.prompt.toLowerCase().split(/[^a-z0-9]+/).filter((term) => !['all', 'restaurants', 'food', 'please', 'show', 'me'].includes(term));
  const candidates: DeliveryOption[] = [];
  const grouping = new Map<string, string>();
  for (const row of rows) {
    const parsed = quoteSchema.safeParse(row);
    if (!parsed.success) continue;
    const source = parsed.data;
    const item = source.platform_items.map((entry) => `${entry.quantity} × ${entry.item_name}`).join(', ');
    const haystack = `${source.restaurant.name} ${item}`.toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) continue;
    if (request.dietary !== 'No preference' && !source.dietary_tags.includes(request.dietary.toLowerCase() as 'vegan' | 'vegetarian' | 'gluten-aware')) continue;
    if (request.mode === 'menu') {
      if (source.data_type !== 'menu_only' || source.platform_items.some((entry) => entry.line_total_cents === null && entry.unit_price_cents === null)) continue;
      const price = source.platform_items.reduce((sum, entry) => sum + (entry.line_total_cents ?? entry.unit_price_cents! * entry.quantity), 0) / 100;
      if (price > request.budget) continue;
      candidates.push({ id: source.comparison_key, restaurant: source.restaurant.name, item, price, originalPrice: price, fee: 0, eta: 'Not quoted', badge: 'Menu price only', detail: source.notes, tags: source.dietary_tags, available: false, verified: false, source: 'Stored menu record', sourceUrl: source.platform_store_url, verifiedAt: '', quote: { dataType: 'menu_only', subtotal: Math.round(price * 100), delivery: null, service: null, tax: null, tip: null, discount: null, total: null } });
      continue;
    }
    if (source.data_type === 'menu_only' && request.mode !== 'simulation') continue;
    const offer = quoteToOffer(source);
    if (!offer) continue;
    const intent = baseIntent({ message: request.prompt, budget: request.budget, dietary: request.dietary });
    const option = planOffers(intent, [offer]).options[0];
    if (option) { candidates.push(option); grouping.set(option.id, `${source.restaurant.restaurant_id}:${source.comparison_key}`); }
  }
  candidates.sort((a, b) => a.price - b.price);
  const selected = new Map<string, DeliveryOption>();
  for (const option of candidates) {
    if (selected.has(option.restaurant)) continue;
    const group = grouping.get(option.id);
    const comparable = group ? candidates.filter((candidate) => grouping.get(candidate.id) === group) : [];
    if (comparable.length > 1) option.comparisons = comparable.flatMap((candidate) => {
      const q = candidate.quote!;
      if ([q.subtotal, q.delivery, q.service, q.tax, q.tip, q.discount, q.total].some((value) => value === null)) return [];
      return [{ platform: candidate.provider!, eta: candidate.eta, subtotal: q.subtotal!, delivery: q.delivery!, service: q.service!, tax: q.tax!, tip: q.tip!, discount: q.discount!, total: q.total! }];
    });
    selected.set(option.restaurant, option);
  }
  const options = [...selected.values()];
  return { options, summary: `Found ${options.length} stored quote matches.`, savings: 0, checkedAt: new Date().toISOString(), dataSource: 'database-data' };
}
