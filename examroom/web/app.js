import {validateBank, parseAnswers, grade, shuffled, syncBundledBank, addBundledBank} from './core.mjs';

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID();
const formatTime = s => `${String(Math.floor(Math.max(0,s)/60)).padStart(2,'0')}:${String(Math.max(0,s)%60).padStart(2,'0')}`;
const date = n => new Date(n).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
let db, banks=[], attempts=[], active=null, result=null, page='library', search='', reviewFilter='all', reviewIndex=0, uploading=false, importTab='json', staged=null, imageFiles=[];
const app=$('#app'), modal=$('#modal');

function toast(message) {$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function database() {return new Promise((resolve,reject)=>{const req=indexedDB.open('examroom-local-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('kv');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('Không thể mở bộ nhớ trình duyệt. Hãy bật quyền lưu dữ liệu cho localhost.'));});}
function read(key) {return new Promise((resolve,reject)=>{const r=db.transaction('kv').objectStore('kv').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function write(key,value) {return new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Không lưu được dữ liệu. Bộ nhớ trình duyệt có thể đã đầy. Hãy xuất bộ đề để sao lưu.'));});}
function writeEntries(entries) {return new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite');for(const [key,value] of entries)tx.objectStore('kv').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Chưa lưu được bản cập nhật bộ đề. Dữ liệu cũ vẫn được giữ.'));});}
function persistActive() {return write('active',active).catch(e=>toast(e.message));}
function download(name,data,type='application/json') {const url=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function closeModal() {modal.close();modal.classList.remove('image-modal');}
function openModal(html) {modal.innerHTML=html;if(!modal.open)modal.showModal();}
const modalHead = title => `<div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close" aria-label="Đóng">✕</button></div>`;
function shell(content) {return `<div class="shell"><aside class="sidebar"><a href="#" class="brand" data-action="library"><span class="logo">≋</span>examroom<span style="color:#c0c9ba">.</span></a><div class="nav-label">GÓC HỌC TẬP</div><nav class="nav" aria-label="Điều hướng"><button class="${page==='library'?'active':''}" data-action="library" title="Thư viện đề"><span class="nav-symbol">▦</span>Thư viện đề</button><button class="${page==='history'?'active':''}" data-action="history" title="Lịch sử làm bài"><span class="nav-symbol">◷</span>Lịch sử làm bài</button><button class="${page==='help'?'active':''}" data-action="help" title="Hướng dẫn nhập đề"><span class="nav-symbol">▤</span>Hướng dẫn nhập đề</button></nav><div class="sidebar-bottom"><span class="local-dot"></span>Không gian học tập local<br>Dữ liệu lưu trên trình duyệt này.<div class="profile"><span class="avatar">B</span><div><strong style="color:var(--ink)">Không gian của bạn</strong><br>Học theo nhịp riêng</div></div></div></aside><main class="main"><header class="topbar"><span>Không gian cá nhân <span style="padding:0 10px;color:#b8c0b4">/</span> <strong>${page==='history'?'Lịch sử làm bài':page==='help'?'Hướng dẫn':'Thư viện đề'}</strong></span><div class="top-right"><span class="status"><span class="local-dot"></span>LOCAL WORKSPACE</span><span class="avatar">B</span></div></header>${content}</main></div>`;}
function render() {
  if(page==='exam' && active) return renderExam();
  if(page==='results' && result) return renderResults();
  if(page==='history') return renderHistory();
  if(page==='help') return renderHelp();
  page='library';renderLibrary();
}
function renderLibrary() {
  const total=banks.reduce((s,b)=>s+b.questions.length,0);
  const avg=attempts.length?(attempts.reduce((s,a)=>s+a.grade.score,0)/attempts.length).toFixed(1):'—';
  app.innerHTML=shell(`<section class="hero"><div><div class="eyebrow">MỖI LẦN LUYỆN, MỘT BƯỚC TIẾN</div><h1>Sẵn sàng cho bài thi tiếp theo.</h1><p>Mang bộ đề của bạn vào. Tập trung làm bài. Hiểu những điều còn thiếu.</p></div><button class="btn primary" data-action="import"><span>＋</span> Tải bộ đề lên</button></section>${active?`<div class="resume"><div><strong>Bạn có một bài đang làm</strong><div class="muted" style="font-size:12px;margin-top:6px">${esc(active.bank.title)} · Đã trả lời ${Object.keys(active.answers).length}/${active.ids.length} câu</div></div><button class="btn small primary" data-action="resume">Tiếp tục bài thi →</button></div>`:''}<section class="stats"><div class="stat"><div class="stat-icon">▤</div><div><strong>${banks.length.toString().padStart(2,'0')}</strong><span>Bộ đề trong thư viện</span></div></div><div class="stat"><div class="stat-icon">✓</div><div><strong>${total}</strong><span>Câu hỏi sẵn sàng</span></div></div><div class="stat"><div class="stat-icon">◴</div><div><strong>${avg}<small style="font-size:12px;font-weight:400"> / 10</small></strong><span>Điểm trung bình · ${attempts.length} lượt</span></div></div></section><div class="library-layout"><section><div class="section-head"><h2>Bộ đề của bạn <span class="muted" style="font-weight:400;font-size:12px">(${banks.length})</span></h2><label class="search"><span>⌕</span><input id="search" type="search" value="${esc(search)}" placeholder="Tìm bộ đề…" aria-label="Tìm bộ đề"></label></div><div class="bank-list" id="bank-list">${bankCards()}</div></section><aside class="library-aside"><div class="note-card"><div class="eyebrow" style="margin-bottom:14px">HỌC CHỦ ĐỘNG HƠN</div><h3>Một phòng thi, theo cách của bạn.</h3><ol class="steps"><li><div><strong>Đưa bộ đề vào</strong>Nhập JSON hoặc ảnh câu hỏi kèm đáp án.</div></li><li><div><strong>Thử sức như thi thật</strong>Đếm giờ, chọn đáp án, đánh dấu câu cần xem lại.</div></li><li><div><strong>Hiểu sau mỗi lần làm</strong>Xem kết quả và giải thích sau khi nộp bài.</div></li></ol><button class="btn small ghost full" data-action="template">↓ Tải bộ đề mẫu</button></div><div class="note-card warm"><div class="eyebrow" style="color:#9a855c;margin-bottom:12px">KHÔNG GIAN RIÊNG</div><h3>Chỉ bạn và bài thi.</h3><p>Không tài khoản, không bảng xếp hạng. Bộ đề và lịch sử được lưu trên trình duyệt của bạn. Xuất JSON để giữ một bản sao.</p></div></aside></div><p class="footer-note">Một chút tập trung hôm nay. Thêm một chút tự tin ngày mai.</p>`);
}
function bankCards() {
  const found=banks.filter(b=>(b.title+' '+b.subject).toLowerCase().includes(search.toLowerCase()));
  return found.map(b=>{const own=attempts.filter(a=>a.bank.id===b.id);const best=own.length?Math.max(...own.map(a=>a.grade.score)).toFixed(1):null;return `<article class="bank-card"><div class="bank-banner"><div><div class="course">${esc(b.subject.slice(0,14))}</div><div class="course-sub">YOUR NEXT CHALLENGE</div></div><div class="art" aria-hidden="true"><div class="art-paper"></div><div class="art-check">✓</div></div></div><div class="bank-body"><div class="tags"><span class="tag">${(b.id==='demo-fe'||b.id==='builtin-retake')?'BỘ ĐỀ CÓ SẴN':'ĐỀ CỦA BẠN'}</span><span class="tag neutral">${b.id==='builtin-retake'?'RETAKE':'TRẮC NGHIỆM'}</span></div><h3>${esc(b.title)}</h3><p>${esc(b.description||'Một bộ đề mới, một cơ hội luyện tập.')}</p><div class="bank-meta"><span>▤ ${b.questions.length} câu hỏi</span><span>◷ ${b.durationMinutes} phút</span><span>${best?`Tốt nhất ${best}/10`:'Chưa làm bài'}</span></div><div class="bank-footer"><div class="mini-actions"><button class="icon-btn" data-action="export" data-id="${esc(b.id)}" aria-label="Xuất bộ đề ${esc(b.title)}" title="Xuất bộ đề">↓</button><button class="icon-btn" data-action="delete" data-id="${esc(b.id)}" aria-label="Xóa bộ đề ${esc(b.title)}" title="Xóa khỏi thư viện">×</button></div><button class="btn primary" data-action="setup" data-id="${esc(b.id)}">Bắt đầu luyện thi <span>→</span></button></div></div></article>`;}).join('')+(found.length===0?'<div class="empty">Không tìm thấy bộ đề phù hợp.</div>':'')+`<button class="import-card" data-action="import"><span class="plus">＋</span><strong>Thêm một thử thách mới</strong><p>Tải bộ câu hỏi và đáp án của bạn lên<br>JSON hoặc ảnh PNG, JPG, WebP</p></button>`;
}
function renderHistory() {app.innerHTML=shell(`<section class="hero"><div><div class="eyebrow">NHÌN LẠI ĐỂ TIẾN XA HƠN</div><h1>Những lần bạn đã thử sức.</h1><p>Mỗi bài làm là một cơ hội hiểu mình hơn. Lưu tối đa 30 lượt gần nhất.</p></div>${attempts.length?'<button class="btn small danger" data-action="clear-history">Xóa lịch sử</button>':''}</section>${attempts.length?attempts.map(a=>`<article class="history-row"><div><h3>${esc(a.bank.title)}</h3><p>${date(a.finishedAt)} · ${a.grade.correct}/${a.grade.total} câu đúng · ${a.settings.mode==='practice'?'Luyện tập':'Thi thử'} · ${formatTime(a.elapsed)}</p></div><div style="display:flex;gap:20px;align-items:center"><span class="history-score">${a.grade.score}<small style="font-size:11px;font-weight:400">/10</small></span><button class="btn small" data-action="view-attempt" data-id="${a.id}">Xem bài →</button></div></article>`).join(''):'<div class="empty">Chưa có bài đã nộp. Hãy bắt đầu một đề trong thư viện.</div>'}`);}
function renderHelp() {app.innerHTML=shell(`<div class="help-content"><section class="hero"><div><div class="eyebrow">TỪ BỘ ĐỀ ĐẾN PHÒNG THI</div><h1>Bộ đề của bạn, theo hai cách.</h1><p>Nhập một lần và luyện lại bất cứ lúc nào.</p></div></section><div class="note-card"><h2>01. Bộ đề JSON có nội dung chữ</h2><p>Mỗi câu cần nội dung, 2–6 lựa chọn A–F và một đáp án đúng. Có thể thêm giải thích và ảnh nhúng. Tải mẫu bên dưới để xem cấu trúc đầy đủ.</p><pre>${esc(JSON.stringify(template(),null,2))}</pre><button class="btn primary" data-action="template">↓ Tải JSON mẫu</button><h2>02. Ảnh câu hỏi + bảng đáp án</h2><p>Chọn nhiều ảnh, mỗi ảnh chứa một câu hỏi và đầy đủ các lựa chọn. Kiểm tra số câu bên cạnh từng tên file. Sau đó dán bảng đáp án hoặc tải TXT/JSON chứa đáp án.</p><pre>1. A\n2. C\n3. B</pre><p>Để thêm giải thích riêng cho ảnh, dùng JSON đáp án:</p><pre>${esc(' {"answers":{"1":{"answer":"A","explanation":"Giải thích ngắn"},"2":"C"}}')}</pre><h2>Thi thử hay luyện tập?</h2><p><strong>Thi thử</strong> giữ đáp án và giải thích đến khi bạn nộp bài, có đồng hồ tự nộp khi hết giờ. <strong>Luyện tập</strong> không giới hạn thời gian, cho xem giải thích sau khi chọn. Bạn có thể đảo thứ tự câu và chỉ làm một phần bộ đề.</p><h2>Dữ liệu của bạn</h2><p>Bộ đề, ảnh, lịch sử và bài đang làm được lưu bằng IndexedDB trong trình duyệt. Giữ cùng địa chỉ localhost và trình duyệt để tiếp tục. Xóa dữ liệu trang hoặc dùng chế độ ẩn danh có thể làm mất dữ liệu. Nút xuất bộ đề tạo JSON có cả ảnh để sao lưu hoặc chuyển máy.</p><h2>Sau này: học từ tài liệu</h2><p>Phiên bản hiện tại sử dụng đáp án và giải thích bạn cung cấp. Chức năng đọc tài liệu, tự giải và giải thích bằng AI sẽ được bổ sung ở giai đoạn tiếp theo.</p></div></div>`);}
function template() {return {version:1,title:'Bộ đề mẫu của tôi',subject:'Tự học',durationMinutes:15,description:'Thay bằng câu hỏi của bạn.',questions:[{id:'1',text:'Một nhóm làm việc hiệu quả nên làm gì?',options:{A:'Thống nhất mục tiêu và trách nhiệm',B:'Để một người làm mọi việc',C:'Né tránh mọi phản hồi',D:'Không cần thời hạn'},answer:'A',explanation:'Mục tiêu chung và trách nhiệm rõ ràng giúp nhóm phối hợp hiệu quả.'},{id:'2',text:'Khi sử dụng ý tưởng từ nguồn khác, bạn cần làm gì?',options:{A:'Chỉ thay vài từ',B:'Ghi nhận nguồn phù hợp',C:'Nhận đó là ý tưởng của mình'},answer:'B',explanation:'Diễn đạt lại vẫn cần ghi nguồn cho ý tưởng được sử dụng.'}]};}

function showImport(tab='json') {
  importTab=tab;staged=null;imageFiles=[];
  openModal(`${modalHead('Đưa bộ đề vào phòng thi')}<p class="modal-sub">Đáp án sẽ được giữ kín trong chế độ thi thử. Chỉ lưu bộ đề sau khi kiểm tra dữ liệu thành công.</p><div class="upload-tabs"><button data-action="import-json" class="${tab==='json'?'active':''}">▤ Bộ đề JSON</button><button data-action="import-images" class="${tab==='images'?'active':''}">▧ Ảnh + đáp án</button></div><div id="import-fields">${tab==='json'?`<label class="dropzone">Chọn bộ đề JSON<input id="json-file" type="file" accept=".json,application/json"></label><p class="modal-sub">Hỗ trợ tối đa 500 câu, file tối đa 45 MB. Ảnh cần nhúng base64 để bộ đề có thể chuyển máy.</p><button class="btn small" data-action="template">↓ Tải JSON mẫu</button>`:`<div class="row"><label class="field">Tên bộ đề<input id="bank-title" placeholder="Ví dụ: SSG105 · Retake"></label><label class="field">Môn học<input id="bank-subject" placeholder="Ví dụ: SSG105"></label></div><label class="dropzone">Mỗi ảnh là một câu, có đầy đủ các lựa chọn<input id="image-files" type="file" accept="image/png,image/jpeg,image/webp" multiple></label><div id="file-map"></div><div class="row"><label class="field">Số phương án mỗi câu<select id="option-count"><option value="4">4 phương án (A–D)</option><option value="5">5 phương án (A–E)</option><option value="6">6 phương án (A–F)</option><option value="2">2 phương án (A–B)</option><option value="3">3 phương án (A–C)</option></select><small>Có thể chỉnh từng câu trong bảng ảnh.</small></label><label class="field">Thời gian mặc định (phút)<input id="import-duration" type="number" min="1" max="600" value="30"></label></div><label class="field">Bảng đáp án<textarea id="answer-text" placeholder="1. A&#10;2. C&#10;3. B"></textarea><small>Đánh số trùng với số câu bạn gán cho ảnh. Hoặc dùng JSON đáp án để thêm giải thích.</small></label><label class="field">Tải bảng đáp án từ file<input id="answer-file" type="file" accept=".txt,.json,.md"></label>`}</div><div id="import-message" aria-live="polite"></div><div class="modal-actions"><button class="btn" data-action="close">Hủy</button><button class="btn primary" id="import-submit" data-action="validate-import">Kiểm tra bộ đề →</button></div>`);
}
async function fileText(file) {if(!file)throw Error('Hãy chọn file trước.');if(file.size>45*1024*1024)throw Error('File vượt quá 45 MB.');return file.text();}
function imageData(file) {return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Không đọc được ảnh '+file.name));r.readAsDataURL(file);});}
function imageMap() {$('#file-map').innerHTML=imageFiles.length?`<p class="modal-sub">${imageFiles.length} ảnh · Đổi số câu để khớp đề gốc. Không suy đoán số câu từ tên ảnh Facebook.</p><div class="file-map">${imageFiles.map((f,i)=>`<div class="file-row"><label>Câu <input class="map-number" type="number" value="${i+1}" min="1" max="${imageFiles.length}" data-index="${i}" aria-label="Số câu cho ${esc(f.name)}"></label><span title="${esc(f.name)}">${esc(f.name)}</span><select class="map-options" aria-label="Số phương án của ${esc(f.name)}">${[2,3,4,5,6].map(n=>`<option value="${n}" ${n===Number($('#option-count').value)?'selected':''}>${n} lựa chọn</option>`).join('')}</select></div>`).join('')}</div>`:'';}
async function validateImport() {
  if(uploading)return;uploading=true;$('#import-submit').disabled=true;
  try {
    let raw;
    if(importTab==='json'){try{raw=JSON.parse(await fileText($('#json-file').files[0]));}catch(e){throw Error(e instanceof SyntaxError?'File JSON không đúng cú pháp. Hãy đối chiếu JSON mẫu.':e.message);}}
    else {
      if(!imageFiles.length)throw Error('Hãy chọn ít nhất một ảnh.');
      const mappings=[...modal.querySelectorAll('.map-number')].map(el=>Number(el.value));
      if(new Set(mappings).size!==imageFiles.length||mappings.some(n=>!Number.isInteger(n)||n<1||n>imageFiles.length))throw Error('Số câu của ảnh phải đủ từ 1 đến '+imageFiles.length+', không trùng nhau.');
      const key=parseAnswers($('#answer-text').value,imageFiles.length);
      const counts=[...modal.querySelectorAll('.map-options')].map(el=>Number(el.value));
      raw={title:$('#bank-title').value.trim()||'Bộ đề từ ảnh',subject:$('#bank-subject').value.trim()||'Tự học',durationMinutes:Number($('#import-duration').value),questions:[]};
      for(let i=0;i<imageFiles.length;i++) {
        const n=mappings[i], answer=key.get(n);
        raw.questions.push({id:String(n),text:'',image:await imageData(imageFiles[i]),options:Object.fromEntries(Array.from({length:counts[i]},(_,j)=>[String.fromCharCode(65+j),'Phương án '+String.fromCharCode(65+j)])),...answer});
      }
      raw.questions.sort((a,b)=>Number(a.id)-Number(b.id));
    }
    staged=validateBank(raw);
    $('#import-message').innerHTML=`<div class="notice"><strong>✓ Bộ đề hợp lệ: ${esc(staged.title)}</strong><br>${staged.questions.length} câu · ${staged.durationMinutes} phút · ${staged.questions.filter(q=>q.explanation).length} câu có giải thích.<br>Kiểm tra câu đầu: ${esc(staged.questions[0].text||'Câu hỏi bằng ảnh')}<br>Câu cuối: ${esc(staged.questions.at(-1).text||'Câu hỏi bằng ảnh')}</div>`;
    $('#import-fields').inert=true;$('#import-submit').textContent='Lưu vào thư viện';$('#import-submit').dataset.action='save-import';
  } catch(e){$('#import-message').innerHTML=`<p class="error">${esc(e.message)}</p>`;}
  finally{uploading=false;$('#import-submit').disabled=false;}
}
async function saveImport() {if(!staged||uploading)return;uploading=true;try{const bank={...staged,id:uid(),createdAt:Date.now()};const next=[bank,...banks];await write('banks',next);banks=next;closeModal();page='library';search='';render();toast('Đã thêm bộ đề. Bắt đầu khi bạn sẵn sàng.');}finally{uploading=false;}}
function setup(id,wrongIds=null) {
  const bank=banks.find(b=>b.id===id)||(result?.bank.id===id?result.bank:null);if(!bank)return;
  openModal(`${modalHead(wrongIds?'Luyện lại những câu chưa đúng':'Thiết lập buổi luyện thi')}<p class="modal-sub">${esc(bank.title)} · ${wrongIds?wrongIds.length:bank.questions.length} câu có sẵn</p><div class="row"><label class="field">Cách làm bài<select id="mode"><option value="exam">Thi thử · Chấm sau khi nộp</option><option value="practice">Luyện tập · Giải thích ngay</option></select></label><label class="field">Thời gian (phút)<input id="duration" type="number" min="1" max="600" value="${bank.durationMinutes}"></label></div><label class="field">Số câu muốn làm<input id="question-count" type="number" min="1" max="${wrongIds?.length||bank.questions.length}" value="${wrongIds?.length||bank.questions.length}"></label><label class="check"><input id="shuffle" type="checkbox"> Đảo thứ tự câu hỏi</label><label class="check"><input id="prefer-image" type="checkbox"> Ưu tiên hiển thị ảnh gốc nếu có</label>${bank.id==='demo-fe'?'<p class="notice">Câu hỏi và các lựa chọn được chép nguyên văn từ ảnh gốc, giữ cả tình huống và cách diễn đạt của đề. Có thể mở ảnh để đối chiếu. Đáp án là đáp án tham khảo; câu 22 có lưu ý.</p>':''}${bank.id==='builtin-retake'?'<p class="notice">Đề RETAKE giữ nguyên câu hỏi và lựa chọn từ ảnh gốc. Đáp án chấm theo bảng bạn cung cấp; giải thích ngắn được lưu riêng.</p>':''}${active?'<p class="notice">Bắt đầu lượt mới sẽ thay thế bài đang làm. Bạn có thể hủy để quay lại tiếp tục bài cũ.</p>':''}<div id="setup-error"></div><div class="modal-actions"><button class="btn" data-action="close">Để sau</button><button class="btn primary" data-action="start" data-id="${esc(id)}" data-wrong="${esc(JSON.stringify(wrongIds))}">Vào phòng thi →</button></div>`);
}
async function start(id,wrongIds) {
  const bank=banks.find(b=>b.id===id)||(result?.bank.id===id?result.bank:null);
  const mode=$('#mode').value, mins=Number($('#duration').value), count=Number($('#question-count').value);
  const pool=wrongIds?bank.questions.filter(q=>wrongIds.includes(q.id)):bank.questions;
  if(!Number.isInteger(count)||count<1||count>pool.length||!Number.isInteger(mins)||mins<1||mins>600){$('#setup-error').innerHTML='<p class="error">Kiểm tra số câu và thời gian (1–600 phút).</p>';return;}
  const questions=($('#shuffle').checked?shuffled(pool):pool).slice(0,count);
  const next={id:uid(),bank:structuredClone(bank),ids:questions.map(q=>q.id),answers:{},flags:[],revealed:[],index:0,startedAt:Date.now(),deadline:mode==='exam'?Date.now()+mins*60000:null,settings:{mode,preferImage:$('#prefer-image').checked,durationMinutes:mins}};
  await write('active',next);active=next;closeModal();page='exam';render();window.scrollTo(0,0);
}
const activeQuestions = a => a.ids.map(id=>a.bank.questions.find(q=>q.id===id));
function examHeader() {return `<header class="exam-header"><a href="#" class="brand exam-brand" data-action="exam-home"><span class="logo">≋</span>examroom.</a><span class="status"><span class="local-dot"></span>PHÒNG THI CÁ NHÂN</span><button class="btn small ghost" data-action="exam-home">Lưu & về thư viện</button></header>`;}
function renderExam() {
  const questions=activeQuestions(active),q=questions[active.index],answered=Object.keys(active.answers).length;
  const revealed=active.settings.mode==='practice'&&active.revealed.includes(q.id);
  app.innerHTML=`<main class="exam-shell">${examHeader()}<div class="exam-heading"><div><div class="eyebrow" style="margin-bottom:9px">${active.settings.mode==='practice'?'LUYỆN TẬP THEO NHỊP RIÊNG':'THI THỬ · HÃY TIN VÀO BẠN'}</div><h1>${esc(active.bank.title)}</h1><p>${questions.length} câu hỏi · Một đáp án đúng mỗi câu · Tự động lưu tiến độ</p></div><div class="timer" id="timer"><small>${active.deadline?'THỜI GIAN CÒN LẠI':'ĐÃ LUYỆN TẬP'}</small><strong id="clock">${formatTime(active.deadline?Math.ceil((active.deadline-Date.now())/1000):Math.floor((Date.now()-active.startedAt)/1000))}</strong></div></div><div class="exam-layout"><section class="question-panel" aria-label="Câu hỏi"><div class="question-top"><span>CÂU ${active.index+1} / ${questions.length} <span style="padding-left:8px">· Mã câu gốc ${esc(q.id)}</span></span><button class="flag ${active.flags.includes(q.id)?'flagged':''}" data-action="flag">⚑ ${active.flags.includes(q.id)?'Đã đánh dấu':'Xem lại sau'}</button></div>${questionContent(q,active.answers[q.id],revealed,active.settings.preferImage)}<div class="question-navigation"><button class="btn" data-action="prev" ${active.index===0?'disabled':''}>← Câu trước</button><span class="keyboard-hint">A–F để chọn · ← → chuyển câu</span>${active.index===questions.length-1?'<button class="btn primary" data-action="submit-prompt">Nộp bài ✓</button>':'<button class="btn primary" data-action="next">Câu tiếp →</button>'}</div></section><aside class="navigator"><h3>Phiếu trả lời</h3><p>Đã hoàn thành <strong>${answered}/${questions.length}</strong> câu</p><div class="progress"><div style="width:${answered/questions.length*100}%"></div></div><div class="question-grid">${questions.map((item,i)=>`<button class="qnum ${active.answers[item.id]?'answered':''} ${i===active.index?'current':''} ${active.flags.includes(item.id)?'flagged':''}" data-action="jump" data-index="${i}" aria-label="Câu ${i+1}${active.answers[item.id]?', đã trả lời':''}${active.flags.includes(item.id)?', đã đánh dấu':''}" ${i===active.index?'aria-current="step"':''}>${i+1}</button>`).join('')}</div><div class="legend"><span><i></i>Đã trả lời</span><span><i class="blank"></i>Chưa trả lời</span><span><i class="flag"></i>Xem lại</span></div><button class="btn primary full" data-action="submit-prompt">Nộp bài thi →</button><p style="text-align:center;margin-bottom:0">${active.deadline?'Hệ thống tự nộp khi hết giờ.':'Không giới hạn thời gian.'}</p></aside></div></main>`;
  if(active.sourceContentUpdated){
    const notice=document.createElement('p');notice.className='notice';
    notice.textContent='Bộ đề đã được cập nhật nguyên văn từ ảnh gốc. Các đáp án bạn đã chọn, câu đánh dấu và thời gian làm bài được giữ lại.';
    app.querySelector('.exam-heading').after(notice);
  }
}
function questionContent(q,selected,reveal,preferImage=false) {
  const imageFirst=!!q.image&&(preferImage||!q.text);
  return `${q.text?`<h2>${esc(q.text)}</h2>`:''}${q.image?`<details class="image-details" ${imageFirst?'open':''}><summary>${imageFirst?'Ảnh câu hỏi gốc':'▧ Xem ảnh câu hỏi gốc'}</summary><img class="question-image" src="${esc(q.image)}" alt="Ảnh gốc câu ${esc(q.id)}" data-action="zoom" data-image="${esc(q.id)}"></details>`:''}<div class="options" role="group" aria-label="Các phương án">${Object.entries(q.options).map(([key,value])=>`<button class="option ${selected===key?'selected':''} ${reveal&&key===q.answer?'correct':''} ${reveal&&selected===key&&selected!==q.answer?'wrong':''}" data-action="answer" data-key="${key}" aria-pressed="${selected===key}" ${reveal?'disabled':''}><span class="letter">${key}</span><span>${esc(value)}${reveal&&key===q.answer?' ✓':''}</span></button>`).join('')}</div>${reveal?`<div class="explanation"><strong>${selected===q.answer?'✓ Chính xác':'Đáp án đúng: '+q.answer}</strong>${esc(q.explanation||'Bộ đề chưa cung cấp giải thích cho câu này.')}</div>${q.note?`<div class="notice">${esc(q.note)}</div>`:''}`:''}`;
}
async function finish(auto=false) {
  if(!active||finish.busy)return;finish.busy=true;
  const snapshot=structuredClone(active), questions=activeQuestions(snapshot);
  const end=snapshot.deadline?Math.min(Date.now(),snapshot.deadline):Date.now();
  const done={...snapshot,finishedAt:end,elapsed:Math.max(0,Math.floor((end-snapshot.startedAt)/1000)),grade:grade(questions,snapshot.answers),autoSubmitted:auto};
  try {
    const next=[done,...attempts].slice(0,30);
    await write('attempts',next);await write('active',null);
    attempts=next;active=null;result=done;page='results';reviewFilter='all';reviewIndex=0;closeModal();render();window.scrollTo(0,0);
    if(auto)toast('Đã hết giờ. Bài của bạn được tự động nộp.');
  }catch(e){toast(e.message);}finally{finish.busy=false;}
}
function submitPrompt() {const blank=active.ids.length-Object.keys(active.answers).length;openModal(`${modalHead('Bạn đã sẵn sàng nộp bài?')}<p class="modal-sub">Đã trả lời ${Object.keys(active.answers).length}/${active.ids.length} câu. Sau khi nộp, bạn sẽ xem được đáp án và giải thích.</p>${blank?`<div class="notice">Còn ${blank} câu chưa trả lời. Các câu này sẽ được tính là chưa đúng.</div>`:''}<div class="modal-actions"><button class="btn" data-action="close">Quay lại kiểm tra</button><button class="btn primary" data-action="finish">Nộp bài & xem kết quả</button></div>`);}
function reviewQuestions() {const all=activeQuestions(result);return all.filter(q=>reviewFilter==='all'||(reviewFilter==='wrong'&&result.answers[q.id]!==q.answer)||(reviewFilter==='flagged'&&result.flags.includes(q.id)));}
function renderResults() {
  const questions=reviewQuestions();reviewIndex=Math.min(reviewIndex,Math.max(0,questions.length-1));const q=questions[reviewIndex], g=result.grade;
  app.innerHTML=`<main class="exam-shell"><header class="exam-header"><a href="#" class="brand exam-brand" data-action="library"><span class="logo">≋</span>examroom.</a><button class="btn small" data-action="history">Lịch sử làm bài →</button></header><section class="results-hero"><div class="score"><strong>${g.score}</strong><span>ĐIỂM / 10</span></div><div style="flex:1"><div class="eyebrow" style="margin-bottom:10px">${g.score>=8?'MỘT BUỔI LUYỆN TẬP THẬT TỐT':'MỖI LỖI SAI LÀ MỘT ĐIỀU ĐỂ HỌC'}</div><h1>${g.score>=8?'Bạn đang tiến bộ từng ngày.':'Thêm một lần thử, thêm một bước tiến.'}</h1><p>${esc(result.bank.title)} · ${date(result.finishedAt)}${result.autoSubmitted?' · Tự nộp khi hết giờ':''}</p><div class="result-stats"><div><strong>${g.correct}</strong>Câu đúng</div><div><strong>${g.total-g.correct-g.blank}</strong>Câu sai</div><div><strong>${g.blank}</strong>Bỏ trống</div><div><strong>${formatTime(result.elapsed)}</strong>Thời gian</div></div></div></section><div class="section-head"><h2>Xem lại để hiểu sâu hơn</h2><div style="display:flex;gap:8px"><button class="btn small" data-action="export-result">↓ Kết quả</button><button class="btn small primary" data-action="retry">Làm lại →</button></div></div><div class="results-controls"><button class="btn small filter ${reviewFilter==='all'?'active':''}" data-action="filter" data-filter="all">Tất cả (${g.total})</button><button class="btn small filter ${reviewFilter==='wrong'?'active':''}" data-action="filter" data-filter="wrong">Chưa đúng (${g.total-g.correct})</button><button class="btn small filter ${reviewFilter==='flagged'?'active':''}" data-action="filter" data-filter="flagged">Đã đánh dấu (${result.flags.length})</button>${g.correct<g.total?'<button class="btn small" data-action="retry-wrong">↻ Luyện lại câu chưa đúng</button>':''}</div><div class="exam-layout"><section class="question-panel">${q?`<div class="question-top"><span>MÃ CÂU GỐC ${esc(q.id)} · ${result.answers[q.id]?'Bạn chọn '+esc(result.answers[q.id]):'Bạn chưa trả lời'}</span><strong style="color:${result.answers[q.id]===q.answer?'var(--green)':'var(--red)'}">${result.answers[q.id]===q.answer?'✓ Đúng':'✕ Chưa đúng'}</strong></div>${questionContent(q,result.answers[q.id],true,result.settings.preferImage)}<div class="question-navigation"><button class="btn" data-action="review-prev" ${reviewIndex===0?'disabled':''}>← Câu trước</button><span class="muted" style="font-size:12px">${reviewIndex+1}/${questions.length}</span><button class="btn" data-action="review-next" ${reviewIndex===questions.length-1?'disabled':''}>Câu tiếp →</button></div>`:'<div class="empty">Không có câu nào trong nhóm này.</div>'}</section><aside class="navigator"><h3>Bản đồ kết quả</h3><p>Chọn một số để xem lại câu hỏi.</p><div class="question-grid">${questions.map((item,i)=>`<button class="qnum ${result.answers[item.id]===item.answer?'right':'wrong'} ${i===reviewIndex?'current':''}" data-action="review-jump" data-index="${i}" aria-label="Xem câu gốc ${esc(item.id)}">${esc(item.id)}</button>`).join('')}</div><button class="btn full" data-action="library">← Về thư viện</button></aside></div></main>`;
  if(result.sourceContentUpdated){
    const notice=document.createElement('p');notice.className='notice';
    notice.textContent='Lượt làm này bắt đầu trước khi khôi phục đề nguyên văn. Phần xem lại hiển thị đề đã sửa; lựa chọn và điểm của lượt làm cũ được giữ nguyên.';
    app.querySelector('.results-hero').after(notice);
  }
}
async function exportBank(id) {const bank=banks.find(b=>b.id===id);if(!bank)return;toast('Đang đóng gói bộ đề và ảnh…');const data=structuredClone(bank);delete data.id;delete data.createdAt;for(const q of data.questions){if(/^\/assets\/(fe|retake)\//.test(q.image||'')){const r=await fetch(q.image);if(!r.ok)throw Error('Không tìm thấy ảnh gốc.');q.image=await imageData(await r.blob());}}download('examroom-'+bank.subject.replace(/[^\w-]/g,'_')+'.json',data);toast('Đã xuất bộ đề có thể nhập lại, kèm ảnh.');}

document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-action]');if(!button||button.disabled)return;e.preventDefault();const action=button.dataset.action,id=button.dataset.id;
  try {
    if(['library','history','help','exam-home'].includes(action)){page=action==='exam-home'?'library':action;search='';render();window.scrollTo(0,0);}
    else if(action==='import')showImport();
    else if(action==='close')closeModal();
    else if(action==='template')download('examroom-template.json',template());
    else if(action==='import-json')showImport('json');
    else if(action==='import-images')showImport('images');
    else if(action==='validate-import')await validateImport();
    else if(action==='save-import')await saveImport();
    else if(action==='setup')setup(id);
    else if(action==='start')await start(id,JSON.parse(button.dataset.wrong));
    else if(action==='resume'){page='exam';render();tick();}
    else if(action==='export')await exportBank(id);
    else if(action==='delete'){openModal(`${modalHead('Xóa bộ đề khỏi thư viện?')}<p class="modal-sub">${esc(banks.find(b=>b.id===id)?.title)}. Lịch sử và bài đang làm vẫn giữ nguyên. Bạn có thể xuất bộ đề trước khi xóa.</p><div class="modal-actions"><button class="btn" data-action="close">Giữ lại</button><button class="btn danger" data-action="delete-confirm" data-id="${esc(id)}">Xóa bộ đề</button></div>`);}
    else if(action==='delete-confirm'){const next=banks.filter(b=>b.id!==id);await write('banks',next);banks=next;closeModal();render();toast('Đã xóa khỏi thư viện. Có thể khôi phục bằng bản JSON đã xuất.');}
    else if(action==='answer'&&page==='exam'&&active){if(active.deadline&&Date.now()>=active.deadline)return void await finish(true);const q=activeQuestions(active)[active.index];if(active.revealed.includes(q.id))return;active.answers[q.id]=button.dataset.key;if(active.settings.mode==='practice')active.revealed.push(q.id);await persistActive();renderExam();}
    else if(action==='flag'&&active){const q=active.ids[active.index];active.flags=active.flags.includes(q)?active.flags.filter(id=>id!==q):[...active.flags,q];await persistActive();renderExam();}
    else if(['next','prev','jump'].includes(action)&&active){active.index=action==='jump'?Number(button.dataset.index):Math.max(0,Math.min(active.ids.length-1,active.index+(action==='next'?1:-1)));await persistActive();renderExam();window.scrollTo(0,0);}
    else if(action==='submit-prompt')submitPrompt();
    else if(action==='finish')await finish();
    else if(action==='view-attempt'){result=attempts.find(a=>a.id===id);reviewFilter='all';reviewIndex=0;page='results';render();}
    else if(action==='clear-history')openModal(`${modalHead('Xóa toàn bộ lịch sử?')}<p class="modal-sub">${attempts.length} lượt làm bài sẽ bị xóa vĩnh viễn. Bộ đề và bài đang làm được giữ lại. Bạn có thể xuất kết quả từng lượt trước khi xóa.</p><div class="modal-actions"><button class="btn" data-action="close">Giữ lại</button><button class="btn danger" data-action="clear-history-confirm">Xóa lịch sử</button></div>`);
    else if(action==='clear-history-confirm'){await write('attempts',[]);attempts=[];result=null;closeModal();render();toast('Đã xóa lịch sử làm bài.');}
    else if(action==='filter'){reviewFilter=button.dataset.filter;reviewIndex=0;renderResults();}
    else if(action==='review-prev'){reviewIndex--;renderResults();}
    else if(action==='review-next'){reviewIndex++;renderResults();}
    else if(action==='review-jump'){reviewIndex=Number(button.dataset.index);renderResults();}
    else if(action==='retry')setup(result.bank.id);
    else if(action==='retry-wrong')setup(result.bank.id,result.grade.rows.filter(r=>!r.correct).map(r=>r.id));
    else if(action==='export-result')download('examroom-result.json',{title:result.bank.title,date:date(result.finishedAt),mode:result.settings.mode,elapsedSeconds:result.elapsed,...result.grade,questions:activeQuestions(result).map(q=>({id:q.id,text:q.text,selected:result.answers[q.id]||null,answer:q.answer,explanation:q.explanation,note:q.note}))});
    else if(action==='zoom'){const bank=page==='exam'?active.bank:result.bank,q=bank.questions.find(q=>q.id===button.dataset.image);modal.classList.add('image-modal');openModal(`${modalHead('Ảnh gốc · Câu '+q.id)}<img src="${esc(q.image)}" alt="Ảnh câu hỏi gốc ${esc(q.id)}">`);}
  }catch(err){toast(err.message||'Không thể hoàn thành thao tác.');}
});
document.addEventListener('input',e=>{if(e.target.id==='search'){search=e.target.value;$('#bank-list').innerHTML=bankCards();}});
document.addEventListener('change',async e=>{
  try {
    if(e.target.id==='image-files'){
      const files=[...e.target.files];
      if(files.length>500)throw Error('Tối đa 500 ảnh mỗi bộ đề.');
      if(files.some(f=>!['image/png','image/jpeg','image/webp'].includes(f.type)))throw Error('Chỉ hỗ trợ PNG, JPEG và WebP.');
      if(files.some(f=>f.size>8*1024*1024)||files.reduce((n,f)=>n+f.size,0)>32*1024*1024)throw Error('Mỗi ảnh tối đa 8 MB, tổng tối đa 32 MB.');
      imageFiles=files.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));imageMap();
    } else if(e.target.id==='answer-file')$('#answer-text').value=await fileText(e.target.files[0]);
    else if(e.target.id==='option-count')modal.querySelectorAll('.map-options').forEach(select=>select.value=e.target.value);
    else if(e.target.id==='mode'){$('#duration').disabled=e.target.value==='practice';}
  }catch(err){toast(err.message);if(e.target.id==='image-files'){imageFiles=[];e.target.value='';imageMap();}}
});
document.addEventListener('keydown',e=>{
  if(page!=='exam'||!active||modal.open||e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  const key=e.key.toUpperCase();
  if(/^[A-F]$/.test(key)){const btn=app.querySelector(`[data-action="answer"][data-key="${key}"]`);if(btn&&!btn.disabled){e.preventDefault();btn.click();}}
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();app.querySelector(`[data-action="${e.key==='ArrowRight'?'next':'prev'}"]`)?.click();}
});
function tick() {
  if(!active)return;
  const remaining=active.deadline?Math.ceil((active.deadline-Date.now())/1000):Math.floor((Date.now()-active.startedAt)/1000);
  if(active.deadline&&remaining<=0){void finish(true);return;}
  if(page==='exam'){$('#clock').textContent=formatTime(remaining);$('#timer').classList.toggle('urgent',!!active.deadline&&remaining<300);}
}
async function boot() {
  app.innerHTML='<div class="loading">Đang chuẩn bị phòng luyện thi…</div>';
  try {
    db=await database();
    const saved=await read('banks');banks=saved||[];attempts=(await read('attempts'))||[];active=(await read('active'))||null;
    let updated=false, retakeAdded=false;
    try {
      const response=await fetch('./demo.json',{cache:'no-store'});
      if(!response.ok)throw Error('Không tải được bản cập nhật đề FE.');
      const demo=validateBank(await response.json());
      if(saved===undefined){banks=[{...demo,id:'demo-fe',createdAt:Date.now()}];await write('banks',banks);}
      else {
        const next=syncBundledBank(banks,active,attempts,demo);
        if(next.changed){
          const entries=[['banks',next.banks],['active',next.active],['attempts',next.attempts]];
          if(!await read('fe-content-backup-v1'))entries.push(['fe-content-backup-v1',{banks,active,attempts,savedAt:Date.now()}]);
          await writeEntries(entries);
          banks=next.banks;active=next.active;attempts=next.attempts;updated=true;
        }
      }
    } catch(error) {if(saved===undefined)throw error;toast(error.message);}
    try {
      const response=await fetch('./retake.json',{cache:'no-store'});
      if(!response.ok)throw Error('Chưa tải được bộ RETAKE. Hãy khởi động lại server rồi tải lại trang.');
      const retake=validateBank(await response.json());
      const installKey='bundled-installed-retake-578312';
      const installed=!!await read(installKey);
      const installation=addBundledBank(banks,retake,'builtin-retake',installed);
      const next=syncBundledBank(installation.banks,active,attempts,retake,'builtin-retake');
      if(!installed||installation.added||next.changed)await writeEntries([['banks',next.banks],['active',next.active],['attempts',next.attempts],[installKey,true]]);
      banks=next.banks;active=next.active;attempts=next.attempts;retakeAdded=installation.added;
    }catch(error){toast(error.message);}
    render();tick();setInterval(tick,1000);
    if(retakeAdded)toast('Đã thêm RETAKE: 30 câu nguyên văn, đáp án theo bảng bạn cung cấp.');
    else if(updated)toast('Đã khôi phục nguyên văn 30 câu FE. Lựa chọn, thời gian và lịch sử được giữ lại.');
  }catch(e){app.innerHTML=`<div class="loading"><h1>Chưa mở được phòng thi</h1><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Thử lại</button></div>`;}
}
boot();
