import { Router } from 'express';
import { planRequestSchema } from '../../shared/schemas.js';
import { buildPlan } from '../agent/localAgent.js';

export const planRouter = Router();
planRouter.post('/', (request, response) => {
  const parsed = planRequestSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Tell us what you need, your budget, and dietary preference.' });
  return response.json(buildPlan(parsed.data));
});
