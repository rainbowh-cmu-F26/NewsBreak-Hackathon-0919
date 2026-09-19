import { simulateMenuQuote } from './simulation.js';
import { readFileSync } from 'node:fs';
import type { DeliveryOption, PlanRequest, PlanResponse } from '../../shared/schemas.js';
import { quoteSchema, type Quote } from '../../shared/quotes.js';
const demoQuotes = () => quoteSchema.array().parse(JSON.parse(readFileSync(new URL('../data/quotes.json', import.meta.url), 'utf8')));

export function buildPlan(request: PlanRequest, quotes: Quote[] = demoQuotes()): PlanResponse {
  const tokens = request.prompt.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
  const simulation = request.mode === 'simulation';
  const scenarios = quotes.filter(q => q.account_context_id === 'three_platform_demo_v1');
  if (simulation && scenarios.length) quotes = scenarios;
  else if (simulation) quotes = quotes.filter(q => q.data_type === 'menu_only' && q.platform_items.length === 1 && q.platform_items[0].unit_price_cents !== null).map(simulateMenuQuote);
  const menu = request.mode === 'menu';
  const amount = (q: Quote) => menu ? q.platform_items[0].unit_price_cents : q.displayed_total_cents;
  const browseAll = /^(all|all restaurants|restaurants|dinner|lunch|food|全部|所有餐厅)$/i.test(request.prompt.trim());
  const score = (q: Quote) => browseAll ? 1 : tokens.filter(t => [q.restaurant.name, ...q.platform_items.map(item => item.item_name)].join(' ').toLowerCase().includes(t)).length;
  const candidates = quotes
    .filter(q => simulation || q.account_context_id !== 'three_platform_demo_v1')
    .filter(q => !simulation || score(q) > 0)
    .filter(q => menu ? q.data_type === 'menu_only' && q.platform_items.length === 1 && amount(q) !== null && score(q) > 0 : q.availability === 'available' && q.price_complete && q.displayed_total_cents !== null && q.data_type !== 'menu_only')
    .filter(q => menu || q.data_type === 'synthetic' || q.verification_status === 'verified')
    .filter(q => !q.offers.some(o => o.applied && o.eligibility_status !== 'confirmed'))
    .filter(q => request.dietary === 'No preference' || q.dietary_tags.includes(request.dietary.toLowerCase() as 'vegetarian'))
    .filter(q => amount(q)! <= Math.round(request.budget * 100))
    .sort((a, b) => {
      const browseAll = /^(all|all restaurants|restaurants|dinner|lunch|food|全部|所有餐厅)$/i.test(request.prompt.trim());
  const score = (q: Quote) => browseAll ? 1 : tokens.filter(t => [q.restaurant.name, ...q.platform_items.map(item => item.item_name)].join(' ').toLowerCase().includes(t)).length;
      return score(b) - score(a) || amount(a)! - amount(b)!;
    });
  // Candidates are ordered by relevance, then price. Keep the best match per branch.
  const restaurants = new Map<string, Quote>();
  for (const quote of candidates) {
    if (!restaurants.has(quote.restaurant.restaurant_id)) restaurants.set(quote.restaurant.restaurant_id, quote);
  }
  const options: DeliveryOption[] = [...restaurants.values()]
    .sort((a, b) => amount(a)! - amount(b)! || a.restaurant.name.localeCompare(b.restaurant.name))
    .slice(0, 15).map((q) => ({
      id: `${q.restaurant.restaurant_id}-${q.comparison_key}-${q.platform}`,
      comparisons: simulation && scenarios.length ? scenarios.filter(other => other.restaurant.restaurant_id === q.restaurant.restaurant_id && other.comparison_key === q.comparison_key)
        .sort((a,b) => a.displayed_total_cents! - b.displayed_total_cents!).map(other => ({ platform: other.platform, subtotal: other.subtotal_cents!, delivery: other.delivery_fee_cents!, service: other.service_fee_cents!, tax: other.tax_cents!, tip: other.tip_cents!, discount: other.additional_discount_cents!, total: other.displayed_total_cents!, eta: `${other.eta_min_minutes}–${other.eta_max_minutes} min` })) : undefined,
      restaurant: q.restaurant.name,
      item: q.platform_items.map(x => `${x.quantity} × ${x.item_name} (${x.size || 'size unspecified'})`).join(', '),
      price: amount(q)! / 100, originalPrice: amount(q)! / 100, fee: 0,
      eta: q.eta_min_minutes !== null && q.eta_max_minutes !== null ? `${q.eta_min_minutes}–${q.eta_max_minutes} min` : 'ETA unknown',
      badge: menu ? 'Public menu price · not a checkout total' : q.data_type === 'synthetic' ? 'Demo · simulated price' : 'Recorded checkout quote',
      detail: menu ? `Public cached menu from ${q.platform}. Tax, delivery, tips and selected options are not included. ${q.notes}` : `${q.platform} · ${q.fulfillment} · Membership: ${q.membership} · Customer: ${q.customer_status} · Location: ${q.location_id || 'pickup'}. ${q.notes}`,
      tags: q.dietary_tags, available: true, verified: q.data_type !== 'synthetic' && q.verification_status === 'verified',
      sourceUrl: q.platform_store_url, source: q.platform, verifiedAt: q.captured_at ? new Date(q.captured_at).toISOString() : '',
      quote: { platform: q.platform, dataType: q.data_type, capturedAt: q.captured_at ? new Date(q.captured_at).toISOString() : null,
        subtotal: menu ? amount(q) : q.subtotal_cents, delivery: q.delivery_fee_cents, service: q.service_fee_cents, tax: q.tax_cents,
        combined: q.tax_and_fees_combined_cents, other: q.other_fees, tip: q.tip_cents, discount: q.additional_discount_cents }
    }));
  return { summary: simulation ? (options.length ? `Found ${options.length} restaurants with a best matching demo option under $${request.budget.toFixed(2)}. Three simulated delivery options per restaurant. Four restaurants use sourced menu references; eleven restaurants are fictional. No live prices or delivery availability.` : 'No matching demo totals within this budget. Try a higher budget with No preference.') : menu ? (options.length ? `Found ${options.length} restaurants with a best matching menu item at or below $${request.budget.toFixed(2)} before fees. These are cached menu prices, not live checkout totals.` : 'No matching menu items. Try Panda, rice, chicken or paneer with No preference; dietary suitability is not verified.') : options.length ? `Found ${options.length} restaurants with a best matching recorded option within $${request.budget.toFixed(2)}. Prices apply only to the recorded account and location; confirm at checkout.` : 'No complete recorded quotes match this budget and dietary preference.', options, savings: 0, checkedAt: new Date().toISOString(), dataSource: 'quote-snapshots' };
}
