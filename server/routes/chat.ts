import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { chatRequestSchema } from '../../shared/schemas.js';
import type { MealWiseStore } from '../db/mongo.js';
import { buildPlan } from '../agent/localAgent.js';

function buildReply(message: string, plan: ReturnType<typeof buildPlan>) {
  if (!plan.options.length) return 'I checked the verified Mountain View offers, but nothing fits that budget yet. Could you raise the budget or tell me about a different craving?';
  const first = plan.options[0];
  return `I hear you: “${message}”. My best value match is ${first.item} from ${first.restaurant} for $${(first.price + first.fee).toFixed(2)} total. I found ${plan.options.length} verified options and $${plan.savings.toFixed(2)} in possible savings.`;
}

export function createChatRouter(store: MealWiseStore) {
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
      const plan = buildPlan({ prompt: parsed.data.message, budget: parsed.data.budget, dietary: parsed.data.dietary });
      const reply = buildReply(parsed.data.message, plan);
      await store.saveConversationTurn(conversationId, parsed.data, reply, plan);
      return response.json({ conversationId, reply, plan });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
