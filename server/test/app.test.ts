import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../app.js';
import { buildPlan } from '../agent/localAgent.js';
import type { ChatRequest, PlanResponse } from '../../shared/schemas.js';
import type { MealWiseStore } from '../db/mongo.js';

class TestStore implements MealWiseStore {
  turns: Array<{ conversationId: string; request: ChatRequest; reply: string; plan: PlanResponse }> = [];
  async saveConversationTurn(conversationId: string, request: ChatRequest, reply: string, plan: PlanResponse) {
    this.turns.push({ conversationId, request, reply, plan });
  }
  async close() {}
}

test('ranks verified vegetarian options within budget', () => {
  const plan = buildPlan({ prompt: 'vegetarian dinner', budget: 18, dietary: 'Vegetarian' });
  assert.equal(plan.dataSource, 'verified-demo-data');
  assert.ok(plan.options.length > 0);
  assert.ok(plan.options.every((option) => option.price + option.fee <= 18 && option.verified));
  assert.equal(plan.options[0].restaurant, 'Little Hunan');
});

test('rejects malformed planner requests with useful issues', async () => {
  const response = await request(createApp(new TestStore())).post('/api/plan').send({ prompt: 'x', budget: 0, dietary: 'Carnivore' });
  assert.equal(response.status, 400);
  assert.equal(response.body.issues.length, 3);
});

test('persists chat turns and returns a plan', async () => {
  const store = new TestStore();
  const response = await request(createApp(store)).post('/api/chat').send({ message: 'Find a vegan dinner', budget: 15, dietary: 'Vegan' });
  assert.equal(response.status, 200);
  assert.match(response.body.conversationId, /^[0-9a-f-]{36}$/);
  assert.equal(response.body.plan.options[0].restaurant, 'Green Garden');
  assert.equal(store.turns.length, 1);
  assert.equal(store.turns[0].request.message, 'Find a vegan dinner');
});
