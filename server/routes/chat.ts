import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { chatRequestSchema } from '../../shared/schemas.js';
import type { MealWiseStore } from '../db/mongo.js';
import { FoodAgent } from '../agent/foodAgent.js';

export function createChatRouter(store: MealWiseStore, agent = new FoodAgent()) {
  const router = Router();
  router.post('/', async (request, response, next) => {
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: 'Tell MealWise what you want, your budget, and dietary preference.',
        issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
      });
    }

    try {
      const conversationId = parsed.data.conversationId || randomUUID();
      const previous = await store.getConversationContext(conversationId);
      const { plan, reply, context } = await agent.run(parsed.data, previous);
      await store.saveConversationTurn(conversationId, parsed.data, reply, plan, context);
      return response.json({ conversationId, reply, plan });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
