import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import { quoteSchema } from '../../shared/quotes.js';
import { buildPlan } from '../agent/localAgent.js';
const expected = quoteSchema.array().parse(JSON.parse(readFileSync(new URL('../data/ubereats-menu-mountain-view.json', import.meta.url), 'utf8')));
const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {serverSelectionTimeoutMS:3000});
try {
 await client.connect();
 const c = client.db(process.env.MONGODB_DATABASE || 'mealwise').collection('quotes');
 const docs = await c.find({comparison_key: {$in: expected.map(q => q.comparison_key)}, data_type:'menu_only'}).toArray();
 assert.equal(docs.length, 40);
 const rows = quoteSchema.array().parse(docs);
 for (const e of expected) {
  const q = rows.find(r => r.comparison_key === e.comparison_key)!;
  assert.ok(q);
  assert.deepEqual(q.platform_items, e.platform_items);
  assert.equal(q.displayed_total_cents, null);
  assert.equal(q.price_complete, false);
  assert.equal(q.captured_at, null);
  assert.ok(q.provenance?.retrieved_at);
  assert.equal(q.platform_store_url, e.platform_store_url);
 }
 assert.equal(buildPlan({prompt:'rice',budget:500,dietary:'No preference'},rows).options.length,0);
 console.log(JSON.stringify({status:'PASS', importedMenuRecords:rows.length,restaurants:new Set(rows.map(q=>q.restaurant.restaurant_id)).size,excludedFromCheckoutRecommendations:true,counts:await c.aggregate([{$group:{_id:'$data_type',count:{$sum:1}}}]).toArray()},null,2));
} finally { await client.close(); }
