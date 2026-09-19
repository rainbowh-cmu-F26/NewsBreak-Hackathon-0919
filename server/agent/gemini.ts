import { z } from 'zod';
import { plannerInstructions } from './instructions.js';
import { ModelServiceError } from './modelErrors.js';

const geminiResponseSchema = z.object({
  candidates: z.array(z.object({
    finishReason: z.literal('STOP'),
    content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) }),
  })).min(1),
});

/** Native Gemini transport. Keys stay in server headers, never in URLs or client code. */
export async function extractWithGemini(options: {
  apiKey: string; model: string; input: string; schema: unknown; fetch: typeof fetch; instructions?: string; signal?: AbortSignal;
}) {
  const response = await options.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`, {
    method: 'POST', signal: options.signal ?? AbortSignal.timeout(12_000),
    headers: { 'x-goog-api-key': options.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: options.instructions ?? plannerInstructions }] },
      contents: [{ role: 'user', parts: [{ text: options.input }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: options.schema, maxOutputTokens: 4096 },
    }),
  });
  if (!response.ok) {
    // Do not surface provider messages, which can contain credentials or user text.
    const error = await response.json().catch(() => null);
    const invalidKey = Array.isArray(error?.error?.details) && error.error.details.some((detail: { reason?: string }) => detail.reason === 'API_KEY_INVALID');
    if (invalidKey || response.status === 401) throw new ModelServiceError('Gemini rejected the API key. Check GEMINI_API_KEY in the server .env file and restart the server.');
    if (response.status === 403) throw new ModelServiceError('Gemini denied access. Check that the API key and its Google project allow the Gemini API.');
    if (response.status === 404) throw new ModelServiceError('The configured Gemini model is unavailable to this key. Check GEMINI_MODEL and model access in Google AI Studio.');
    if (response.status === 429) throw new ModelServiceError('Gemini quota or rate limit reached. Check the API project quota in Google AI Studio before trying again.');
    if (response.status === 400) throw new ModelServiceError('Gemini rejected the request configuration. Check the model and structured-output settings.');
    throw new ModelServiceError('Gemini is temporarily unavailable. Please try again shortly.');
  }
  const body = geminiResponseSchema.parse(await response.json());
  const output = body.candidates[0].content.parts.filter((part) => !part.thought).map((part) => part.text ?? '').join('');
  return JSON.parse(output) as unknown;
}
