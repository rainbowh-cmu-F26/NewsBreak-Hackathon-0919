import { Router } from 'express';
import { planRequestSchema } from '../../shared/schemas.js';
import { FoodAgent } from '../agent/foodAgent.js';

export function createPlanRouter(agent = new FoodAgent()) {
  const planRouter = Router();
  planRouter.post('/', async (request, response, next) => {
    const parsed = planRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: 'Tell us what you need, your budget, and dietary preference.',
        issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
      });
    }
    try {
      const { plan } = await agent.run({ message: parsed.data.prompt, budget: parsed.data.budget, dietary: parsed.data.dietary });
      return response.json(plan);
    } catch (error) { return next(error); }
  });
  return planRouter;
}
