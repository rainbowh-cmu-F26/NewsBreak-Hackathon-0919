import type { ChatRequest } from '../../shared/schemas.js';
import type { ConversationContext } from '../../shared/intent.js';
import { FoodIntentExtractor, type IntentExtractor } from './model.js';
import { appliedFilters, searchOffers } from './search.js';
import { MockOfferProvider } from '../providers/mock.js';
import type { OfferProvider } from '../providers/types.js';
import { CatalogConversation, type ConversationResponder } from './conversation.js';
import { CatalogTools } from './catalogTools.js';

export class FoodAgent {
  private readonly extractor: IntentExtractor;
  private readonly conversation?: ConversationResponder;
  constructor(
    extractor?: IntentExtractor,
    private readonly providers: OfferProvider[] = [new MockOfferProvider()],
    conversation?: ConversationResponder,
  ) {
    this.extractor = extractor ?? new FoodIntentExtractor();
    // Explicit extractor injection can run offline or isolated extraction tests.
    this.conversation = conversation ?? (extractor ? undefined : new CatalogConversation());
  }

  get dataSource() { return this.providers.some((provider) => provider.kind === 'live') ? 'provider-data' as const : this.providers.some((provider) => provider.kind === 'database') ? 'database-data' as const : 'verified-demo-data' as const; }

  async run(request: ChatRequest, previous?: ConversationContext | null) {
    const extraction = await this.extractor.extract(request, previous);
    const { intent, clarification, mode } = extraction;
    const search = clarification ? {
      plan: { summary: clarification, options: [], savings: 0, checkedAt: new Date().toISOString(), dataSource: this.dataSource }, warnings: [], rows: [], mock: this.dataSource === 'verified-demo-data',
    } : await searchOffers(intent, this.providers);
    const warnings = [...extraction.warnings, ...search.warnings];
    if (search.plan.dataSource === 'verified-demo-data' && !warnings.some((warning) => warning.includes('simulated'))) warnings.push('Demo catalog only. No live Uber Eats, DoorDash, or Grubhub data has been fetched.');
    if (intent.allergens.length) warnings.push('Allergy filtering uses catalog ingredients and cross-contact metadata. Demo data cannot establish food safety; confirm directly with the restaurant.');
    const plan = { ...search.plan, agent: { intent, clarification, mode, warnings, appliedFilters: appliedFilters(intent) } };
    const best = plan.options[0];
    let reply = clarification ?? (best
      ? `${plan.summary} My ${intent.sortBy === 'fastest' ? 'fastest' : intent.sortBy === 'cheapest' ? 'lowest-price' : 'best-value'} match is ${best.item} from ${best.restaurant}: $${best.total!.toFixed(2)} estimated total, serving ${best.servings}. This option saves $${best.savings!.toFixed(2)} on food. ${best.priceNote}`
      : plan.summary);
    if (!clarification && mode === 'model' && this.conversation) {
      try {
        reply = await this.conversation.reply(request.message, intent, previous, new CatalogTools(intent, search.rows, search.mock, plan));
      } catch {
        warnings.push('Conversational explanation is temporarily unavailable; showing the validated search summary.');
      }
    }
    const context: ConversationContext = {
      intent, formBudget: request.budget, formDietary: request.dietary,
      lastBestTotal: best?.total ?? previous?.lastBestTotal ?? null,
      recentTurns: [...(previous?.recentTurns ?? []), { role: 'user' as const, content: request.message }, { role: 'assistant' as const, content: reply }].slice(-8),
    };
    return { plan, reply, context: extraction.failed && previous ? previous : context };
  }
}
