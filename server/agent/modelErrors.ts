export class ModelServiceError extends Error {}

export async function modelHttpError(response: Response) {
  // Never expose the upstream message: authentication errors can contain key fragments.
  const body = await response.json().catch(() => null);
  const code = body?.error?.code;
  const type = body?.error?.type;
  if (code === 'credit_balance_exhausted') return new ModelServiceError('OpenAI API credits are exhausted. Add credits in your OpenAI Platform billing settings, then try again.');
  if (['organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'organization_usage_limit_exceeded'].includes(code)) return new ModelServiceError('The OpenAI API project or organization has reached its spending or usage limit. Check the applicable limit in OpenAI Platform settings.');
  if (code === 'insufficient_quota' || type === 'insufficient_quota') return new ModelServiceError('OpenAI API quota is unavailable. Check your API billing balance and project limits, then try again.');
  if (response.status === 401) return new ModelServiceError('OpenAI rejected the API key. Check OPENAI_API_KEY in the server .env file and restart the server.');
  if (response.status === 403 || response.status === 404) return new ModelServiceError('The OpenAI project cannot access the configured model. Check the key permissions and OPENAI_MODEL setting.');
  if (response.status === 429) return new ModelServiceError('OpenAI is rate-limiting requests. Wait briefly before sending another message.');
  if (response.status === 400) return new ModelServiceError('OpenAI rejected the model request configuration. Check the configured model and structured-output support.');
  return new ModelServiceError('OpenAI is temporarily unavailable. Please try again shortly.');
}
