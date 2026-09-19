import { z } from 'zod';

export const planRequestSchema = z.object({
  prompt: z.string().min(3),
  budget: z.number().positive(),
  dietary: z.string().default('No preference')
});

export type PlanRequest = z.infer<typeof planRequestSchema>;
export type DeliveryOption = {
  id: string;
  restaurant: string;
  item: string;
  price: number;
  originalPrice: number;
  fee: number;
  eta: string;
  badge: string;
  detail: string;
  tags: string[];
  available: boolean;
};
export type PlanResponse = { summary: string; options: DeliveryOption[]; savings: number; checkedAt: string };
