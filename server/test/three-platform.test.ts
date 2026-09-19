import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {quoteSchema} from '../../shared/quotes.js';
import {buildPlan} from '../agent/localAgent.js';
const rows=quoteSchema.array().parse(JSON.parse(readFileSync(new URL('../data/three-platform-demo.json',import.meta.url),'utf8')));
test('15 unique restaurants, three comparable prices each, sorted by winning total',()=>{
 assert.equal(rows.length,45);
 const result=buildPlan({prompt:'All restaurants',budget:35,dietary:'No preference',mode:'simulation'},rows);
 assert.equal(result.options.length,15);
 assert.equal(new Set(result.options.map(o=>o.restaurant)).size,15);
 for(const o of result.options){assert.equal(o.comparisons?.length,3);assert.equal(Math.round(o.price*100),Math.min(...o.comparisons!.map(c=>c.total)));for(const c of o.comparisons!){assert.equal(c.total,c.subtotal+c.delivery+c.service+c.tax+c.tip-c.discount);}}
 assert.deepEqual(result.options.map(o=>o.price),result.options.map(o=>o.price).sort((a,b)=>a-b));
 assert.equal(buildPlan({prompt:'Panda',budget:35,dietary:'No preference',mode:'simulation'},rows).options.length,1);
 assert.equal(buildPlan({prompt:'All restaurants',budget:1,dietary:'No preference',mode:'simulation'},rows).options.length,0);
});
