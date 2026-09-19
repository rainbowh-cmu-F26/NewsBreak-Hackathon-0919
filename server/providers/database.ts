import { createHash } from 'node:crypto';
import { quoteSchema, type Quote } from '../../shared/quotes.js';
import type { FoodIntent } from '../../shared/intent.js';
import type { CatalogOffer, OfferProvider } from './types.js';
import { simulateMenuQuote } from '../agent/simulation.js';
import { cuisineTerms, foodTerms } from '../agent/vocabulary.js';

const platforms: Record<string, CatalogOffer['provider']> = { ubereats: 'uber-eats', 'uber-eats': 'uber-eats', doordash: 'doordash', grubhub: 'grubhub', restaurant_direct: 'restaurant-direct' };
export function quoteToOffer(row: unknown, now = new Date()): CatalogOffer | null {
  const parsed = quoteSchema.safeParse(row);
  if (!parsed.success) return null;
  const source = parsed.data;
  if (source.availability === 'unavailable') return null;
  if (source.platform_items.every((item) => /\b(coke|sprite|soda|bottled water|iced tea|soft drink)\b/i.test(item.item_name))) return null;
  if (source.data_type === 'menu_only' && (source.platform_items.length !== 1 || source.platform_items[0].quantity !== 1 || source.platform_items[0].unit_price_cents === null)) return null;
  const q: Quote = source.data_type === 'menu_only' ? simulateMenuQuote(source) : source;
  if (!platforms[q.platform] || !q.price_complete || q.displayed_total_cents === null || q.availability !== 'available') return null;
  if (q.fulfillment !== 'delivery' || q.membership !== 'none' || q.offers.some((offer) => offer.applied && offer.eligibility_status !== 'confirmed')) return null;
  const captured = q.captured_at ? new Date(q.captured_at).toISOString() : now.toISOString();
  const checkedAt = q.data_type === 'synthetic' ? now.toISOString() : captured;
  const text = `${q.restaurant.name} ${q.platform_items.map((item) => item.item_name).join(' ')}`.toLowerCase();
  // Cuisine is a search hint inferred from names; never infer dietary/allergy safety.
  const cuisine = cuisineTerms.find((term) => text.includes(term)) ?? (/panda|dumpling|veggie garden|chow|hunan/.test(text) ? 'chinese' : /curry|biryani|everest|himalayan/.test(text) ? 'indian' : /sushi|ramen/.test(text) ? 'japanese' : /seoul/.test(text) ? 'korean' : /taco/.test(text) ? 'mexican' : /pizza/.test(text) ? 'italian' : /burger/.test(text) ? 'american' : 'unknown');
  const foods = foodTerms.filter((term) => new RegExp(`\\b${term}(?:s)?\\b`, 'i').test(text));
  const id = createHash('sha256').update(JSON.stringify([q.comparison_key, q.platform, q.platform_items, q.location_id, q.account_context_id, q.customer_status, q.captured_at])).digest('hex').slice(0, 24);
  return { id: `db-${id}`, provider: platforms[q.platform], restaurant: q.restaurant.name, item: q.platform_items.map((item) => `${item.quantity} × ${item.item_name}`).join(', '), cuisine, foods,
    dietary: q.dietary_tags.filter((tag): tag is 'vegetarian' | 'vegan' => tag === 'vegan' || tag === 'vegetarian'),
    ingredients: [], allergens: [], mayContain: [], ingredientInfoComplete: false, allergyInfoComplete: false,
    price: q.displayed_total_cents / 100, originalPrice: q.displayed_total_cents / 100, deliveryFee: 0, serviceFee: 0, taxRate: 0, servings: 1,
    etaMinutes: q.eta_max_minutes ?? 180, deals: q.delivery_fee_cents === 0 ? ['free-delivery'] : [], minimumOrder: 0, newCustomerOnly: q.customer_status === 'new',
    available: true, location: q.restaurant.city, description: q.notes, checkedAt, expiresAt: new Date(Date.parse(checkedAt) + 5 * 60_000).toISOString(), storedQuote: q };
}

export class DatabaseOfferProvider implements OfferProvider {
  readonly id = 'mongodb-quotes';
  readonly kind = 'database' as const;
  constructor(private readonly read: (intent?: FoodIntent, signal?: AbortSignal) => Promise<unknown[]>) {}
  async search(intent: FoodIntent, signal: AbortSignal) {
    const rows = await this.read(intent, signal);
    signal.throwIfAborted();
    return rows.map((row) => quoteToOffer(row)).filter((row): row is CatalogOffer => row !== null);
  }
}
