import type { PlanRequest } from '../../shared/schemas.js';
import { mockRows } from '../providers/mock.js';
import { extractLocal } from './intent.js';
import { appliedFilters, planOffers } from './search.js';

/** Synchronous offline entry point, also useful for deterministic evaluations. */
export function buildPlan(request: PlanRequest) {
  const extraction = extractLocal({ message: request.prompt, budget: request.budget, dietary: request.dietary });
  const plan = planOffers(extraction.intent, extraction.clarification ? [] : mockRows());
  if (extraction.clarification) plan.summary = extraction.clarification;
  plan.agent = { ...extraction, mode: 'local', warnings: ['Demo offers; no live provider search.'], appliedFilters: appliedFilters(extraction.intent) };
  return plan;
}
