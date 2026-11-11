import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateBank,parseAnswers} from './web/core.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const original=JSON.parse(await fs.readFile(path.join(root,'data','retake-original.json'),'utf8'));
const key=parseAnswers(original.answerKey.replace(/(\d+)([A-F])/g,'$1. $2\n'),30);
const images=await fs.readdir(path.join(root,'..','retake'));
const questions=original.questions.map(q=>{
  const files=images.filter(name=>name.startsWith(q.photoId+'_')&&name.endsWith('.jpg'));
  if(files.length!==1)throw Error('Expected one original RETAKE image for question '+q.id);
  return {id:q.id,text:q.text,options:q.options,answer:key.get(Number(q.id)).answer,explanation:q.explanation,image:'/assets/retake/'+files[0]};
});
const bank=validateBank({version:1,sourceId:original.sourceId,contentRevision:original.contentRevision,title:'SSG105 · RETAKE',subject:'SSG105',durationMinutes:30,description:'Đề SU26 · RE 578312 · 30 câu nguyên văn từ ảnh gốc. Đáp án do bạn cung cấp, kèm giải thích ngắn.',questions});
await fs.writeFile(path.join(root,'web','retake.json'),JSON.stringify(bank,null,2)+'\n');
console.log(`Built RETAKE: ${bank.questions.length} questions, ${bank.questions.map(q=>q.answer).join('')}.`);
