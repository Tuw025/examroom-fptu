export function validateBank(raw) {
  if (!raw || !Array.isArray(raw.questions) || !raw.questions.length) throw Error('Bộ đề cần có danh sách questions và ít nhất 1 câu.');
  if (raw.questions.length > 500) throw Error('Mỗi bộ đề hỗ trợ tối đa 500 câu.');
  const ids = new Set();
  const questions = raw.questions.map((q, i) => {
    const id = String(q.id ?? i + 1);
    if (ids.has(id)) throw Error(`ID câu bị trùng: ${id}`);
    ids.add(id);
    const options = Array.isArray(q.options) ? Object.fromEntries(q.options.map((v,j)=>[String.fromCharCode(65+j),v])) : q.options;
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw Error(`Câu ${id}: thiếu options.`);
    const keys = Object.keys(options);
    if (keys.length < 2 || keys.length > 6 || keys.some(k=>! /^[A-F]$/.test(k)) || keys.some(k=>typeof options[k] !== 'string' || !options[k].trim())) throw Error(`Câu ${id}: cần 2–6 lựa chọn A–F có nội dung.`);
    const answer = String(q.answer ?? '').trim().toUpperCase();
    if (!keys.includes(answer)) throw Error(`Câu ${id}: đáp án phải khớp một lựa chọn.`);
    const image = String(q.image || '');
    if (image && !/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(image) && !/^\/assets\/(fe|retake)\/[\w.-]+$/.test(image)) throw Error(`Câu ${id}: ảnh cần là PNG/JPEG/WebP nhúng base64.`);
    const text = String(q.text || '');
    if (!text.trim() && !image) throw Error(`Câu ${id}: cần nội dung hoặc hình ảnh.`);
    return {id, text, options: Object.fromEntries(keys.sort().map(k=>[k, options[k]])), answer, image, explanation:String(q.explanation||''), note:String(q.note||'')};
  });
  const durationMinutes = Number(raw.durationMinutes ?? 30);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) throw Error('Thời gian phải từ 1 đến 600 phút.');
  const source = typeof raw.sourceId === 'string' && Number.isInteger(raw.contentRevision) && raw.contentRevision > 0
    ? {sourceId:raw.sourceId, contentRevision:raw.contentRevision} : {};
  return {version:1, ...source, title:String(raw.title||'Bộ đề mới').slice(0,160), subject:String(raw.subject||'Tự học').slice(0,60), description:String(raw.description||''), durationMinutes, questions};
}

// Only update our bundled FE source. Imported banks retain the user's exact content.
// Answers, question order, clock and scores belong to the learner and stay intact.
export function syncBundledBank(banks, active, attempts, fresh, bundledId='demo-fe') {
  let changed = false;
  function update(bank) {
    if (!bank || bank.id !== bundledId || Number(bank.contentRevision || 0) >= fresh.contentRevision) return bank;
    changed = true;
    return {...bank, ...structuredClone(fresh), id:bank.id, createdAt:bank.createdAt};
  }
  const nextBanks = banks.map(update);
  function updateSnapshot(snapshot) {
    if (!snapshot) return snapshot;
    const bank = update(snapshot.bank);
    return bank === snapshot.bank ? snapshot : {...snapshot, bank, sourceContentUpdated:true};
  }
  const nextActive = updateSnapshot(active);
  const nextAttempts = attempts.map(updateSnapshot);
  return {banks:nextBanks, active:nextActive, attempts:nextAttempts, changed};
}

// A release is installed once per browser. Explicitly deleted banks stay deleted.
export function addBundledBank(banks, fresh, id, installed, createdAt=Date.now()) {
  if(installed)return {banks,added:false};
  const exists=banks.some(bank=>bank.id===id || (fresh.sourceId&&bank.sourceId===fresh.sourceId));
  return {banks:exists?banks:[...banks,{...structuredClone(fresh),id,createdAt}],added:!exists};
}

export function parseAnswers(text, count) {
  let entries;
  try {
    const data = JSON.parse(text);
    entries = Object.entries(data.answers || data).map(([id,v])=>[Number(id), typeof v==='string'?{answer:v}:v]);
  } catch {
    entries = [...text.matchAll(/(?:^|\n)\s*(?:\|\s*)?(\d+)\s*(?:[.:)\-]|\|)\s*(?:\*\*)?([A-F])\b[^\n]*/gi)].map(m=>[Number(m[1]),{answer:m[2]}]);
  }
  const result = new Map();
  for (const [id, v] of entries) {
    if (!Number.isInteger(id) || id < 1 || id > count) throw Error(`Đáp án có số câu ngoài phạm vi: ${id}.`);
    if (result.has(id)) throw Error(`Đáp án câu ${id} xuất hiện nhiều lần. Chỉ nhập một bảng đáp án.`);
    if (!v || !/^[A-F]$/i.test(v.answer||'')) throw Error(`Đáp án câu ${id} không hợp lệ.`);
    result.set(id,{answer:v.answer.toUpperCase(), explanation:String(v.explanation||'')});
  }
  if (result.size !== count) throw Error(`Đã nhận ${result.size}/${count} đáp án. Dùng dạng “1. A”, mỗi câu một dòng.`);
  return result;
}

export function grade(questions, answers) {
  const rows = questions.map(q=>({id:q.id, selected:answers[q.id]||null, answer:q.answer, correct:answers[q.id]===q.answer}));
  const correct = rows.filter(r=>r.correct).length;
  return {rows, correct, total:rows.length, blank:rows.filter(r=>!r.selected).length, score:Number((correct/rows.length*10).toFixed(2))};
}

export function shuffled(items, random=Math.random) {
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1)); [result[i],result[j]]=[result[j],result[i]];}
  return result;
}
