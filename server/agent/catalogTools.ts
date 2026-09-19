import type { FoodIntent } from '../../shared/intent.js';
import type { PlanResponse } from '../../shared/schemas.js';
import { catalogOfferSchema } from '../providers/types.js';
import { planOffers } from './search.js';

/** One provider snapshot per turn: diagnostics never change the actual search intent. */
export class CatalogTools {
  constructor(private readonly intent: FoodIntent, private readonly rows: unknown[], private readonly mock: boolean, readonly plan: PlanResponse) {}

  searchOffers() { return this.plan; }

  getOfferDetails(offerId: string) {
    // Only expose details of validated offers from the current shortlist.
    const option = this.plan.options.find((entry) => entry.id === offerId);
    if (!option) return { error: 'That offer is not in the current search results.' };
    const offer = this.rows.map((row) => catalogOfferSchema.safeParse(row)).find((row) => row.success && `${row.data.provider}:${row.data.id}` === offerId);
    if (!offer?.success) return { error: 'Offer details unavailable.' };
    return { ...option, ingredients: offer.data.ingredients, allergens: offer.data.allergens, mayContain: offer.data.mayContain, ingredientInfoComplete: offer.data.ingredientInfoComplete, allergyInfoComplete: offer.data.allergyInfoComplete, newCustomerOnly: offer.data.newCustomerOnly };
  }

  explainNoMatches() {
    if (this.plan.options.length) return { message: 'The current search has matches.', suggestions: [] };
    const probes: { change: string; patch: Partial<FoodIntent> }[] = [
      { change: 'Choose any cuisine', patch: { cuisines: [] } },
      { change: 'Choose any food type', patch: { foods: [] } },
      { change: 'Remove the required deal preference', patch: { deals: [] } },
      { change: 'Use any delivery platform', patch: { providers: [] } },
      { change: 'Allow a longer delivery window', patch: { maxEtaMinutes: null } },
      { change: 'Increase the group budget', patch: { budget: 500 } },
      ...(this.intent.newCustomer === null ? [{ change: 'Confirm you qualify as a new customer', patch: { newCustomer: true } }] : []),
    ];
    const suggestions = probes.flatMap(({ change, patch }) => {
      const options = planOffers({ ...this.intent, ...patch }, this.rows, this.mock).options;
      return options.length ? [{ change, sampleMatchCount: options.length, lowestSampleTotal: Math.min(...options.map((option) => option.total!)) }] : [];
    });
    return {
      message: suggestions.length ? 'These single changes would yield matches. Ask before applying one; none has been applied.' : 'No single preference change tested produced matches. The catalog may lack this combination. Ask what cuisine or food the customer wants to change.',
      suggestions,
      protectedConstraints: { dietary: this.intent.dietary, allergens: this.intent.allergens, excludedIngredients: this.intent.excludedIngredients, excludedCuisines: this.intent.excludedCuisines, location: this.intent.location },
    };
  }
}
