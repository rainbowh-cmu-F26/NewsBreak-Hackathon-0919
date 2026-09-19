import { z } from 'zod';

export const dietaryValues = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'halal', 'kosher'] as const;
export const dealValues = ['bogo', 'discount', 'free-delivery'] as const;
export const providerValues = ['uber-eats', 'doordash', 'grubhub'] as const;
const terms = z.array(z.string().trim().min(1).max(60)).max(15);

export const intentSchema = z.object({
  budget: z.number().finite().positive().max(500),
  dietary: z.array(z.enum(dietaryValues)).max(6),
  cuisines: terms,
  excludedCuisines: terms,
  foods: terms,
  excludedIngredients: terms,
  allergens: terms,
  deals: z.array(z.enum(dealValues)).max(3),
  providers: z.array(z.enum(providerValues)).max(3),
  servings: z.number().int().min(1).max(20),
  maxEtaMinutes: z.number().int().positive().max(180).nullable(),
  sortBy: z.enum(['best-value', 'cheapest', 'fastest']),
  newCustomer: z.boolean().nullable(),
  location: z.string().trim().min(1).max(120),
}).strict();
export type FoodIntent = z.infer<typeof intentSchema>;

export const extractionSchema = z.object({
  intent: intentSchema,
  clarification: z.string().min(1).max(300).nullable(),
}).strict();

export const agentDetailsSchema = z.object({
  intent: intentSchema,
  mode: z.enum(['model', 'local']),
  clarification: z.string().nullable(),
  warnings: z.array(z.string()),
  appliedFilters: z.array(z.string()),
});

export const conversationContextSchema = z.object({
  intent: intentSchema,
  formBudget: z.number(),
  formDietary: z.string(),
  lastBestTotal: z.number().nullable(),
});
export type ConversationContext = z.infer<typeof conversationContextSchema>;
