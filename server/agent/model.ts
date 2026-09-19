import { z } from 'zod';
import { dietaryValues, dealValues, providerValues, extractionSchema, type ConversationContext } from '../../shared/intent.js';
import type { ChatRequest } from '../../shared/schemas.js';
import { baseIntent, extractLocal } from './intent.js';
import { plannerInstructions } from './instructions.js';

const strings = { type: 'array', items: { type: 'string' } };
const enums = (values: readonly string[]) => ({ type: 'array', items: { type: 'string', enum: values } });
const properties = {
  budget: { type: 'number' }, dietary: enums(dietaryValues), cuisines: strings,
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

const responseSchema = z.object({
  status: z.literal('completed'),
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  })),
});

export interface IntentExtractor {
  extract(request: ChatRequest, previous?: ConversationContext | null): Promise<z.infer<typeof extractionSchema> & {
    mode: 'model' | 'local'; warnings: string[]; failed?: boolean;
  }>;
}

export class FoodIntentExtractor implements IntentExtractor {
  constructor(private readonly config: { apiKey?: string; model?: string; fetch?: typeof fetch; mode?: string } = {}) {}

  async extract(request: ChatRequest, previous?: ConversationContext | null) {
    const local = extractLocal(request, previous);
    const apiKey = this.config.apiKey ?? process.env.OPENAI_API_KEY;
    const mode = this.config.mode ?? process.env.AGENT_MODE ?? 'auto';
    if (mode === 'local' || (!apiKey && mode === 'auto')) {
      return { ...local, mode: 'local' as const, warnings: ['Local language parser active; no AI model was used. Offers and prices are simulated.'] };
    }
    if (!apiKey) return { ...local, failed: true, clarification: 'The AI language service is not configured. Please try again after it is configured.', mode: 'local' as const, warnings: ['AI configuration is unavailable. No search was performed.'] };
    try {
      const response = await (this.config.fetch ?? fetch)('https://api.openai.com/v1/responses', {
        method: 'POST', signal: AbortSignal.timeout(12_000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          store: false, instructions: plannerInstructions,
          input: JSON.stringify({ message: request.message, baseline: baseIntent(request, previous), previousBestTotal: previous?.lastBestTotal ?? null, formDefaults: { budget: request.budget, dietary: request.dietary } }),
          max_output_tokens: 1400,
          text: { format: { type: 'json_schema', name: 'food_search_intent', strict: true, schema: extractionJsonSchema } },
        }),
      });
      if (!response.ok) throw new Error('Language provider unavailable');
      const body = responseSchema.parse(await response.json());
      const output = body.output.flatMap((item) => item.type === 'message' ? item.content ?? [] : [])
        .filter((item) => item.type === 'output_text').map((item) => item.text ?? '').join('');
      const parsed = extractionSchema.parse(JSON.parse(output));
      // Canonicalize model strings before exact matching against provider metadata.
      for (const key of ['cuisines', 'excludedCuisines', 'foods', 'excludedIngredients', 'allergens'] as const) {
        parsed.intent[key] = [...new Set(parsed.intent[key].map((value) => value.toLowerCase().trim()))];
      }
      return { ...parsed, mode: 'model' as const, warnings: [] };
    } catch {
      // Fail closed: an outage/refusal must not silently lose a language constraint.
      return { ...local, failed: true, clarification: 'I could not reliably interpret that request because the AI service is unavailable. Please retry, or use local mode for supported phrases.', mode: 'local' as const, warnings: ['AI interpretation failed or timed out. No search was performed.'] };
    }
  }
}
