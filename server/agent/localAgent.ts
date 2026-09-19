import type { DeliveryOption, PlanRequest, PlanResponse } from '../../shared/schemas.js';
import { verifiedOffers } from './verification.js';

const stopWords = new Set(['a', 'an', 'and', 'for', 'i', 'in', 'of', 'on', 'the', 'to', 'with']);

function promptTokens(prompt: string): string[] {
  return prompt.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !stopWords.has(token));
}

function scoreOffer(offer: DeliveryOption, request: PlanRequest): number {
  const tokens = promptTokens(request.prompt);
  const searchableText = [offer.restaurant, offer.item, offer.detail, ...offer.tags].join(' ').toLowerCase();
  const keywordMatches = tokens.filter((token) => searchableText.includes(token)).length;
  const savings = offer.originalPrice - offer.price;
  const total = offer.price + offer.fee;
  const dietaryMatch = request.dietary === 'No preference' || offer.tags.includes(request.dietary.toLowerCase()) ? 1 : 0;

  // The score is explainable: fit first, then promotion value, then total cost.
  return dietaryMatch * 1000 + keywordMatches * 100 + savings * 10 - total;
}

export function buildPlan(request: PlanRequest): PlanResponse {
  const matching = verifiedOffers
    .filter((offer) => request.dietary === 'No preference' || offer.tags.includes(request.dietary.toLowerCase()))
    .filter((offer) => offer.price + offer.fee <= request.budget)
    .sort((a, b) => scoreOffer(b, request) - scoreOffer(a, request) || a.id.localeCompare(b.id));
  const options = matching.slice(0, 3);
  const savings = options.reduce((total, offer) => total + offer.originalPrice - offer.price, 0);
  return {
    summary: options.length ? `I found ${options.length} verified options under your $${request.budget.toFixed(2)} budget.` : 'I could not find a verified match at that budget. Try raising it by a few dollars.',
    options,
    savings: Number(savings.toFixed(2)),
    checkedAt: new Date().toISOString(),
    dataSource: 'verified-demo-data'
  };
}
