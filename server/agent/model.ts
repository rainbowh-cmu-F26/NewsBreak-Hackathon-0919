import { z } from 'zod';
import { dietaryValues, dealValues, providerValues, extractionSchema, type ConversationContext } from '../../shared/intent.js';
import type { ChatRequest } from '../../shared/schemas.js';
import { baseIntent, extractLocal } from './intent.js';
import { plannerInstructions } from './instructions.js';
import { ModelServiceError } from './modelErrors.js';
import { requestStructured, type ModelConfig } from './structuredModel.js';
import { normalizeIntent, cuisineTerms, foodTerms, cuisineGroups } from './vocabulary.js';

const strings = { type: 'array', items: { type: 'string' } };
const enums = (values: readonly string[]) => ({ type: 'array', items: { type: 'string', enum: values } });
const properties = {
  budget: { type: 'number' }, dietary: enums(dietaryValues), cuisines: strings,
  preferredCuisines: strings, preferredFoods: strings, preferredDietary: enums(dietaryValues),
  excludedCuisines: strings, foods: strings, excludedIngredients: strings, allergens: strings,
  deals: enums(dealValues), providers: enums(providerValues), servings: { type: 'integer' },
  maxEtaMinutes: { type: ['integer', 'null'] }, sortBy: { type: 'string', enum: ['best-value', 'cheapest', 'fastest'] },
  newCustomer: { type: ['boolean', 'null'] }, location: { type: 'string' },
};
export const extractionJsonSchema = {
  type: 'object', additionalProperties: false, required: ['intent', 'clarification'],
  properties: {
    intent: { type: 'object', additionalProperties: false, properties, required: Object.keys(properties) },
    clarification: { type: ['string', 'null'] },
  },
};

export interface IntentExtractor {
  extract(request: ChatRequest, previous?: ConversationContext | null): Promise<z.infer<typeof extractionSchema> & {
    mode: 'model' | 'local' | 'unavailable'; warnings: string[]; failed?: boolean;
  }>;
}

export class FoodIntentExtractor implements IntentExtractor {
  constructor(private readonly config: ModelConfig = {}) {}

  async extract(request: ChatRequest, previous?: ConversationContext | null) {
    const local = extractLocal(request, previous);
    const provider = this.config.provider ?? process.env.AI_PROVIDER ?? 'openai';
    const providerName = provider === 'gemini' ? 'Gemini' : 'OpenAI';
    const keyName = provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    const apiKey = (this.config.apiKey ?? process.env[keyName])?.trim();
    const mode = this.config.mode ?? process.env.AGENT_MODE ?? 'auto';
    if (mode === 'local' || (!apiKey && mode === 'auto')) {
      return { ...local, mode: 'local' as const, warnings: ['Local language parser active; no AI model was used. Offers and prices are simulated.'] };
    }
    if (!apiKey) return { ...local, failed: true, clarification: `Add ${keyName} to the server .env file and restart the server to enable AI interpretation.`, mode: 'unavailable' as const, warnings: ['AI configuration is unavailable. No search was performed.'] };
    try {
      if (provider !== 'openai' && provider !== 'gemini') throw new ModelServiceError('Set AI_PROVIDER to gemini or openai in the server .env file.');
      const input = { message: request.message, baseline: baseIntent(request, previous), previousBestTotal: previous?.lastBestTotal ?? null, recentTurns: previous?.recentTurns ?? [], formDefaults: { budget: request.budget, dietary: request.dietary }, vocabulary: { cuisines: cuisineTerms, foods: foodTerms, cuisineGroups } };
      const extracted = await requestStructured(this.config, plannerInstructions, input, extractionJsonSchema);
      const parsed = extractionSchema.parse(extracted);
      // Canonicalize model strings before exact matching against provider metadata.
      for (const key of ['cuisines', 'excludedCuisines', 'foods', 'excludedIngredients', 'allergens', 'preferredCuisines', 'preferredFoods'] as const) {
        parsed.intent[key] = [...new Set(parsed.intent[key].map((value) => value.toLowerCase().trim()))];
      }
      return { ...parsed, intent: normalizeIntent(parsed.intent), mode: 'model' as const, warnings: [] };
    } catch (error) {
      // Fail closed: an outage/refusal must not silently lose a language constraint.
      const clarification = error instanceof ModelServiceError ? error.message
        : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
          ? 'The AI request exceeded its 12-second time limit. Please try again.'
          : error instanceof z.ZodError || error instanceof SyntaxError
            ? 'The AI returned an incomplete or invalid interpretation. Please rephrase your food request and try again.'
            : `The server could not connect to ${providerName}. Check the server internet connection and try again.`;
      return { ...local, failed: true, clarification, mode: 'unavailable' as const, warnings: ['AI interpretation did not complete. No search was performed.'] };
    }
  }
}
