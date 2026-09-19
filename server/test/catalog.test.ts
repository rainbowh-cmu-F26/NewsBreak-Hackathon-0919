import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { createApp } from '../app.js';
import { planResponseSchema } from '../../shared/schemas.js';

const [base] = JSON.parse(readFileSync(new URL('../data/quotes.json', import.meta.url), 'utf8'));
const store = (listQuotes: () => Promise<unknown[]>) => ({ listQuotes, getConversationContext: async () => null, saveConversationTurn: async () => {}, close: async () => {} });

test('homepage catalog returns every restaurant without budget or shortlist limits', async () => {
  const rows = Array.from({ length: 8 }, (_, index) => ({ ...base, restaurant: {...base.restaurant, restaurant_id: `restaurant-${index}`, name: `Restaurant ${index}`}, comparison_key: `catalog-${index}`, displayed_total_cents: 6000 + index }));
  const response = await request(createApp(store(async () => rows))).get('/api/catalog');
  assert.equal(response.status, 200);
  const plan = planResponseSchema.parse(response.body);
  assert.equal(plan.dataSource, 'database-data');
  assert.equal(plan.options.length, 8);
  assert.ok(plan.options.every((option) => option.price >= 60));
  assert.equal(new Set(plan.options.map((option) => option.id)).size, 8);
});

test('homepage catalog preserves menu-only prices without inventing fees or totals', async () => {
  const rows = JSON.parse(readFileSync(new URL('../data/ubereats-menu-mountain-view.json', import.meta.url), 'utf8'));
  const response = await request(createApp(store(async () => rows))).get('/api/catalog');
  assert.equal(response.status, 200);
  const plan = planResponseSchema.parse(response.body);
  assert.equal(plan.options.length, new Set(rows.map((row: typeof base) => row.restaurant.restaurant_id)).size);
  assert.ok(plan.options.every((option) => option.quote?.dataType === 'menu_only' && option.quote.total === null && option.total === undefined));
});

test('restaurant cards select the best complete price and compare only matching meals', async () => {
  const rows = [
    { ...base, platform: 'ubereats', displayed_total_cents: 1800 },
    { ...base, platform: 'doordash', displayed_total_cents: 1600 },
    { ...base, platform: 'grubhub', displayed_total_cents: 1900 },
    { ...base, comparison_key: 'different-meal', displayed_total_cents: 2000 },
    { ...base, data_type: 'menu_only', price_complete: false, displayed_total_cents: null, subtotal_cents: 100 },
    { ...base, availability: 'unavailable', displayed_total_cents: 50 },
  ];
  const response = await request(createApp(store(async () => rows))).get('/api/catalog');
  const plan = planResponseSchema.parse(response.body);
  assert.equal(plan.options.length, 1);
  assert.equal(plan.options[0].total, 16);
  assert.equal(plan.options[0].quote?.platform, 'doordash');
  assert.deepEqual(plan.options[0].comparisons?.map((quote) => quote.total), [1600, 1800, 1900]);
});

test('homepage catalog reports empty and failed databases without local fallback', async () => {
  const empty = await request(createApp(store(async () => []))).get('/api/catalog');
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.options, []);
  const failed = await request(createApp(store(async () => { throw new Error('PRIVATE_DATABASE_DETAILS'); }))).get('/api/catalog');
  assert.equal(failed.status, 503);
  assert.ok(!JSON.stringify(failed.body).includes('PRIVATE_DATABASE_DETAILS'));
});
