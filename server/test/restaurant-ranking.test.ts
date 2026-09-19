import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {quoteSchema} from '../../shared/quotes.js';
import {buildPlan} from '../agent/localAgent.js';
const rows=quoteSchema.array().parse(JSON.parse(readFileSync(new URL('../data/ubereats-menu-mountain-view.json',import.meta.url),'utf8')));
test('one relevant result per restaurant, ordered by total',()=>{
 const plan=buildPlan({prompt:'rice',budget:30,dietary:'No preference',mode:'simulation'},rows);
 assert.equal(plan.options.length,3);
 assert.equal(new Set(plan.options.map(o=>o.restaurant)).size,3);
 assert.ok(plan.options.every(o=>o.item.toLowerCase().includes('rice')));
 assert.deepEqual(plan.options.map(o=>o.price), [...plan.options.map(o=>o.price)].sort((a,b)=>a-b));
});
test('relevance beats unrelated cheaper item within restaurant',()=>{
 const plan=buildPlan({prompt:'Panda Bowl',budget:30,dietary:'No preference',mode:'simulation'},rows);
 assert.equal(plan.options.length,1);
 assert.ok(plan.options[0].item.includes('× Bowl'));
 assert.equal(plan.options[0].price,18.56);
});
