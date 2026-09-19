import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { quoteSchema } from '../../shared/quotes.js';
import { buildPlan } from '../agent/localAgent.js';
const rows=quoteSchema.array().parse(JSON.parse(readFileSync(new URL('../data/ubereats-menu-mountain-view.json',import.meta.url),'utf8')));
test('menu mode returns sourced base prices without inventing totals',()=>{
 const result=buildPlan({prompt:'Panda',budget:12,dietary:'No preference',mode:'menu'},rows);
 assert.ok(result.options.length>0);
 assert.ok(result.options.every(o=>o.restaurant==='Panda Express' && o.price<=12 && o.quote?.dataType==='menu_only' && o.quote.delivery===null && o.sourceUrl));
 assert.equal(buildPlan({prompt:'Panda',budget:100,dietary:'No preference'},rows).options.length,0);
 assert.equal(buildPlan({prompt:'nonexistentxyz',budget:100,dietary:'No preference',mode:'menu'},rows).options.length,0);
});
