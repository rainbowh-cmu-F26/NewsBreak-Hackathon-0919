import assert from 'node:assert/strict';
import test from 'node:test';
import { baseIntent, extractLocal } from '../agent/intent.js';
import { planOffers } from '../agent/search.js';
import { FoodAgent } from '../agent/foodAgent.js';
import { FoodIntentExtractor } from '../agent/model.js';
import { CatalogTools } from '../agent/catalogTools.js';
import { CatalogConversation } from '../agent/conversation.js';
import { mockRows } from '../providers/mock.js';
import { conversationContextSchema } from '../../shared/intent.js';

const input = (message: string) => ({ message, budget: 25, dietary: 'No preference' as const });
const toolsFor = (message: string) => {
  const intent = extractLocal(input(message)).intent;
  const rows = mockRows();
  return { intent, tools: new CatalogTools(intent, rows, true, planOffers(intent, rows)) };
};
const response = (value: unknown) => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] }));
const action = (name: string, reply: string | null = null, offerId: string | null = null, ids: string[] = []) => ({ action: name, reply, offerId, referencedOfferIds: ids });

test('Asian searches expand to specific cuisines, including exclusions and subregions', () => {
  const { tools } = toolsFor('Asian food');
  assert.ok(tools.plan.options.length);
  assert.ok(tools.plan.options.every((option) => ['chinese', 'thai', 'vietnamese', 'japanese', 'indian', 'korean'].includes(option.cuisine!)));
  const southeast = toolsFor('Southeast Asian food');
  assert.ok(southeast.tools.plan.options.every((option) => ['thai', 'vietnamese'].includes(option.cuisine!)));
  const excluded = toolsFor('Dinner, no Asian food');
  assert.ok(excluded.tools.plan.options.every((option) => !['chinese', 'thai', 'vietnamese', 'japanese', 'indian', 'korean'].includes(option.cuisine!)));
  const modelIntent = { ...baseIntent(input('Asian')), cuisines: ['asian'] };
  assert.ok(planOffers(modelIntent, mockRows()).options.length);
});

test('optional dietary preferences rank chicken choices without removing other choices', () => {
  const { intent, tools } = toolsFor('Chicken, preferably dairy-free');
  assert.deepEqual(intent.dietary, []);
  assert.deepEqual(intent.preferredDietary, ['dairy-free']);
  assert.equal(tools.plan.options.length, 2);
  assert.equal(tools.plan.options[0].id, 'uber-eats:p12');
  const strict = planOffers({ ...intent, dietary: ['dairy-free'] }, mockRows());
  assert.equal(strict.options.length, 1);
});

test('diagnostics find a deal conflict but do not relax budget or restrictions', () => {
  const { intent, tools } = toolsFor('Chicken BOGO under $20');
  const saved = structuredClone(intent);
  const diagnostics = tools.explainNoMatches();
  assert.ok(diagnostics.suggestions.some((entry) => entry.change === 'Remove the required deal preference'));
  assert.deepEqual(intent, saved);
  assert.equal(tools.searchOffers().options.length, 0);
  const restricted = toolsFor('Vegan chicken BOGO under $20');
  assert.ok(!restricted.tools.explainNoMatches().suggestions.some((entry) => /diet|allerg/i.test(entry.change)));
});

test('details tool cannot expose a disqualified or invented offer', () => {
  const { tools } = toolsFor('Chicken');
  assert.ok('error' in tools.getOfferDetails('doordash:p2'));
  assert.ok('error' in tools.getOfferDetails('invented'));
  const details = tools.getOfferDetails('grubhub:p13');
  assert.ok('allergens' in details && details.allergens.includes('milk'));
});

test('Gemini conversation requests details and writes a grounded reply', async () => {
  const { intent, tools } = toolsFor('Chicken');
  let calls = 0;
  const model = new CatalogConversation({ provider: 'gemini', apiKey: 'test', fetch: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const payload = JSON.parse(body.contents[0].parts[0].text);
    assert.ok(init?.signal);
    if (calls++ === 0) return response(action('getOfferDetails', null, 'grubhub:p13'));
    assert.ok(payload.transcript[1].result.allergens.includes('milk'));
    return response(action('respond', 'The chicken curry contains milk and costs $15.67 including estimated tax and fees.', null, ['grubhub:p13']));
  } });
  assert.match(await model.reply('Does the curry contain dairy?', intent, null, tools), /contains milk/);
  assert.equal(calls, 2);
});

test('empty search tool loop explains a conflict and asks before changing it', async () => {
  const { intent, tools } = toolsFor('Chicken BOGO');
  let calls = 0;
  const model = new CatalogConversation({ provider: 'gemini', apiKey: 'test', fetch: async (_url, init) => {
    if (calls++ === 0) return response(action('explainNoMatches'));
    const payload = JSON.parse(JSON.parse(String(init?.body)).contents[0].parts[0].text);
    assert.ok(payload.transcript[1].result.suggestions.some((entry: { change: string }) => entry.change.includes('deal')));
    return response(action('respond', 'No chicken BOGO matches. Would you like to see the regular discounts?'));
  } });
  assert.match(await model.reply('Chicken BOGO', intent, null, tools), /Would you/);
  assert.deepEqual(intent.deals, ['bogo']);
  assert.equal(tools.plan.options.length, 0);
});

test('conversation rejects invented prices and IDs and bounds repeated tool calls', async () => {
  const { intent, tools } = toolsFor('Chicken');
  for (const invalid of [action('respond', 'Try this for $0.01.', null, ['uber-eats:p12']), action('respond', 'Try this dish.', null, ['invented'])]) {
    const model = new CatalogConversation({ provider: 'gemini', apiKey: 'test', fetch: async () => response(invalid) });
    await assert.rejects(model.reply('Chicken', intent, null, tools), /Ungrounded/);
  }
  let calls = 0;
  const looping = new CatalogConversation({ provider: 'gemini', apiKey: 'test', fetch: async () => { calls++; return response(action('searchOffers')); } });
  await assert.rejects(looping.reply('Chicken', intent, null, tools), /limit/);
  assert.equal(calls, 4);
});

test('conversation failure preserves validated results and bounded conversation history', async () => {
  const extractor = { extract: async () => ({ ...extractLocal(input('Chicken')), mode: 'model' as const, warnings: [] }) };
  const agent = new FoodAgent(extractor, undefined, { reply: async () => { throw new Error('PRIVATE_UPSTREAM_ERROR'); } });
  let context;
  for (let turn = 0; turn < 6; turn++) {
    const result = await agent.run(input('Chicken'), context);
    assert.equal(result.plan.options.length, 2);
    assert.ok(!result.reply.includes('PRIVATE_UPSTREAM_ERROR'));
    assert.ok(result.plan.agent.warnings.some((warning) => warning.includes('Conversational explanation')));
    context = result.context;
  }
  assert.equal(context!.recentTurns.length, 8);
  assert.ok(conversationContextSchema.safeParse(context).success);
});

test('extraction receives prior replies for yes/no follow-ups and catalog vocabulary', async () => {
  const first = await new FoodAgent(new FoodIntentExtractor({ mode: 'local' })).run(input('Chicken BOGO'));
  first.context.recentTurns.push({ role: 'assistant', content: 'Would you like to remove the BOGO requirement?' });
  const intent = { ...first.context.intent, deals: [] };
  const extractor = new FoodIntentExtractor({ provider: 'gemini', mode: 'model', apiKey: 'test', fetch: async (_url, init) => {
    const payload = JSON.parse(JSON.parse(String(init?.body)).contents[0].parts[0].text);
    assert.match(payload.recentTurns.at(-1).content, /BOGO requirement/);
    assert.ok(payload.vocabulary.cuisineGroups.asian.includes('thai'));
    return response({ intent, clarification: null });
  } });
  const result = await new FoodAgent(extractor).run(input('Yes please'), first.context);
  assert.deepEqual(result.plan.agent.intent.deals, []);
  assert.deepEqual(result.plan.agent.intent.foods, ['chicken']);
  assert.equal(result.plan.options.length, 2);
});
