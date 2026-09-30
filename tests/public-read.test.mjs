import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedPublic } from '../src/lib/public-cache.server.ts';
import { validateFeedInput } from '../src/lib/feed-input.ts';

test('slow concurrent reads remain single flight past TTL and cache from completion', async () => {
 const real=Date.now;let now=1000;Date.now=()=>now;
 try{let calls=0;let resolve;const loader=()=>{calls++;return new Promise(r=>resolve=r);};
 const first=cachedPublic('slow',10,loader);await Promise.resolve();now+=100;
 const joined=cachedPublic('slow',10,loader);assert.equal(first,joined);assert.equal(calls,1);
 resolve('ok');await first;assert.equal(await cachedPublic('slow',10,loader),'ok');assert.equal(calls,1);
 now+=11;const next=cachedPublic('slow',10,loader);await Promise.resolve();assert.equal(calls,2);resolve('fresh');assert.equal(await next,'fresh');
 }finally{Date.now=real;}
});
test('failed reads are retried instead of caching failure',async()=>{await assert.rejects(cachedPublic('failure',100,()=>Promise.reject(Error('no'))));assert.equal(await cachedPublic('failure',100,async()=>42),42);});
test('active entries survive capacity pressure',async()=>{let resolve;let calls=0;const pending=cachedPublic('pinned',100,()=>{calls++;return new Promise(r=>resolve=r);});await Promise.resolve();for(let i=0;i<220;i++)await cachedPublic('pressure'+i,100,async()=>i);assert.equal(cachedPublic('pinned',100,async()=>0),pending);assert.equal(calls,1);resolve(1);await pending;});
test('oversized keys and invalid TTL bypass retention',async()=>{let n=0;const key='x'.repeat(2049);await cachedPublic(key,100,async()=>++n);await cachedPublic(key,100,async()=>++n);assert.equal(n,2);await cachedPublic('no-ttl',NaN,async()=>++n);await cachedPublic('no-ttl',NaN,async()=>++n);assert.equal(n,4);});
test('feed validation normalizes strings and preserves legitimate filters',()=>{assert.deepEqual(validateFeedInput({q:'  stars ',category:'science',sort:'oldest',perPage:48,cursor:'123-abc'}),{q:'stars',category:'science',sort:'oldest',perPage:48,cursor:'123-abc'});assert.deepEqual(validateFeedInput({}),{});});
test('reject malformed/unbounded queries before cache or database work',()=>{for(const input of [null,[],{q:'x'.repeat(201)},{q:{}},{perPage:NaN},{perPage:2.5},{perPage:49},{category:'x'.repeat(161)},{cursor:'a,b)'},{sort:'random'},{sql:'select 1'}])assert.throws(()=>validateFeedInput(input));});
