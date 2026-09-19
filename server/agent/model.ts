import { z } from 'zod';
import { dietaryValues, dealValues, providerValues, extractionSchema, type ConversationContext } from '../../shared/intent.js';
import type { ChatRequest } from '../../shared/schemas.js';
import { baseIntent, extractLocal } from './intent.js';
import { plannerInstructions } from './instructions.js';
import { ModelServiceError, modelHttpError } from './modelErrors.js';
import { extractWithGemini } from './gemini.js';

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
    mode: 'model' | 'local' | 'unavailable'; warnings: string[]; failed?: boolean;
  }>;
}

export class FoodIntentExtractor implements IntentExtractor {
  constructor(private readonly config: { provider?: 'openai' | 'gemini'; apiKey?: string; model?: string; fetch?: typeof fetch; mode?: string } = {}) {}

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
      const input = JSON.stringify({ message: request.message, baseline: baseIntent(request, previous), previousBestTotal: previous?.lastBestTotal ?? null, formDefaults: { budget: request.budget, dietary: request.dietary } });
      let extracted: unknown;
      if (provider === 'gemini') {
        extracted = await extractWithGemini({
          apiKey, model: this.config.model ?? process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite',
          input, schema: extractionJsonSchema, fetch: this.config.fetch ?? fetch,
        });
      } else {
        const response = await (this.config.fetch ?? fetch)('https://api.openai.com/v1/responses', {
          method: 'POST', signal: AbortSignal.timeout(12_000),
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.config.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
            store: false, instructions: plannerInstructions,
            input,
            max_output_tokens: 1400,
            text: { format: { type: 'json_schema', name: 'food_search_intent', strict: true, schema: extractionJsonSchema } },
          }),
        });
        if (!response.ok) throw await modelHttpError(response);
        const body = responseSchema.parse(await response.json());
        const output = body.output.flatMap((item) => item.type === 'message' ? item.content ?? [] : [])
          .filter((item) => item.type === 'output_text').map((item) => item.text ?? '').join('');
        extracted = JSON.parse(output);
      }
      const parsed = extractionSchema.parse(extracted);
      // Canonicalize model strings before exact matching against provider metadata.
      for (const key of ['cuisines', 'excludedCuisines', 'foods', 'excludedIngredients', 'allergens'] as const) {
        parsed.intent[key] = [...new Set(parsed.intent[key].map((value) => value.toLowerCase().trim()))];
      }
      return { ...parsed, mode: 'model' as const, warnings: [] };
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
