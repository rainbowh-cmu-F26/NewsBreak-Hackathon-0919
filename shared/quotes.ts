import { z } from 'zod';
const money = z.number().int().nonnegative().nullable();
export const sourceOfferSchema = z.object({
  id: z.string(), provider: z.string(), restaurant: z.string(), item: z.string(), cuisine: z.string(),
  foods: z.array(z.string()), dietary: z.array(z.string()), ingredients: z.array(z.string()),
  allergens: z.array(z.string()), mayContain: z.array(z.string()), ingredientInfoComplete: z.boolean(), allergyInfoComplete: z.boolean(),
  price: z.number().nonnegative(), originalPrice: z.number().nonnegative(), deliveryFee: z.number().nonnegative(), serviceFee: z.number().nonnegative(),
  taxRate: z.number().min(0).max(1), servings: z.number().int().positive(), etaMinutes: z.number().int().nonnegative(),
  deals: z.array(z.string()), minimumOrder: z.number().nonnegative(), newCustomerOnly: z.boolean(), available: z.boolean(), location: z.string(), description: z.string()
});
export const quoteSchema = z.object({
  source_offer: sourceOfferSchema.optional(),
  comparison_key: z.string().min(1),
  restaurant: z.object({ restaurant_id: z.string(), name: z.string(), address: z.string().nullable(), city: z.string(), state: z.string() }),
  location_id: z.string().nullable(),
  platform: z.string().min(1),
  platform_store_url: z.string().url().nullable(),
  platform_items: z.array(z.object({ item_name: z.string(), quantity: z.number().int().positive(), size: z.string().nullable(), modifiers: z.array(z.string()), unit_price_cents: money, line_total_cents: money })).min(1),
  fulfillment: z.enum(['delivery', 'pickup']).nullable(),
  delivery_speed: z.enum(['standard', 'priority', 'scheduled']).nullable(),
  membership: z.enum(['none', 'uber_one', 'dashpass', 'unknown']),
  customer_status: z.enum(['new', 'existing', 'unknown']),
  account_context_id: z.string().nullable(),
  currency: z.literal('USD'),
  subtotal_cents: money, delivery_fee_cents: money, service_fee_cents: money, tax_cents: money,
  tax_and_fees_combined_cents: money,
  other_fees: z.array(z.object({ name: z.string(), amount_cents: z.number().int().nonnegative() })),
  tip_cents: money, additional_discount_cents: money, displayed_total_cents: money,
  price_complete: z.boolean(),
  offers: z.array(z.object({ description: z.string(), applied: z.boolean(), eligibility_status: z.enum(['confirmed', 'unconfirmed', 'not_eligible']) })),
  eta_min_minutes: z.number().int().nonnegative().nullable(), eta_max_minutes: z.number().int().nonnegative().nullable(),
  availability: z.enum(['available', 'unavailable', 'unknown']),
  data_type: z.enum(['checkout_snapshot', 'menu_only', 'synthetic']),
  provenance: z.object({ retrieved_at: z.string().datetime({ offset: true }), method: z.literal('public_web_cached'), source_crawl_label: z.string(), source_updated_at: z.string().nullable() }).optional(),
  captured_at: z.union([z.date(), z.string().datetime({ offset: true })]).nullable(),
  evidence_paths: z.array(z.string()),
  verification_status: z.enum(['unreviewed', 'verified', 'needs_review']),
  missing_fields: z.array(z.string()), notes: z.string(),
  dietary_tags: z.array(z.enum(['vegetarian', 'vegan', 'gluten-aware'])).default([])
}).superRefine((q, ctx) => {
  if (q.data_type === 'menu_only' && (q.price_complete || q.displayed_total_cents !== null)) ctx.addIssue({ code: 'custom', message: 'Menu-only data must not claim a checkout total.' });
  if (q.data_type !== 'menu_only' && (!q.fulfillment || !q.delivery_speed)) ctx.addIssue({ code: 'custom', message: 'Checkout and synthetic quotes need fulfillment conditions.' });
  if (q.price_complete && q.displayed_total_cents === null) ctx.addIssue({ code: 'custom', message: 'Complete quotes require a displayed total.' });
  if (q.data_type === 'checkout_snapshot' && (!q.captured_at || !q.evidence_paths.length)) ctx.addIssue({ code: 'custom', message: 'Checkout snapshots require a timestamp and evidence.' });
  if (q.eta_min_minutes !== null && q.eta_max_minutes !== null && q.eta_min_minutes > q.eta_max_minutes) ctx.addIssue({ code: 'custom', message: 'Invalid ETA range.' });
});
export type Quote = z.infer<typeof quoteSchema>;
