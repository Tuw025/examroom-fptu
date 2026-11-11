import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBank,parseAnswers,grade,shuffled,syncBundledBank} from '../web/core.mjs';
import {readFileSync} from 'node:fs';

const bank=()=>({title:'A',durationMinutes:30,questions:[{id:'1',text:'Test',options:{A:'One',B:'Two'},answer:'A'}]});
test('validates and normalizes banks without mutating input',()=>{const raw=bank();raw.questions[0].answer=' a ';const result=validateBank(raw);assert.equal(result.questions[0].answer,'A');assert.equal(raw.questions[0].answer,' a ');});
test('rejects missing answers, duplicate IDs, invalid timing and remote image URLs',()=>{for(const modify of [b=>b.questions[0].answer='C',b=>b.questions.push({...b.questions[0]}),b=>b.durationMinutes=0,b=>b.questions[0].image='https://example.com/tracker.png']){const b=bank();modify(b);assert.throws(()=>validateBank(b));}});
test('accepts array options and image-only questions',()=>{const b=bank();b.questions[0]={text:'',image:'data:image/png;base64,aGVsbG8=',options:['One','Two'],answer:'B'};assert.equal(validateBank(b).questions[0].options.B,'Two');});
test('parses numbered TXT and JSON explanations',()=>{assert.equal(parseAnswers('1. A\n2: c',2).get(2).answer,'C');assert.equal(parseAnswers('{"answers":{"1":{"answer":"B","explanation":"Because"}}}',1).get(1).explanation,'Because');});
test('rejects incomplete, duplicated or out of range answer sheets',()=>{assert.throws(()=>parseAnswers('1. A',2));assert.throws(()=>parseAnswers('1. A\n1. B',2));assert.throws(()=>parseAnswers('1. A\n3. B',2));assert.throws(()=>parseAnswers('{"1":"Z"}',1));});
test('scores correct, wrong and unanswered independently on 10-point scale',()=>{const questions=[{id:'a',answer:'A'},{id:'b',answer:'C'},{id:'c',answer:'D'}];const g=grade(questions,{a:'A',b:'B'});assert.deepEqual([g.correct,g.total,g.blank,g.score],[1,3,1,3.33]);assert.equal(g.rows[2].selected,null);});
test('shuffling preserves question identity and does not mutate original',()=>{const original=['1','2','3','4'];const mixed=shuffled(original,()=>0);assert.deepEqual(original,['1','2','3','4']);assert.deepEqual([...mixed].sort(),original);assert.notDeepEqual(mixed,original);});

const canonical=JSON.parse(readFileSync(new URL('../data/fe-original.json',import.meta.url),'utf8'));
const demo=JSON.parse(readFileSync(new URL('../web/demo.json',import.meta.url),'utf8'));
test('all 30 generated question texts and every option match the original transcription exactly',()=>{
  assert.equal(demo.questions.length,30);
  assert.deepEqual(demo.questions.map(q=>q.id),Array.from({length:30},(_,i)=>String(i+1)));
  for(const original of canonical.questions){const q=demo.questions.find(q=>q.id===original.id);assert.equal(q.text,original.text,'Prompt '+q.id);assert.deepEqual(q.options,original.options,'Options '+q.id);assert.ok(q.image.includes(original.photoId+'_'));}
  assert.equal(demo.questions.map(q=>q.answer).join(''),'DACEACBCEACCBBBCCCADACDBDBCBDB');
});
test('full cases, figures and original grammar survive validation',()=>{
  const validated=validateBank(demo);
  assert.equal(validated.contentRevision,2);
  assert.equal(validated.sourceId,canonical.sourceId);
  assert.match(validated.questions[9].text,/whole university/);
  assert.match(validated.questions[10].options.A,/3 minutes and 10 seconds/);
  assert.match(validated.questions[11].text,/30%.*4 days.*3 assigned slides/s);
  assert.match(validated.questions[21].text,/^You needs to write a proposal/);
  assert.match(validated.questions[24].text,/40 pounds.*Wednesday night/);
  assert.match(validated.questions[14].options.A,/that attract/);
});
test('bank validation preserves exact user supplied text and paragraphs',()=>{
  const b=bank();b.questions[0].text='  Original wording?\n\n"Full scenario."  ';
  assert.equal(validateBank(b).questions[0].text,b.questions[0].text);
});
test('FE migration updates library and snapshots while retaining all learner progress',()=>{
  const old={...bank(),id:'demo-fe',createdAt:100};
  const imported={...bank(),id:'user-owned',sourceId:canonical.sourceId};
  const active={bank:old,ids:['1'],answers:{1:'B'},flags:['1'],index:0,startedAt:10,deadline:5000,settings:{mode:'exam'}};
  const attempt={...structuredClone(active),grade:{score:0},finishedAt:900};
  const before=structuredClone({old,active,attempt});
  const next=syncBundledBank([old,imported],active,[attempt],validateBank(demo));
  assert.equal(next.changed,true);assert.equal(next.banks[0].contentRevision,2);
  assert.equal(next.banks[0].createdAt,100);assert.equal(next.banks[1],imported);
  for(const k of ['ids','answers','flags','index','startedAt','deadline','settings'])assert.deepEqual(next.active[k],active[k]);
  assert.deepEqual(next.attempts[0].grade,attempt.grade);assert.equal(next.attempts[0].finishedAt,900);
  assert.equal(next.active.sourceContentUpdated,true);assert.equal(next.active.bank.questions[0].text,canonical.questions[0].text);
  assert.deepEqual({old,active,attempt},before);
});
test('migration is idempotent, never downgrades revisions and does not resurrect deleted banks',()=>{
  const fresh=validateBank(demo),bank={...fresh,id:'demo-fe'};
  assert.equal(syncBundledBank([bank],null,[],fresh).changed,false);
  assert.equal(syncBundledBank([{...bank,contentRevision:3}],null,[],fresh).changed,false);
  const legacyAttempt={bank:{id:'demo-fe'},grade:{score:6}};
  const next=syncBundledBank([],null,[legacyAttempt],fresh);
  assert.deepEqual(next.banks,[]);assert.equal(next.active,null);assert.equal(next.attempts[0].grade.score,6);
});
