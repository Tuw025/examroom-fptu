import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateBank,grade,addBundledBank,syncBundledBank} from '../web/core.mjs';

const original=JSON.parse(fs.readFileSync(new URL('../data/retake-original.json',import.meta.url),'utf8'));
const bank=validateBank(JSON.parse(fs.readFileSync(new URL('../web/retake.json',import.meta.url),'utf8')));
const userKey='1E 2A 3C 4B 5A 6D 7C 8D 9C 10C 11C 12D 13C 14C 15A 16A 17A 18B 19A 20A 21A 22B 23B 24A 25B 26C 27C 28A 29A 30C';

test('RETAKE keeps all 30 original prompts/options and exactly the user answer key',()=>{
  assert.equal(bank.questions.length,30);
  const key=Object.fromEntries(userKey.split(' ').map(token=>[token.slice(0,-1),token.at(-1)]));
  for(const q of bank.questions){const source=original.questions.find(s=>s.id===q.id);assert.equal(q.text,source.text);assert.deepEqual(q.options,source.options);assert.equal(q.answer,key[q.id]);assert.ok(q.image.includes(source.photoId+'_'));assert.ok(q.explanation);}
  assert.deepEqual(bank.questions.map(q=>q.id),Array.from({length:30},(_,i)=>String(i+1)));
  assert.equal(grade(bank.questions,key).score,10);
});
test('known out-of-order photos are mapped by the printed question number',()=>{
  for(const [id,photo] of [['8','768592506'],['9','763263140'],['13','765769971'],['14','767388522']])assert.ok(bank.questions.find(q=>q.id===id).image.includes(photo+'_'));
  assert.match(bank.questions[12].text,/50%.*structural load report/s);
  assert.match(bank.questions[20].text,/two weeks.*documenting our processes/s);
});
test('RETAKE installs once without altering FE, imported banks or active progress',()=>{
  const existing=[{id:'demo-fe',title:'FE'},{id:'custom',title:'My questions'}];
  const result=addBundledBank(existing,bank,'builtin-retake',false,123);
  assert.equal(result.added,true);assert.equal(result.banks.length,3);
  assert.equal(result.banks[0],existing[0]);assert.equal(result.banks[1],existing[1]);
  assert.equal(result.banks[2].createdAt,123);assert.equal(existing.length,2);
  assert.equal(addBundledBank(result.banks,bank,'builtin-retake',false).added,false);
  assert.equal(addBundledBank(existing,bank,'builtin-retake',true).added,false);
  assert.equal(addBundledBank([{id:'imported',sourceId:bank.sourceId}],bank,'builtin-retake',false).added,false);
  const active={bank:{id:'demo-fe'},answers:{1:'A'},deadline:999};
  const synced=syncBundledBank(result.banks,active,[],bank,'builtin-retake');
  assert.equal(synced.active,active);assert.equal(synced.changed,false);
});
test('local retake image route is accepted but remote and traversal image paths are rejected',()=>{
  const raw=structuredClone(bank);raw.questions=raw.questions.slice(0,1);
  for(const image of ['/assets/retake/../server.mjs','/assets/retake/%2e%2e/server.mjs','https://example.com/test.jpg']){raw.questions[0].image=image;assert.throws(()=>validateBank(raw));}
});
