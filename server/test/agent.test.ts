import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { chatResponseSchema } from '../../shared/schemas.js';
import { baseIntent, extractLocal } from '../agent/intent.js';
import { FoodIntentExtractor } from '../agent/model.js';
import { FoodAgent } from '../agent/foodAgent.js';
import { planOffers, searchOffers } from '../agent/search.js';
import { mockRows } from '../providers/mock.js';
import { catalogOfferSchema } from '../providers/types.js';
import { createApp } from '../app.js';
import { createStore } from '../db/mongo.js';

const input = (message: string) => ({ message, budget: 25, dietary: 'No preference' as const });
const agent = () => new FoodAgent(new FoodIntentExtractor({ mode: 'local' }));

test('extracts diet, cuisine, BOGO, servings, budget and provider together', async () => {
  const result = await agent().run(input('Vegan Mexican BOGO for two under $20 on Grubhub'));
  const intent = result.plan.agent.intent;
  assert.deepEqual(intent.dietary, ['vegan']);
  assert.deepEqual(intent.cuisines, ['mexican']);
  assert.deepEqual(intent.deals, ['bogo']);
  assert.deepEqual(intent.providers, ['grubhub']);
  assert.equal(intent.servings, 2);
  assert.equal(intent.budget, 20);
  assert.equal(result.plan.options.length, 1);
  assert.equal(result.plan.options[0].id, 'grubhub:p9');
  assert.equal(result.plan.options[0].total, 12.49);
  assert.equal(result.plan.options[0].quantity, 1);
});

test('negated foods are excluded, including follow-up corrections', async () => {
  const first = await agent().run(input('Vegetarian noodles under $20'));
  assert.ok(first.plan.options.length);
  const second = await agent().run(input('No noodles, Mexican instead'), first.context);
  assert.ok(second.plan.options.length);
  assert.deepEqual(second.plan.agent.intent.excludedIngredients, ['noodles']);
  assert.deepEqual(second.plan.agent.intent.cuisines, ['mexican']);
  assert.ok(second.plan.options.every((option) => !option.tags.includes('noodles')));
  assert.equal(second.plan.agent.intent.budget, 20);
});

test('strict budget includes tax, service fee, and delivery', async () => {
  const result = await agent().run(input('Vegan Mexican BOGO under $12'));
  assert.equal(result.plan.options.length, 0); // $11 food is $12.49 after fees/tax.
  const exact = await agent().run(input('Vegan Mexican BOGO under $12.49'));
  assert.equal(exact.plan.options[0].total, 12.49);
});

test('servings price whole BOGO bundles and savings refer to one option', async () => {
  const result = await agent().run(input('Mexican BOGO for three under $30'));
  const best = result.plan.options[0];
  assert.equal(best.quantity, 2);
  assert.equal(best.servings, 4);
  assert.equal(best.total, 24.48);
  assert.equal(result.plan.savings, best.savings);
  const perPerson = extractLocal(input('Vegan for two under $10 per person'));
  assert.equal(perPerson.intent.budget, 20);
});

test('cheaper follow-up retains dietary restrictions and lowers previous total', async () => {
  const first = await agent().run(input('Vegetarian dinner under $20'));
  const second = await agent().run(input('Make it cheaper'), first.context);
  assert.ok(second.plan.options.length);
  assert.ok(second.plan.options.every((option) => option.total! < first.plan.options[0].total! && option.tags.includes('vegetarian')));
  assert.equal(second.plan.agent.intent.sortBy, 'cheapest');
});

test('form changes override old form defaults and new search clears prior constraints', async () => {
  const first = await agent().run(input('Vegan Mexican BOGO under $20'));
  const second = await agent().run({ ...input('Any cuisine, any deal'), budget: 30, dietary: 'Vegetarian' }, first.context);
  assert.equal(second.plan.agent.intent.budget, 30);
  assert.deepEqual(second.plan.agent.intent.dietary, ['vegetarian']);
  assert.deepEqual(second.plan.agent.intent.deals, []);
  assert.deepEqual(second.plan.agent.intent.cuisines, []);
  const reset = await agent().run(input('Start over'), first.context);
  assert.deepEqual(reset.plan.agent.intent.dietary, []);
  assert.equal(reset.plan.agent.intent.budget, 25);
});

test('time bounds are not accidentally parsed as price bounds', () => {
  const result = extractLocal(input('Vegan dinner within 20 minutes'));
  assert.equal(result.intent.maxEtaMinutes, 20);
  assert.equal(result.intent.budget, 25);
});

test('free delivery and ETA restrictions are enforced together', async () => {
  const result = await agent().run(input('Free delivery within 30 minutes, fastest'));
  assert.ok(result.plan.options.length);
  assert.ok(result.plan.options.every((option) => option.fee === 0 && Number(option.eta.match(/\d+/)?.[0]) <= 30));
  assert.equal(result.plan.options[0].id, 'uber-eats:p7');
});

test('allergies exclude ingredients, cross-contact, and unknown metadata', () => {
  const intent = extractLocal(input('Allergic to peanuts')).intent;
  assert.deepEqual(intent.allergens, ['peanut']);
  const rows = mockRows();
  const unsafe = rows.find((row) => row.id === 'p1')!;
  const unknown = { ...rows.find((row) => row.id === 'p4')!, allergyInfoComplete: false };
  assert.equal(planOffers(intent, [unsafe, unknown]).options.length, 0);
  assert.ok(planOffers(intent, rows).options.every((option) => option.id !== 'uber-eats:p1' && option.id !== 'grubhub:p3'));
});

test('unsupported medical diets clarify and never return guessed matches', async () => {
  const result = await agent().run(input('I need a low sodium meal'));
  assert.ok(result.plan.agent.clarification);
  assert.equal(result.plan.options.length, 0);
});

test('common allergy wording and lists are interpreted without treating them as preferences', () => {
  assert.deepEqual(extractLocal(input('I have a peanut allergy')).intent.allergens, ['peanut']);
  assert.deepEqual(extractLocal(input('I have a nut allergy')).intent.allergens.sort(), ['peanut', 'tree-nut']);
  assert.deepEqual(extractLocal(input('No peanuts or milk')).intent.excludedIngredients.sort(), ['milk', 'peanut']);
  assert.ok(extractLocal(input('Allergic to an unknown ingredient')).clarification);
});

test('dietary alternatives and cuisine corrections do not retain negated choices', () => {
  assert.deepEqual(extractLocal(input('Not Chinese, Mexican instead')).intent.cuisines, ['mexican']);
  assert.deepEqual(extractLocal(input('Not vegan but vegetarian')).intent.dietary, ['vegetarian']);
  assert.deepEqual(extractLocal(input('No meat')).intent.dietary, ['vegetarian']);
  assert.deepEqual(extractLocal(input('Lactose intolerant dinner')).intent.dietary, ['dairy-free']);
});

test('out-of-range constraints and unrecognized requests ask for clarification', async () => {
  for (const message of ['Dinner under $0', 'Dinner for 50', 'Dinner within 999 minutes', 'What is the capital of France?']) {
    const result = await agent().run(input(message));
    assert.ok(result.plan.agent.clarification, message);
    assert.equal(result.plan.options.length, 0, message);
  }
});

test('explicitly removing a food exclusion restores otherwise matching results', async () => {
  const first = await agent().run(input('Vegan Mexican BOGO, no cilantro'));
  assert.equal(first.plan.options.length, 0);
  const second = await agent().run(input('Cilantro is okay'), first.context);
  assert.equal(second.plan.options[0].id, 'grubhub:p9');
  assert.deepEqual(second.plan.agent.intent.excludedIngredients, []);
});

test('ordinary chicken requests find dishes without assuming promotion eligibility', async () => {
  const result = await agent().run(input("hello, i'm looking for chicken dishes"));
  assert.deepEqual(result.plan.agent.intent.foods, ['chicken']);
  assert.equal(result.plan.agent.intent.newCustomer, null);
  assert.deepEqual(result.plan.options.map((option) => option.id), ['uber-eats:p12', 'grubhub:p13']);
  assert.ok(result.plan.options.every((option) => option.tags.includes('chicken') && option.total! <= 25));
  const returning = await agent().run(input('I am a returning customer'), result.context);
  assert.equal(returning.plan.options.length, 2);
});

test('chicken options still respect diet, allergy and total budget restrictions', () => {
  const intent = extractLocal(input('Chicken dishes')).intent;
  assert.equal(planOffers({ ...intent, dietary: ['vegan'] }, mockRows()).options.length, 0);
  assert.equal(planOffers({ ...intent, budget: 10 }, mockRows()).options.length, 0);
  assert.deepEqual(planOffers({ ...intent, allergens: ['milk'] }, mockRows()).options.map((option) => option.id), ['uber-eats:p12']);
});

test('new-customer promotion is unavailable until eligibility is explicit', async () => {
  const first = await agent().run(input('Chicken tacos on DoorDash under $25'));
  assert.equal(first.plan.options.length, 0);
  const second = await agent().run(input('I am a new customer'), first.context);
  assert.equal(second.plan.options[0].id, 'doordash:p2');
});

test('catalog validation excludes expired, invalid, unavailable, and out-of-area offers', () => {
  const intent = baseIntent(input('Dinner'));
  const [row] = mockRows();
  assert.ok(mockRows().every((offer) => catalogOfferSchema.safeParse(offer).success));
  const rows = [
    { ...row, expiresAt: '2020-01-01T00:00:00.000Z' },
    { ...row, price: -1 }, { ...row, available: false }, { ...row, location: 'San Francisco' },
  ];
  assert.equal(planOffers(intent, rows).options.length, 0);
});

test('inconsistent promotion claims are rejected before recommendation', () => {
  const [row] = mockRows();
  const rows = [{ ...row, deliveryFee: 2 }, { ...row, originalPrice: row.price }, { ...row, servings: 1 }];
  assert.equal(planOffers(baseIntent(input('BOGO')), rows).options.length, 0);
});

test('unknown locations do not receive Mountain View offers', async () => {
  const result = await agent().run(input('Deliver to San Francisco'));
  assert.equal(result.plan.options.length, 0);
});

test('provider failures return partial results and never replace live results with fixtures', async () => {
  const intent = baseIntent(input('Dinner'));
  const result = await searchOffers(intent, [
    { id: 'mock', kind: 'mock', async search() { throw new Error('Must not be called'); } },
    { id: 'failed', kind: 'live', async search() { throw new Error('Unavailable'); } },
    { id: 'working', kind: 'live', async search() { return mockRows(); } },
  ]);
  assert.ok(result.plan.options.length);
  assert.equal(result.plan.dataSource, 'provider-data');
  assert.equal(result.warnings.length, 1);
  const failed = await searchOffers(intent, [{ id: 'failed', kind: 'live', async search() { throw new Error(); } }]);
  assert.equal(failed.plan.options.length, 0);
  assert.match(failed.plan.summary, /unavailable/);
});

test('HTTP conversation state survives follow-ups and stays isolated across conversations', async () => {
  const store = await createStore('');
  const app = createApp(store, agent());
  const first = await request(app).post('/api/chat').send(input('Vegan Mexican BOGO for two under $20'));
  assert.equal(first.status, 200);
  assert.ok(chatResponseSchema.safeParse(first.body).success);
  const second = await request(app).post('/api/chat').send({ ...input('No cilantro'), conversationId: first.body.conversationId });
  assert.equal(second.status, 200);
  assert.equal(second.body.plan.options.length, 0);
  assert.equal(second.body.plan.agent.intent.servings, 2);
  assert.deepEqual(second.body.plan.agent.intent.dietary, ['vegan']);
  const other = await request(app).post('/api/chat').send(input('Dinner'));
  assert.notEqual(other.body.conversationId, first.body.conversationId);
  assert.deepEqual(other.body.plan.agent.intent.excludedIngredients, []);
  await store.close();
});

test('planner endpoint uses the same intent extraction as chat', async () => {
  const store = await createStore('');
  const response = await request(createApp(store, agent())).post('/api/plan').send({ prompt: 'Vegan Mexican BOGO for two under $20', budget: 25, dietary: 'No preference' });
  assert.equal(response.status, 200);
  assert.equal(response.body.options[0].id, 'grubhub:p9');
  await store.close();
});

test('hosted model uses structured output and sends only intent context, not database records', async () => {
  const intent = baseIntent(input('Dinner'));
  intent.cuisines = ['Mexican'];
  const fakeFetch: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.model, 'test-model');
    assert.ok(!JSON.parse(body.input).offers);
    return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ intent, clarification: null }) }] }] }));
  };
  const extractor = new FoodIntentExtractor({ mode: 'model', apiKey: 'test-key', model: 'test-model', fetch: fakeFetch });
  const result = await new FoodAgent(extractor).run(input('Mexican please'));
  assert.equal(result.plan.agent.mode, 'model');
  assert.deepEqual(result.plan.agent.intent.cuisines, ['mexican']);
  assert.ok(result.plan.options.every((option) => option.cuisine === 'mexican'));
});

test('model errors, refusals, malformed output and invalid constraints fail closed', async () => {
  const responses = [
    () => new Response('{}', { status: 429 }),
    () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] })),
    () => new Response(JSON.stringify({ status: 'incomplete', output: [] })),
    () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{broken' }] }] })),
    () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ intent: { ...baseIntent(input('Dinner')), budget: -10 }, clarification: null }) }] }] })),
    () => { throw new Error('Timeout'); },
  ];
  for (const respond of responses) {
    const extractor = new FoodIntentExtractor({ mode: 'model', apiKey: 'test-key', fetch: async () => respond() });
    const result = await new FoodAgent(extractor).run(input('Vegan dinner'));
    assert.equal(result.plan.options.length, 0);
    assert.ok(result.plan.agent.clarification);
  }
});

test('model outages preserve the last good conversational state', async () => {
  const first = await agent().run(input('Vegan Mexican BOGO for two under $20'));
  const failing = new FoodIntentExtractor({ mode: 'model', apiKey: 'test-key', fetch: async () => { throw new Error('Unavailable'); } });
  const second = await new FoodAgent(failing).run(input('Start over'), first.context);
  assert.deepEqual(second.context, first.context);
  assert.equal(second.plan.options.length, 0);
});

test('model errors distinguish billing, authentication, rate limits and model access without exposing upstream messages', async () => {
  const cases = [
    { status: 429, code: 'credit_balance_exhausted', type: 'insufficient_quota', expected: /credits are exhausted/ },
    { status: 429, code: 'project_spend_limit_exceeded', type: 'insufficient_quota', expected: /spending or usage limit/ },
    { status: 429, code: 'insufficient_quota', type: 'insufficient_quota', expected: /quota is unavailable/ },
    { status: 429, code: 'rate_limit_exceeded', type: 'rate_limit_error', expected: /rate-limiting/ },
    { status: 401, code: 'invalid_api_key', type: 'authentication_error', expected: /rejected the API key/ },
    { status: 404, code: 'model_not_found', type: 'invalid_request_error', expected: /cannot access the configured model/ },
    { status: 400, code: 'invalid_json_schema', type: 'invalid_request_error', expected: /request configuration/ },
    { status: 503, code: 'server_error', type: 'server_error', expected: /temporarily unavailable/ },
  ];
  for (const entry of cases) {
    let calls = 0;
    const extractor = new FoodIntentExtractor({ mode: 'model', apiKey: 'test-key', fetch: async () => {
      calls++;
      return new Response(JSON.stringify({ error: { code: entry.code, type: entry.type, message: 'PRIVATE_PROVIDER_DETAIL' } }), { status: entry.status });
    } });
    const result = await new FoodAgent(extractor).run(input('Vegan dinner'));
    assert.match(result.reply, entry.expected);
    assert.equal(result.plan.agent.mode, 'unavailable');
    assert.equal(result.plan.options.length, 0);
    assert.equal(calls, 1);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_PROVIDER_DETAIL'));
    assert.ok(chatResponseSchema.safeParse({ conversationId: '00000000-0000-4000-8000-000000000000', reply: result.reply, plan: result.plan }).success);
  }
});

test('model timeouts return an explicit bounded-wait message', async () => {
  const extractor = new FoodIntentExtractor({ mode: 'model', apiKey: 'test-key', fetch: async (_url, init) => {
    assert.ok(init?.signal);
    throw new DOMException('Request timed out', 'TimeoutError');
  } });
  const result = await new FoodAgent(extractor).run(input('Dinner'));
  assert.match(result.reply, /12-second time limit/);
  assert.equal(result.plan.options.length, 0);
});

test('Gemini uses the selected model and header authentication with structured intent output', async () => {
  const intent = extractLocal(input('Vegan Mexican BOGO for two under $20')).intent;
  const extractor = new FoodIntentExtractor({ provider: 'gemini', mode: 'model', apiKey: 'gemini-test-key', model: 'gemini-3.5-flash-lite', fetch: async (url, init) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
    assert.ok(!String(url).includes('gemini-test-key'));
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), 'gemini-test-key');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.responseJsonSchema.type, 'object');
    assert.ok(body.systemInstruction.parts[0].text);
    assert.equal(JSON.parse(body.contents[0].parts[0].text).message, 'Vegan Mexican BOGO for two under $20');
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [
      { thought: true, text: 'Ignore this internal thought part' },
      { text: JSON.stringify({ intent, clarification: null }) },
    ] } }] }));
  } });
  const result = await new FoodAgent(extractor).run(input('Vegan Mexican BOGO for two under $20'));
  assert.equal(result.plan.agent.mode, 'model');
  assert.equal(result.plan.options[0].total, 12.49);
});

test('Gemini reports configuration and quota errors without leaking upstream details', async () => {
  const cases = [
    { status: 400, details: [{ reason: 'API_KEY_INVALID' }], expected: /rejected the API key/ },
    { status: 400, details: [], expected: /request configuration/ },
    { status: 401, details: [], expected: /rejected the API key/ },
    { status: 403, details: [], expected: /denied access/ },
    { status: 404, details: [], expected: /model is unavailable/ },
    { status: 429, details: [], expected: /quota or rate limit/ },
    { status: 503, details: [], expected: /temporarily unavailable/ },
  ];
  for (const entry of cases) {
    const extractor = new FoodIntentExtractor({ provider: 'gemini', mode: 'model', apiKey: 'test-key', fetch: async () =>
      new Response(JSON.stringify({ error: { details: entry.details, message: 'PRIVATE_GEMINI_DETAIL' } }), { status: entry.status }) });
    const result = await new FoodAgent(extractor).run(input('Dinner'));
    assert.match(result.reply, entry.expected);
    assert.equal(result.plan.agent.mode, 'unavailable');
    assert.equal(result.plan.options.length, 0);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_GEMINI_DETAIL'));
  }
});

test('Gemini blocked, truncated and malformed responses never produce recommendations', async () => {
  for (const body of [
    { promptFeedback: { blockReason: 'SAFETY' } },
    { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{broken' }] } }] },
  ]) {
    const extractor = new FoodIntentExtractor({ provider: 'gemini', mode: 'model', apiKey: 'test-key', fetch: async () => new Response(JSON.stringify(body)) });
    const result = await new FoodAgent(extractor).run(input('Dinner'));
    assert.equal(result.plan.options.length, 0);
    assert.equal(result.plan.agent.mode, 'unavailable');
  }
});
