import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseOfferProvider, quoteToOffer } from '../providers/database.js';
import { FoodAgent } from '../agent/foodAgent.js';
import { FoodIntentExtractor } from '../agent/model.js';
import { MockOfferProvider } from '../providers/mock.js';
import { searchOffers } from '../agent/search.js';
import { baseIntent } from '../agent/intent.js';

const [quote] = JSON.parse(readFileSync(new URL('../data/quotes.json', import.meta.url), 'utf8'));
const request = { message: 'rice', budget: 25, dietary: 'No preference' as const };

test('database provider reads afresh and preserves stored totals without adding fees twice', async () => {
  let reads = 0;
  const provider = new DatabaseOfferProvider(async () => [{ ...quote, displayed_total_cents: ++reads === 1 ? 999 : 1099 }]);
  const agent = new FoodAgent(new FoodIntentExtractor({ mode: 'local' }), [provider]);
  assert.equal((await agent.run(request)).plan.options[0].total, 9.99);
  const second = await agent.run(request);
  assert.equal(second.plan.options[0].total, 10.99);
  assert.equal(second.plan.options[0].verified, false);
  assert.equal(second.plan.dataSource, 'database-data');
  assert.equal(reads, 2);
});

test('empty or failed database never falls back to local fixtures', async () => {
  const intent = baseIntent(request);
  for (const read of [async () => [], async () => { throw new Error('PRIVATE_DB_ERROR'); }]) {
    const result = await searchOffers(intent, [new MockOfferProvider(), new DatabaseOfferProvider(read)]);
    assert.equal(result.plan.options.length, 0);
    assert.equal(result.plan.dataSource, 'database-data');
    assert.ok(!JSON.stringify(result).includes('PRIVATE_DB_ERROR'));
  }
});

test('database quotes do not invent allergy metadata or group pricing', async () => {
  const provider = new DatabaseOfferProvider(async () => [quote]);
  const intent = baseIntent(request);
  for (const patch of [{ allergens: ['milk'] }, { excludedIngredients: ['onion'] }, { servings: 2 }]) {
    assert.equal((await searchOffers({ ...intent, ...patch }, [provider])).plan.options.length, 0);
  }
});

test('database rejects invalid, unavailable, unconfirmed and stale records', async () => {
  assert.equal(quoteToOffer({ ...quote, displayed_total_cents: -1 }), null);
  assert.equal(quoteToOffer({ ...quote, availability: 'unavailable' }), null);
  assert.equal(quoteToOffer({ ...quote, offers: [{ description: 'Deal', applied: true, eligibility_status: 'unconfirmed' }] }), null);
  const stale = { ...quote, data_type: 'checkout_snapshot', captured_at: '2020-01-01T00:00:00.000Z', evidence_paths: ['test-evidence'] };
  assert.equal((await searchOffers(baseIntent(request), [new DatabaseOfferProvider(async () => [stale])])).plan.options.length, 0);
});
