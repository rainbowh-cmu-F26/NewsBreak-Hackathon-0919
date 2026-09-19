import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {quoteSchema} from '../../shared/quotes.js';
import {planResponseSchema} from '../../shared/schemas.js';
import {buildPlan} from '../agent/localAgent.js';
const read=(file:string)=>quoteSchema.array().parse(JSON.parse(readFileSync(new URL(`../data/${file}`,import.meta.url),'utf8')));
const rows=read('bogo-demo-quotes.json');
test('BOGO bundles preserve source fields and apply discounted price and tax once',()=>{
 assert.equal(rows.length,11);
 for(const [name,platform,total,servings] of [['Masa Verde','grubhub',1449,2],['Piazza Kitchen','grubhub',2194,4],['Little Hunan','ubereats',1613,2]] as const){
  const q=rows.find(q=>q.restaurant.name===name&&q.platform===platform)!;
  assert.equal(q.displayed_total_cents,total);assert.equal(q.additional_discount_cents,0);
  assert.equal(q.platform_items[0].quantity,1);assert.equal(q.source_offer?.servings,servings);
 }
 assert.deepEqual(rows.find(q=>q.restaurant.name==='Little Hunan')!.source_offer?.mayContain,['peanut']);
 for(const q of rows) assert.equal(q.displayed_total_cents,q.subtotal_cents!+q.delivery_fee_cents!+q.service_fee_cents!+q.tax_cents!+q.tip_cents!);
});
test('all 18 restaurants remain visible with unique IDs and BOGO metadata',()=>{
 const result=planResponseSchema.parse(buildPlan({prompt:'All restaurants',budget:35,dietary:'No preference',mode:'simulation'},[...read('three-platform-demo.json'),...rows]));
 assert.equal(result.options.length,18);assert.equal(new Set(result.options.map(q=>q.restaurant_id)).size,18);
 assert.equal(result.options.find(q=>q.restaurant==='Masa Verde')?.comparisons?.length,4);
 assert.equal(result.options.find(q=>q.restaurant==='Piazza Kitchen')?.comparisons?.length,4);
 assert.equal(result.options.find(q=>q.restaurant==='Little Hunan')?.comparisons?.length,3);
 const vegan=buildPlan({prompt:'All restaurants',budget:35,dietary:'Vegan',mode:'simulation'},rows);
 assert.deepEqual(vegan.options.map(q=>q.restaurant),['Masa Verde']);
});
