import { planResponseSchema } from '../../../shared/schemas';

export async function fetchCatalog(signal?: AbortSignal) {
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/catalog`, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('The catalog could not be loaded. Please retry.');
  return planResponseSchema.parse(await response.json());
}
