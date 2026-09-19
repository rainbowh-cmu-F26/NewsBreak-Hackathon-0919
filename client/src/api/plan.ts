import type { PlanRequest, PlanResponse } from '../../../shared/schemas';
import { planResponseSchema } from '../../../shared/schemas';
import { postJson } from './request';

export async function fetchPlan(request: PlanRequest): Promise<PlanResponse> {
  return planResponseSchema.parse(await postJson('/api/plan', request));
}

export async function fetchDefaultPlan(): Promise<PlanResponse> {
  return planResponseSchema.parse(await postJson('/api/plan/defaults', {}));
}
