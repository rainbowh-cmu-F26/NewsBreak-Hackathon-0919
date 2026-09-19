import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { quoteSchema } from '../../shared/quotes.js';
import { buildPlan } from '../agent/localAgent.js';
import { planRequestSchema, type ChatRequest, type PlanResponse } from '../../shared/schemas.js';
import { FoodAgent } from '../agent/foodAgent.js';

type PlanAgent = {
  dataSource: PlanResponse['dataSource'];
  run(request: ChatRequest): Promise<{ plan: PlanResponse }>;
};

export function createPlanRouter(agent: PlanAgent = new FoodAgent()) {
  const planRouter = Router();
  // Homepage browsing uses the existing demo catalog without AI interpretation.
  planRouter.post('/defaults', (_request, response, next) => {
    try {
      const quotes = ['three-platform-demo.json', 'bogo-demo-quotes.json'].flatMap(file =>
        quoteSchema.array().parse(JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'))));
      return response.json(buildPlan({ prompt: 'All restaurants', budget: 35, dietary: 'No preference', mode: 'simulation' }, quotes));
    } catch (error) { return next(error); }
  });
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
