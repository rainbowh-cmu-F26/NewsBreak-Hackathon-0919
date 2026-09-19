import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../app.js';
import { buildPlan } from '../agent/localAgent.js';
import { createStore } from '../db/mongo.js';
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

test('requires a CORS allowlist in production', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousCorsOrigin = process.env.CORS_ORIGIN;
  process.env.NODE_ENV = 'production';
  delete process.env.CORS_ORIGIN;
  try {
    assert.throws(() => createApp(new TestStore()), /CORS_ORIGIN must be configured in production/);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousCorsOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previousCorsOrigin;
  }
});

test('requires MongoDB in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMongoUri = process.env.MONGODB_URI;
  process.env.NODE_ENV = 'production';
  delete process.env.MONGODB_URI;
  try {
    await assert.rejects(() => createStore(), /MONGODB_URI must be configured in production/);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousMongoUri;
  }
});

test('keeps in-memory store for non-production without MongoDB URI', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMongoUri = process.env.MONGODB_URI;
  process.env.NODE_ENV = 'test';
  delete process.env.MONGODB_URI;
  try {
    const store = await createStore();
    await assert.doesNotReject(() => store.saveConversationTurn('conversation', { message: 'Hi', budget: 10, dietary: 'No preference' }, 'reply', buildPlan({ prompt: 'Dinner', budget: 10, dietary: 'No preference' })));
    await store.close();
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousMongoUri;
  }
});
