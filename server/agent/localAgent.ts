import offers from '../data/demo-data.json' with { type: 'json' };
import type { PlanRequest, PlanResponse, DeliveryOption } from '../../shared/schemas.js';

export function buildPlan(request: PlanRequest): PlanResponse {
  const dietary = request.dietary.toLowerCase();
  const matching = (offers as DeliveryOption[]).filter((offer) => {
    const dietaryMatch = dietary === 'no preference' || offer.tags.some((tag) => dietary.includes(tag));
    return dietaryMatch && offer.price + offer.fee <= request.budget;
  });
  const options = matching.sort((a, b) => (b.originalPrice - b.price) - (a.originalPrice - a.price) || (a.price + a.fee) - (b.price + b.fee)).slice(0, 3);
  const savings = options.reduce((total, offer) => total + offer.originalPrice - offer.price, 0);
  return { summary: options.length ? `I found ${options.length} verified options under your $${request.budget.toFixed(2)} budget.` : 'I could not find a verified match at that budget. Try raising it by a few dollars.', options, savings, checkedAt: new Date().toISOString() };
}
