// Keep question text and options exactly as transcribed from the original images.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateBank} from './web/core.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const original=JSON.parse(await fs.readFile(path.join(root,'data','fe-original.json'),'utf8'));
const md=await fs.readFile(path.join(root,'..','SSG105_FE_225597_Dap_an.md'),'utf8');
const answers=new Map([...md.matchAll(/^\| (\d+) \| \*\*([A-E])\..*?\*\* \| (.*?) \|$/gm)].map(m=>[m[1],{answer:m[2],explanation:m[3]}]));
const images=await fs.readdir(path.join(root,'..','FE'));
const questions=original.questions.map(q=>{
  const files=images.filter(name=>name.startsWith(q.photoId+'_')&&name.endsWith('.jpg'));
  if(files.length!==1)throw Error('Expected one image for question '+q.id);
  if(!answers.has(q.id))throw Error('Missing answer for question '+q.id);
  return {id:q.id,text:q.text,options:q.options,...answers.get(q.id),image:'/assets/fe/'+files[0],note:q.id==='22'?'Đáp án tham khảo theo “Why (sometimes)” trong slide; câu hỏi có cách diễn đạt chưa chặt chẽ.':''};
});
const bank=validateBank({version:1,sourceId:original.sourceId,contentRevision:original.contentRevision,title:'SSG105 · Final Exam',subject:'SSG105',durationMinutes:30,description:'Đề SU26 · 225597 · 30 câu nguyên văn từ ảnh gốc. Đáp án tham khảo và giải thích riêng.',questions});
await fs.writeFile(path.join(root,'web','demo.json'),JSON.stringify(bank,null,2)+'\n');
console.log(`Built ${bank.questions.length} verbatim questions, revision ${bank.contentRevision}.`);
