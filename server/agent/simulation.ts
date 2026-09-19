import type { Quote } from '../../shared/quotes.js';
// Demo assumptions, not Uber Eats fee rules or an actual local tax rate.
export function simulateMenuQuote(source: Quote): Quote {
 const subtotal = source.platform_items[0].unit_price_cents!;
 const delivery = 199;
 const service = Math.max(99, Math.round(subtotal * 0.15));
 const tax = Math.round(subtotal * 0.10);
 const tip = 200;
 return { ...source, comparison_key: `simulation_${source.comparison_key}`, data_type: 'synthetic',
   fulfillment: 'delivery', delivery_speed: 'standard', membership: 'none', customer_status: 'existing',
   location_id: 'mv_demo_location', account_context_id: 'simulation',
   subtotal_cents: subtotal, delivery_fee_cents: delivery, service_fee_cents: service,
   tax_cents: tax, tax_and_fees_combined_cents: null, other_fees: [], tip_cents: tip,
   additional_discount_cents: 0, displayed_total_cents: subtotal + delivery + service + tax + tip,
   price_complete: true, availability: 'available', eta_min_minutes: 25, eta_max_minutes: 40,
   captured_at: null, verification_status: 'unreviewed', offers: [],
   notes: 'DEMO: sourced menu base price plus simulated fees. Delivery $1.99; service 15% (minimum $0.99); tax assumption 10% of item price; tip $2; discount $0; ETA 25–40 minutes. These are not platform rates, actual tax advice or live availability.',
 };
}
