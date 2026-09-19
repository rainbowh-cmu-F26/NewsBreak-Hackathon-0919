import type { ChatRequest } from '../../shared/schemas.js';
import type { ConversationContext } from '../../shared/intent.js';
import { FoodIntentExtractor, type IntentExtractor } from './model.js';
import { appliedFilters, searchOffers } from './search.js';
import { MockOfferProvider } from '../providers/mock.js';
import type { OfferProvider } from '../providers/types.js';

export class FoodAgent {
  constructor(
    private readonly extractor: IntentExtractor = new FoodIntentExtractor(),
    private readonly providers: OfferProvider[] = [new MockOfferProvider()],
  ) {}

  get dataSource() { return this.providers.some((provider) => provider.kind === 'live') ? 'provider-data' as const : 'verified-demo-data' as const; }

  async run(request: ChatRequest, previous?: ConversationContext | null) {
    const extraction = await this.extractor.extract(request, previous);
    const { intent, clarification, mode } = extraction;
    const search = clarification ? {
      plan: { summary: clarification, options: [], savings: 0, checkedAt: new Date().toISOString(), dataSource: this.dataSource }, warnings: [],
    } : await searchOffers(intent, this.providers);
    const warnings = [...extraction.warnings, ...search.warnings];
    if (search.plan.dataSource === 'verified-demo-data' && !warnings.some((warning) => warning.includes('simulated'))) warnings.push('Demo catalog only. No live Uber Eats, DoorDash, or Grubhub data has been fetched.');
    if (intent.allergens.length) warnings.push('Allergy filtering uses catalog ingredients and cross-contact metadata. Demo data cannot establish food safety; confirm directly with the restaurant.');
    const plan = { ...search.plan, agent: { intent, clarification, mode, warnings, appliedFilters: appliedFilters(intent) } };
    const best = plan.options[0];
    const reply = clarification ?? (best
      ? `${plan.summary} My ${intent.sortBy === 'fastest' ? 'fastest' : intent.sortBy === 'cheapest' ? 'lowest-price' : 'best-value'} match is ${best.item} from ${best.restaurant}: $${best.total!.toFixed(2)} estimated total, serving ${best.servings}. This option saves $${best.savings!.toFixed(2)} on food. ${best.priceNote}`
      : plan.summary);
    const context: ConversationContext = {
      intent, formBudget: request.budget, formDietary: request.dietary,
      lastBestTotal: best?.total ?? previous?.lastBestTotal ?? null,
    };
    return { plan, reply, context: extraction.failed && previous ? previous : context };
  }
}
