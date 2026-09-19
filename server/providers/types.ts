import { z } from 'zod';
import { dietaryValues, dealValues, providerValues, type FoodIntent } from '../../shared/intent.js';

export const catalogOfferSchema = z.object({
  id: z.string().min(1), provider: z.enum(providerValues), restaurant: z.string().min(1), item: z.string().min(1),
  cuisine: z.string(), foods: z.array(z.string()), dietary: z.array(z.enum(dietaryValues)),
  ingredients: z.array(z.string()), allergens: z.array(z.string()), mayContain: z.array(z.string()),
  ingredientInfoComplete: z.boolean(), allergyInfoComplete: z.boolean(),
  price: z.number().finite().nonnegative(), originalPrice: z.number().finite().nonnegative(),
  deliveryFee: z.number().finite().nonnegative(), serviceFee: z.number().finite().nonnegative(),
  taxRate: z.number().min(0).max(1), servings: z.number().int().positive(), etaMinutes: z.number().int().positive(),
  deals: z.array(z.enum(dealValues)), minimumOrder: z.number().finite().nonnegative(), newCustomerOnly: z.boolean(),
  available: z.boolean(), location: z.string(), description: z.string(),
  checkedAt: z.string().datetime(), expiresAt: z.string().datetime(),
}).strict().refine((offer) => offer.originalPrice >= offer.price && Date.parse(offer.expiresAt) > Date.parse(offer.checkedAt), 'Invalid price or freshness interval')
  .refine((offer) => !offer.deals.includes('free-delivery') || offer.deliveryFee === 0, 'Free delivery must have zero delivery fee')
  .refine((offer) => !offer.deals.includes('discount') || offer.price < offer.originalPrice, 'Discount must reduce the food price')
  .refine((offer) => !offer.deals.includes('bogo') || (offer.servings >= 2 && offer.price < offer.originalPrice), 'BOGO must include multiple portions at a reduced bundle price');
export type CatalogOffer = z.infer<typeof catalogOfferSchema>;

/** Adapters return untrusted normalized rows. The planner validates every row again.
 * Implement search with an authorized provider integration; never fake a live adapter.
 */
export interface OfferProvider {
  readonly id: string;
  readonly kind: 'mock' | 'live';
  search(intent: FoodIntent, signal: AbortSignal): Promise<unknown[]>;
}
