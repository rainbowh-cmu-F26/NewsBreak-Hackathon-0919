import type { FoodIntent } from '../../shared/intent.js';

export const cuisineGroups: Record<string, string[]> = {
  asian: ['chinese', 'thai', 'vietnamese', 'indian', 'japanese', 'korean'],
  'east asian': ['chinese', 'japanese', 'korean'],
  'southeast asian': ['thai', 'vietnamese'],
  'south asian': ['indian'],
};
export const cuisineTerms = ['chinese', 'mexican', 'thai', 'vietnamese', 'indian', 'italian', 'japanese', 'korean', 'mediterranean', 'american', 'ethiopian'];
export const foodTerms = ['noodles', 'tacos', 'pizza', 'sushi', 'burger', 'sandwiches', 'curry', 'rice', 'salad', 'ramen', 'chicken', 'beef', 'pork', 'seafood', 'tofu'];
export function expandCuisines(terms: string[]) {
  return [...new Set(terms.flatMap((term) => cuisineGroups[term.toLowerCase().trim()] ?? [term.toLowerCase().trim()]))];
}
export function normalizeIntent(intent: FoodIntent): FoodIntent {
  return { ...intent, cuisines: expandCuisines(intent.cuisines), excludedCuisines: expandCuisines(intent.excludedCuisines), preferredCuisines: expandCuisines(intent.preferredCuisines ?? []) };
}
