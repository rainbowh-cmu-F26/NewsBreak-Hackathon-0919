import { z } from 'zod';

export const planRequestSchema = z.object({
  prompt: z.string().trim().min(3, 'Describe what you want to eat.').max(160, 'Keep the craving under 160 characters.'),
  budget: z.number().finite().positive('Budget must be greater than zero.').max(500, 'Budget must be $500 or less.'),
  dietary: z.enum(['No preference', 'Vegetarian', 'Vegan', 'Gluten-aware']).default('No preference')
}).strict();

export type PlanRequest = z.infer<typeof planRequestSchema>;
export const deliveryOptionSchema = z.object({
  id: z.string(),
  restaurant: z.string(),
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
});

export type DeliveryOption = z.infer<typeof deliveryOptionSchema>;
export const planResponseSchema = z.object({
  summary: z.string(),
  options: z.array(deliveryOptionSchema),
  savings: z.number().nonnegative(),
  checkedAt: z.string().datetime(),
  dataSource: z.literal('verified-demo-data')
});
export type PlanResponse = z.infer<typeof planResponseSchema>;
