import { z } from 'zod';
import { agentDetailsSchema, providerValues } from './intent.js';
import { sourceOfferSchema } from './quotes.js';

export const planRequestSchema = z.object({
  prompt: z.string().trim().min(3, 'Describe what you want to eat.').max(160, 'Keep the craving under 160 characters.'),
  budget: z.number().finite().positive('Budget must be greater than zero.').max(500, 'Budget must be $500 or less.'),
  dietary: z.enum(['No preference', 'Vegetarian', 'Vegan', 'Gluten-aware']).default('No preference')
}).strict();

export type PlanRequest = z.infer<typeof planRequestSchema>;
export const deliveryOptionSchema = z.object({
  id: z.string(),
  restaurant: z.string(),
  restaurant_id: z.string().optional(),
  sourceOffer: sourceOfferSchema.optional(),
  item: z.string(),
  price: z.number().nonnegative(),
  originalPrice: z.number().nonnegative(),
  fee: z.number().nonnegative(),
  eta: z.string(),
  badge: z.string(),
  detail: z.string(),
  tags: z.array(z.string()),
  available: z.boolean(),
  verified: z.boolean(),
  source: z.string(),
  verifiedAt: z.string(),
  provider: z.enum(providerValues).optional(),
  cuisine: z.string().optional(),
  servings: z.number().int().positive().optional(),
  quantity: z.number().int().positive().optional(),
  total: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  serviceFee: z.number().nonnegative().optional(),
  savings: z.number().nonnegative().optional(),
  priceNote: z.string().optional(),
  sourceUrl: z.string().nullable().optional(),
  quote: z.object({ platform: z.string().optional(), capturedAt: z.string().nullable().optional(), combined: z.number().nullable().optional(), other: z.array(z.object({name: z.string(), amount_cents: z.number()})).optional(), dataType: z.enum(['menu_only', 'synthetic', 'checkout_snapshot']), subtotal: z.number().nullable(), delivery: z.number().nullable(), service: z.number().nullable(), tax: z.number().nullable(), tip: z.number().nullable(), discount: z.number().nullable(), total: z.number().nullable() }).optional(),
  comparisons: z.array(z.object({ platform: z.string(), eta: z.string().optional(), subtotal: z.number(), delivery: z.number(), service: z.number(), tax: z.number(), tip: z.number(), discount: z.number(), total: z.number() })).optional(),
});

export type DeliveryOption = z.infer<typeof deliveryOptionSchema>;
export const planResponseSchema = z.object({
  summary: z.string(),
  options: z.array(deliveryOptionSchema),
  savings: z.number().nonnegative(),
  checkedAt: z.string().datetime(),
  dataSource: z.enum(['verified-demo-data', 'provider-data', 'database-data']),
  agent: agentDetailsSchema.optional(),
});
export type PlanResponse = z.infer<typeof planResponseSchema>;

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(3, 'Tell MealWise what you want to eat.').max(500, 'Keep your message under 500 characters.'),
  budget: z.number().finite().positive().max(500),
  dietary: planRequestSchema.shape.dietary
}).strict();

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export const chatResponseSchema = z.object({
  conversationId: z.string().uuid(),
  reply: z.string(),
  plan: planResponseSchema
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;
