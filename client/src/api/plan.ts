import type { PlanRequest, PlanResponse } from '../../../shared/schemas';
import { planResponseSchema } from '../../../shared/schemas';

export async function fetchPlan(request: PlanRequest): Promise<PlanResponse> {
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (!response.ok) throw new Error('The planner is taking a break. Please try again.');
  return planResponseSchema.parse(await response.json());
}
