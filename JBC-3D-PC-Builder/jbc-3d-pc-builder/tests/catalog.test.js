import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCatalog,reconcileSelection,buildSnapshot } from '../src/catalog.js';
const items=[{id:'cpu-a',category:'cpu',name:'CPU A',stock:2,price:120},{id:'gpu-a',category:'gpu',name:'GPU A',stock:0,price:300}];
test('Rejects malformed catalog and duplicates',()=>{
 for(const bad of [[...items,items[0]],[{...items[0],stock:-1}],[{...items[0],price:NaN}],[{...items[0],category:'invalid'}]]) assert.throws(()=>normalizeCatalog(bad));
});
test('Unavailable, missing and wrong-category selections are dropped',()=>{
 assert.deepEqual(reconcileSelection(items,{cpu:'cpu-a',gpu:'gpu-a',ram:'cpu-a',case:'missing'}),{cpu:'cpu-a'});
 assert.deepEqual(reconcileSelection([{...items[0],stock:0}],{cpu:'cpu-a'}),{});
});
test('Subtotal derives from fresh catalog and snapshots do not mutate state',()=>{
 const selection={cpu:'cpu-a'},snapshot=buildSnapshot(items,selection);
 assert.equal(snapshot.total,120);assert.equal(snapshot.complete,false);snapshot.parts[0].price=999;snapshot.selection.cpu='bad';
 assert.equal(items[0].price,120);assert.equal(selection.cpu,'cpu-a');
 assert.equal(buildSnapshot([{...items[0],price:150}],selection).total,150);
});
