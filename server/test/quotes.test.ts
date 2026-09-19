import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { quoteSchema } from '../../shared/quotes.js';
import { buildPlan } from '../agent/localAgent.js';
import { createApp } from '../app.js';
const quotes = quoteSchema.array().parse(JSON.parse(readFileSync(new URL('../data/quotes.json', import.meta.url), 'utf8')));
const input = { prompt: 'rice bowl', budget: 20, dietary: 'No preference' as const };
test('uses complete checkout total once and labels synthetic data', () => {
  const plan = buildPlan(input, quotes);
  assert.equal(plan.options[0].price + plan.options[0].fee, 17.69);
  assert.equal(plan.savings, 0);
  assert.equal(plan.options[0].verified, false);
});
test('excludes incomplete, unavailable and unconfirmed discounted quotes', () => {
  assert.equal(buildPlan(input, [{...quotes[0], price_complete: false}]).options.length, 0);
  assert.equal(buildPlan(input, [{...quotes[0], availability: 'unavailable'}]).options.length, 0);
  assert.equal(buildPlan(input, [{...quotes[0], offers: [{description: 'new user', applied: true, eligibility_status: 'unconfirmed'}]}]).options.length, 0);
});
test('rejects snapshots without evidence and complete quotes without total', () => {
  assert.equal(quoteSchema.safeParse({...quotes[0], data_type: 'checkout_snapshot'}).success, false);
  assert.equal(quoteSchema.safeParse({...quotes[0], displayed_total_cents: null}).success, false);
});
test('plan and chat read quotes from the injected database store', async () => {
  const store = { listQuotes: async () => [{...quotes[0], displayed_total_cents: 999}], saveConversationTurn: async () => {}, close: async () => {} };
  for (const path of ['plan', 'chat']) {
    const body = path === 'plan' ? input : {message: input.prompt, budget: 20, dietary: input.dietary};
    const result = await request(createApp(store)).post(`/api/${path}`).send(body);
    assert.equal(result.status, 200);
    const plan = path === 'plan' ? result.body : result.body.plan;
    assert.equal(plan.options[0].price, 9.99);
  }
});
