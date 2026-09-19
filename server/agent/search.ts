import type { DeliveryOption, PlanResponse } from '../../shared/schemas.js';
import type { FoodIntent } from '../../shared/intent.js';
import { catalogOfferSchema, type CatalogOffer, type OfferProvider } from '../providers/types.js';
import { normalizeIntent } from './vocabulary.js';

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);
const money = (value: number) => cents(value) / 100;
const canonical = (value: string) => value.toLowerCase().trim();
const aliases: Record<string, string[]> = { gluten: ['gluten', 'wheat', 'barley', 'rye'], 'tree-nut': ['tree-nut', 'almond', 'cashew', 'walnut'], dairy: ['milk'], seafood: ['seafood', 'fish', 'shellfish'], nuts: ['peanut', 'tree-nut'] };
function contains(values: string[], term: string) {
  return (aliases[term] ?? [term]).some((needle) => values.some((value) => canonical(value).split(/[^a-z-]+/).includes(needle) || canonical(value) === needle));
}

export function appliedFilters(intent: FoodIntent): string[] {
  return [
    `Group budget: $${intent.budget.toFixed(2)}`, `${intent.servings} ${intent.servings === 1 ? 'person' : 'people'}`,
    ...intent.dietary, ...intent.cuisines, ...intent.foods,
    ...[...(intent.preferredCuisines ?? []), ...(intent.preferredFoods ?? []), ...(intent.preferredDietary ?? [])].map((term) => `Prefer ${term}`),
    ...intent.excludedCuisines.map((value) => `No ${value} cuisine`),
    ...intent.excludedIngredients.map((value) => `No ${value}`),
    ...intent.allergens.map((value) => `Allergy: ${value}`),
    ...intent.deals, ...intent.providers,
    ...(intent.maxEtaMinutes ? [`Within ${intent.maxEtaMinutes} min`] : []),
    ...(intent.newCustomer !== null ? [intent.newCustomer ? 'New customer' : 'Returning customer'] : []),
    intent.location, intent.sortBy,
  ];
}

function quote(offer: CatalogOffer, intent: FoodIntent, mock: boolean): DeliveryOption {
  const quantity = Math.ceil(intent.servings / offer.servings);
  const subtotal = cents(offer.price) * quantity / 100;
  const tax = money(subtotal * offer.taxRate);
  const total = money(subtotal + offer.deliveryFee + offer.serviceFee + tax);
  return {
    id: `${offer.provider}:${offer.id}`, provider: offer.provider,
    restaurant: offer.restaurant, item: offer.item, price: subtotal,
    originalPrice: money(offer.originalPrice * quantity), fee: offer.deliveryFee,
    total, tax, serviceFee: offer.serviceFee, quantity, servings: quantity * offer.servings,
    savings: money((offer.originalPrice - offer.price) * quantity), cuisine: offer.cuisine,
    eta: `Up to ${offer.etaMinutes} min`, badge: offer.deals.includes('bogo') ? 'BOGO' : offer.deals.includes('discount') ? 'Discount' : 'Free delivery',
    detail: offer.description, tags: [...offer.dietary, ...offer.foods], available: true,
    verified: true, source: mock ? `Simulated ${offer.provider} catalog` : offer.provider,
    verifiedAt: offer.checkedAt,
    priceNote: `${mock ? 'Simulated' : 'Estimated'} total includes delivery, service fee, and estimated tax; excludes optional tip.`,
  };
}

export function planOffers(intent: FoodIntent, rows: unknown[], mock = true, now = Date.now()): PlanResponse {
  intent = normalizeIntent(intent);
  const eligible: { option: DeliveryOption; eta: number }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const parsed = catalogOfferSchema.safeParse(row);
    if (!parsed.success) continue;
    const offer = parsed.data;
    if (!offer.available || Date.parse(offer.expiresAt) <= now || Date.parse(offer.checkedAt) > now + 60_000) continue;
    if (canonical(offer.location) !== canonical(intent.location)) continue;
    if (intent.providers.length && !intent.providers.includes(offer.provider)) continue;
    if (intent.cuisines.length && !intent.cuisines.includes(canonical(offer.cuisine))) continue;
    if (intent.excludedCuisines.includes(canonical(offer.cuisine))) continue;
    if (!intent.dietary.every((diet) => offer.dietary.includes(diet))) continue;
    if (intent.foods.length && !intent.foods.some((food) => contains(offer.foods, food))) continue;
    if (intent.excludedIngredients.length && (!offer.ingredientInfoComplete || intent.excludedIngredients.some((term) => contains([...offer.ingredients, ...offer.foods, ...offer.allergens], term)))) continue;
    if (intent.allergens.length && (!offer.allergyInfoComplete || intent.allergens.some((term) => contains([...offer.ingredients, ...offer.allergens, ...offer.mayContain], term)))) continue;
    if (!intent.deals.every((deal) => offer.deals.includes(deal))) continue;
    if (intent.maxEtaMinutes !== null && offer.etaMinutes > intent.maxEtaMinutes) continue;
    if (offer.newCustomerOnly && intent.newCustomer !== true) continue;
    const option = quote(offer, intent, mock);
    if (cents(option.price) < cents(offer.minimumOrder) || cents(option.total!) > cents(intent.budget)) continue;
    if (seen.has(option.id)) continue;
    seen.add(option.id);
    eligible.push({ option, eta: offer.etaMinutes });
  }
  eligible.sort((a, b) => {
    const preferenceScore = (option: DeliveryOption) => Number((intent.preferredCuisines ?? []).includes(option.cuisine!))
      + (intent.preferredFoods ?? []).filter((food) => contains(option.tags, food)).length
      + (intent.preferredDietary ?? []).filter((diet) => option.tags.includes(diet)).length;
    const preferenceDifference = preferenceScore(b.option) - preferenceScore(a.option);
    if (preferenceDifference) return preferenceDifference;
    if (intent.sortBy === 'fastest') return a.eta - b.eta || a.option.total! - b.option.total!;
    if (intent.sortBy === 'cheapest') return a.option.total! - b.option.total! || a.eta - b.eta;
    return b.option.savings! - a.option.savings! || a.option.total! - b.option.total! || a.option.id.localeCompare(b.option.id);
  });
  const options = eligible.slice(0, 3).map(({ option }) => option);
  return {
    summary: options.length
      ? `Found ${options.length} ${mock ? 'demo ' : ''}matches for ${intent.servings} ${intent.servings === 1 ? 'person' : 'people'} within $${intent.budget.toFixed(2)} including estimated tax and fees.`
      : 'No offers match all your constraints. You can change your budget, cuisine, deal preference, or delivery window. Your restrictions have not been relaxed.',
    options, savings: options[0]?.savings ?? 0, checkedAt: new Date(now).toISOString(),
    dataSource: mock ? 'verified-demo-data' : 'provider-data',
  };
}

async function searchProvider(provider: OfferProvider, intent: FoodIntent) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      provider.search(intent, controller.signal),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => { controller.abort(); reject(new Error('Provider timed out')); }, 5000);
      }),
    ]);
  } finally { clearTimeout(timeout); }
}

export async function searchOffers(intent: FoodIntent, providers: OfferProvider[]) {
  // Never mingle fixtures into live results. Register live adapters when ready.
  const live = providers.filter((provider) => provider.kind === 'live');
  const active = live.length ? live : providers;
  const results = await Promise.allSettled(active.map((provider) => searchProvider(provider, intent)));
  const warnings: string[] = [];
  const rows = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    warnings.push(`${active[index].id} could not be searched. Results may be incomplete.`);
    return [];
  });
  const plan = planOffers(intent, rows, live.length === 0);
  if (!active.length || results.every((result) => result.status === 'rejected')) plan.summary = 'Offer search is unavailable. Please retry; no provider availability was confirmed.';
  return { plan, warnings, rows, mock: live.length === 0 };
}
