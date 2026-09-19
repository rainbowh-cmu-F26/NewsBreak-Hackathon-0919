import { z } from 'zod';
import { extractWithGemini } from './gemini.js';
import { ModelServiceError, modelHttpError } from './modelErrors.js';

export type ModelConfig = { provider?: 'openai' | 'gemini'; apiKey?: string; model?: string; fetch?: typeof fetch; mode?: string };
const responseSchema = z.object({
  status: z.literal('completed'),
  output: z.array(z.object({ type: z.string(), content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional() })),
});
export async function requestStructured(config: ModelConfig, instructions: string, input: unknown, schema: unknown, signal = AbortSignal.timeout(12_000)) {
  const provider = config.provider ?? process.env.AI_PROVIDER ?? 'openai';
  const apiKey = (config.apiKey ?? process.env[provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY'])?.trim();
  if (!apiKey) throw new ModelServiceError('AI configuration is unavailable.');
  if (provider === 'gemini') return extractWithGemini({ apiKey, model: config.model ?? process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite', input: JSON.stringify(input), schema, instructions, signal, fetch: config.fetch ?? fetch });
  if (provider !== 'openai') throw new ModelServiceError('Set AI_PROVIDER to gemini or openai in the server .env file.');
  const response = await (config.fetch ?? fetch)('https://api.openai.com/v1/responses', {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini', store: false, instructions, input: JSON.stringify(input), max_output_tokens: 2000, text: { format: { type: 'json_schema', name: 'mealwise_action', strict: true, schema } } }),
  });
  if (!response.ok) throw await modelHttpError(response);
  const body = responseSchema.parse(await response.json());
  return JSON.parse(body.output.flatMap((item) => item.type === 'message' ? item.content ?? [] : []).filter((part) => part.type === 'output_text').map((part) => part.text ?? '').join('')) as unknown;
}
