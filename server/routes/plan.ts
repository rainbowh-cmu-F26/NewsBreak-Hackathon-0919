import { Router } from 'express';
import { planRequestSchema } from '../../shared/schemas.js';
import { buildPlan } from '../agent/localAgent.js';

import type { MealWiseStore } from '../db/mongo.js';
export function createPlanRouter(store: MealWiseStore) {
const planRouter = Router();
planRouter.post('/', async (request, response, next) => {
  const parsed = planRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      error: 'Tell us what you need, your budget, and dietary preference.',
      issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
    });
  }
  try { return response.json(buildPlan(parsed.data, await store.listQuotes())); } catch (error) { return next(error); }
});

return planRouter;
}
