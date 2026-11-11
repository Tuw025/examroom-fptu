import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { createWorker } from 'tesseract.js';
import { validateBank } from './examroom/web/core.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://fuoverflow.com';
const COOKIE_FILE = path.join(__dirname, 'cookie.txt');

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeDirName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
}

function getHeaders(cookie) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': cookie,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'vi,en;q=0.9',
    'Cache-Control': 'no-cache'
  };
}

async function fetchWithRetry(url, headers, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 429) {
        console.warn(`[429 Rate Limit] Đang tạm dừng 5 giây trước khi thử lại...`);
        await sleep(5000);
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[Thử lại ${attempt}/${retries}] ${url} - Lỗi: ${err.message}`);
      await sleep(1500 * attempt);
    }
  }
}

function extractProbableAnswer(text) {
  const clean = text.trim();
  const startMatch = clean.match(/^([A-F]+)(?:\s*[\.\:\-\)\,\(]|$)/i);
  if (startMatch) return startMatch[1][0].toUpperCase();

  const patternMatch = clean.match(/(?:đáp\s*án|chọn|câu)\s*[:\-\s]*([A-F])/i);
  if (patternMatch) return patternMatch[1].toUpperCase();

  return null;
}

function parseOcrText(rawText) {
  let text = rawText
    .replace(/^\|?\s*MULTIPLE CHOICE/im, '')
    .trim();

  let normalized = text
    .replace(/(\n|^)\s*([A-Za-z])[a-z]?\.\s*/gi, (m, p1, p2) => p1 + p2.toUpperCase() + '. ')
    .replace(/(\n|^)\s*©\.\s*/g, '$1B. ')
    .replace(/(\n|^)\s*8\.\s*/g, '$1B. ')
    .replace(/(\n|^)\s*8\s+(?=[A-Z0-9])/g, '$1B. ');

  const rawLines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  const questionLines = [];
  const options = {};
  let currentKey = null;

  const optRegexWithSep = /(?:^|[^a-zA-Z0-9])([A-F])[a-z]?(?:\.|\)|\:(?!\/)|(?:\s*-\s+))\s*(.*)$/i;
  const optRegexTF = /(?:^|[^a-zA-Z0-9])([A-F])\s+(True|False)\b/i;

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];
    
    if (/^\s*fuoverflow(?:\.com)?[\s|:_\-]*$/i.test(line)) continue;
    line = line.replace(/^\s*fuoverflow(?:\.com)?[\s§|:_\-]*\s*/i, '').trim();
    if (!line) continue;

    if (/there are \d+ questions/i.test(line)) continue;
    if (/progress of answering/i.test(line)) continue;
    if (/^[\|\s\-_=]+$/.test(line)) continue;
    if (/^(Back|Next|Clear|Submit|Review)(\s*\[\s*(Back|Next)\s*\])?\s*=?$/i.test(line)) continue;

    let m = line.match(optRegexWithSep);
    if (!m) {
      const mTF = line.match(optRegexTF);
      if (mTF) {
        m = [mTF[0], mTF[1], mTF[2]];
      }
    }

    if (!m && !currentKey) {
      const mShortA = line.match(/^(?:[oO0Q@©a-z\(\)\[\]]{1,5}\s+)?A\s+([A-Za-z0-9].*)$/);
      if (mShortA && mShortA[1].length < 100) {
        const hasB = rawLines.slice(i + 1, i + 4).some(l => /(?:^|[^a-zA-Z0-9])B(?:\.|\)|\:|\s)/i.test(l));
        if (hasB) {
          m = [line, 'A', mShortA[1]];
        }
      }
    }

    if (m) {
      const key = m[1].toUpperCase();
      if (!currentKey && (key === 'A' || key === 'B')) {
        currentKey = key;
        options[currentKey] = m[2].trim();
        continue;
      } else if (currentKey && key.charCodeAt(0) > currentKey.charCodeAt(0) && key.charCodeAt(0) <= currentKey.charCodeAt(0) + 2) {
        currentKey = key;
        options[currentKey] = m[2].trim();
        continue;
      }
    }

    if (currentKey) {
      if (!/^(Back|Next|Clear|Submit|Review|FUO)/i.test(line)) {
        options[currentKey] += ' ' + line;
      }
    } else {
      questionLines.push(line);
    }
  }

  if (options['B'] && !options['A'] && questionLines.length > 0) {
    const last = questionLines.pop();
    const candidateA = last.replace(/\(?(?:choose|ghose|chose)\s*\d*\s*answers?\)?/gi, '').replace(/^[=\-_|\s]+/, '').trim();
    if (candidateA) {
      options['A'] = candidateA;
    }
  }

  for (const k of Object.keys(options)) {
    options[k] = options[k]
      .replace(/\s*Back\s*\[\s*Next\s*\]\s*=?$/i, '')
      .replace(/\s*\[\s*Next\s*\]\s*=?$/i, '')
      .replace(/\s*Back\s*=?$/i, '')
      .replace(/\s*Next\s*=?$/i, '')
      .replace(/\s*=\s*$/i, '')
      .replace(/\s*Q:\s*\d+$/i, '')
      .replace(/\s*FUOVERFLOW.*$/i, '')
      .replace(/\s+(RO|HEE|fuck\s*\d*)$/i, '')
      .trim();
  }

  const keys = Object.keys(options).filter(k => /^[A-F]$/.test(k));
  if (keys.length < 2) {
    options['A'] = 'A (Xem hình ảnh câu hỏi gốc để chọn)';
    options['B'] = 'B (Xem hình ảnh câu hỏi gốc để chọn)';
    options['C'] = 'C (Xem hình ảnh câu hỏi gốc để chọn)';
    options['D'] = 'D (Xem hình ảnh câu hỏi gốc để chọn)';
  } else {
    if (!options['A'] && (options['B'] || options['C'])) {
      options['A'] = 'A (Xem hình ảnh câu hỏi gốc)';
    }
    for (const k of Object.keys(options)) {
      if (!/^[A-F]$/.test(k)) {
        delete options[k];
      } else if (!options[k] || !options[k].trim()) {
        options[k] = `${k} (Xem hình ảnh câu hỏi gốc)`;
      }
    }
  }

  const startIdx = questionLines.findIndex(l => /Answer\s*\|/i.test(l) || /Question:\s*\d+/i.test(l) || /(?:choose|ghose|chose)\s*\d*\s*answers?/i.test(l));
  const relevant = startIdx >= 0 ? questionLines.slice(startIdx) : questionLines;
  let qText = relevant.join('\n')
    .replace(/^[a-z0-9_\-\s]+\|\s*/i, '')
    .replace(/^Question:\s*\d+\s*/im, '')
    .replace(/^Answer\s*\|\s*/im, '')
    .replace(/\(?(?:choose|ghose|chose)\s*\d*\s*answers?\)?/gi, '')
    .trim();
  qText = qText.replace(/^[^a-zA-Z0-9?\"\'\(\)_]+/g, '').trim();

  return { qText, options };
}

async function getValidSubjects(headers) {
  console.log('-> Đang kết nối tới FUOverflow để kiểm tra danh mục môn học...');
  const res = await fetchWithRetry(`${BASE_URL}/categories/subjects/`, headers);
  const html = await res.text();
  const links = [...html.matchAll(/href="\/forums\/([^"/]+)\/?"/gi)];
  const forums = [...new Set(links.map(m => m[1]))];
  return forums;
}

async function getExamThreads(subjectForum, headers) {
  const url = `${BASE_URL}/forums/${subjectForum}/?prefix_id=11`;
  const res = await fetchWithRetry(url, headers);
  const html = await res.text();
  const threadMatches = [...html.matchAll(/href="(\/threads\/[^"]+\/)"[^>]*data-tp-primary="on"[^>]*>([\s\S]*?)<\/a>/gi)];
  return threadMatches.map(m => ({
    title: m[2].trim().replace(/\s*\|\s*FuOverflow\s*Community/gi, ''),
    url: `${BASE_URL}${m[1]}`
  }));
}

async function scrapeThreadAndBuildBank(thread, subject, headers, worker) {
  console.log(`\n======================================================`);
  console.log(`Bắt đầu cào: ${thread.title}`);
  console.log(`URL: ${thread.url}`);
  console.log(`======================================================`);

  const res = await fetchWithRetry(thread.url, headers);
  const html = await res.text();

  const folderName = sanitizeDirName(thread.title);
  const outDir = path.join(__dirname, 'output', subject.toUpperCase(), folderName);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const fileItems = [...html.matchAll(/<li class="file[^"]*"[\s\S]*?<\/li>/gi)];
  const validItems = fileItems.filter(item => {
    const nameMatch = item[0].match(/<span class="file-name"[^>]*>([\s\S]*?)<\/span>/i);
    const fileName = nameMatch ? nameMatch[1].trim() : '';
    return fileName && !fileName.includes('{{') && fileName.match(/\.(webp|jpg|jpeg|png)$/i);
  });

  if (validItems.length === 0) {
    console.warn(`[Bỏ qua] Không tìm thấy ảnh câu hỏi nào trong đề này.`);
    return;
  }

  console.log(`-> Tìm thấy ${validItems.length} câu hỏi. Đang tiến hành tải ảnh và bóc tách dữ liệu...`);

  const questions = [];

  for (let i = 0; i < validItems.length; i++) {
    const itemHtml = validItems[i][0];
    const qNum = i + 1;

    const nameMatch = itemHtml.match(/<span class="file-name"[^>]*>([\s\S]*?)<\/span>/i);
    const rawFileName = nameMatch ? nameMatch[1].trim() : `Q${qNum}.webp`;
    const extMatch = rawFileName.match(/\.(webp|jpg|jpeg|png)$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : '.webp';
    const fileName = `Q${qNum}${ext}`;
    const filePath = path.join(outDir, fileName);

    const attachMatch = itemHtml.match(/href="(\/attachments\/[^">]+)"/i);
    const attachUrl = attachMatch ? `${BASE_URL}${attachMatch[1].replace(/&amp;/g, '&')}` : null;

    if (!fs.existsSync(filePath) && attachUrl) {
      try {
        const imgRes = await fetchWithRetry(attachUrl, headers);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        fs.writeFileSync(filePath, buf);
      } catch (err) {
        console.error(`  [Lỗi tải ảnh Q${qNum}]:`, err.message);
      }
    }

    // Parse comments for answers
    let probableAnswer = 'A';
    const mediaMatch = itemHtml.match(/data-lb-sidebar-href="(\/media\/[^"?]+)/i) ||
                       itemHtml.match(/href="(\/media\/[^">]+)"/i);
    if (mediaMatch) {
      const mediaUrl = `${BASE_URL}${mediaMatch[1]}`;
      try {
        const mediaRes = await fetchWithRetry(mediaUrl, headers);
        const mediaHtml = await mediaRes.text();
        const commentArticles = [...mediaHtml.matchAll(/<article class="message message--simple message--comment[^"]*"[\s\S]*?<\/article>/gi)];
        
        for (const art of commentArticles) {
          const body = art[0].match(/<div class="bbWrapper">([\s\S]*?)<\/div>/i);
          if (body) {
            const cText = body[1].replace(/<[^>]+>/g, '').trim();
            const ans = extractProbableAnswer(cText);
            if (ans) {
              probableAnswer = ans;
              break;
            }
          }
        }
      } catch (e) {
        // Ignore media comments fetch error
      }
    }

    // OCR & Parse
    let parsed = { qText: `Question ${qNum}`, options: { A: 'A', B: 'B', C: 'C', D: 'D' } };
    if (fs.existsSync(filePath)) {
      try {
        const ret = await worker.recognize(filePath);
        parsed = parseOcrText(ret.data.text);
      } catch (ocrErr) {
        console.warn(`  [Lỗi OCR Q${qNum}]:`, ocrErr.message);
      }
    }

    const optKeys = Object.keys(parsed.options);
    if (!optKeys.includes(probableAnswer)) {
      probableAnswer = optKeys[0] || 'A';
    }

    // Standard explanation template
    const explanation = `Đáp án tham khảo: ${probableAnswer}.\n(Điền ghi chú hoặc lời giải chi tiết của bạn vào đây, ví dụ: Slide chương 1 trang 15... Xem hướng dẫn chi tiết tại file README.md)`;

    let base64Image = '';
    if (fs.existsSync(filePath)) {
      const imgBuf = fs.readFileSync(filePath);
      const mime = ext === '.webp' ? 'webp' : (ext === '.png' ? 'png' : 'jpeg');
      base64Image = `data:image/${mime};base64,${imgBuf.toString('base64')}`;
    }

    questions.push({
      id: String(qNum),
      originalId: String(qNum),
      text: parsed.qText || `Question ${qNum}`,
      options: parsed.options,
      answer: probableAnswer,
      explanation: explanation,
      image: base64Image
    });

    if (qNum % 10 === 0 || qNum === validItems.length) {
      console.log(`  -> Đã xử lý ${qNum}/${validItems.length} câu hỏi`);
    }
  }

  const bankData = {
    title: folderName,
    subject: subject.toUpperCase(),
    durationMinutes: 60,
    questions: questions
  };

  const val = validateBank(bankData);
  if (val && val.questions) {
    console.log(`✓ Thẩm định dữ liệu thành công (${questions.length} câu).`);
  }

  // Save examroom_bank.json
  const bankJsonPath = path.join(outDir, 'examroom_bank.json');
  fs.writeFileSync(bankJsonPath, JSON.stringify(bankData, null, 2), 'utf8');

  // Save markdown summary
  let md = `# Đáp án chi tiết: ${folderName}\n\n`;
  md += `**Môn học:** ${subject.toUpperCase()} | **Số câu hỏi:** ${questions.length} | **Thời gian:** 60 phút\n\n---\n\n`;
  for (const q of questions) {
    md += `### Câu ${q.id}\n\n`;
    md += `**Câu hỏi:**\n${q.text}\n\n`;
    md += `**Các phương án:**\n`;
    for (const [k, v] of Object.entries(q.options)) {
      const marker = k === q.answer ? ' **[ĐÁP ÁN ĐÚNG]**' : '';
      md += `- **${k}.** ${v}${marker}\n`;
    }
    md += `\n**Giải thích:**\n${q.explanation}\n\n---\n\n`;
  }
  fs.writeFileSync(path.join(outDir, 'dap_an_chi_tiet.md'), md, 'utf8');

  console.log(`✓ Đã tạo file: ${bankJsonPath}`);
}

async function main() {
  console.clear();
  console.log(`======================================================`);
  console.log(`   CÔNG CỤ CÀO ĐỀ THI TỰ ĐỘNG - EXAMROOM FPTU       `);
  console.log(`======================================================\n`);

  let cookie = '';
  if (fs.existsSync(COOKIE_FILE)) {
    cookie = fs.readFileSync(COOKIE_FILE, 'utf8').trim();
  }

  if (!cookie) {
    console.log('Chưa tìm thấy Cookie FUOverflow.');
    console.log('Cách lấy: Đăng nhập fuoverflow.com -> Nhấn F12 -> tab Application -> Cookies -> Copy giá trị các cookie.\n');
    cookie = await askQuestion('Vui lòng dán Cookie FUOverflow của bạn vào đây: ');
    if (!cookie) {
      console.error('Lỗi: Bạn chưa nhập Cookie.');
      process.exit(1);
    }
    fs.writeFileSync(COOKIE_FILE, cookie, 'utf8');
    console.log('✓ Đã lưu cookie vào file cookie.txt (sẽ tự động dùng cho các lần sau).\n');
  } else {
    console.log('✓ Đã nạp Cookie từ file cookie.txt.\n');
  }

  const headers = getHeaders(cookie);

  // 1. Check valid subjects
  let allSubjects = [];
  try {
    allSubjects = await getValidSubjects(headers);
    console.log(`✓ Đã tải danh sách ${allSubjects.length} môn học trên FUOverflow.\n`);
  } catch (err) {
    console.error('Lỗi kết nối tới FUOverflow:', err.message);
    console.error('Vui lòng kiểm tra lại kết nối mạng hoặc Cookie của bạn.');
    process.exit(1);
  }

  // 2. Ask for subject
  let subjectInput = '';
  let matchedForum = null;

  while (!matchedForum) {
    subjectInput = await askQuestion('Nhập mã môn học bạn muốn cào (ví dụ: csd201, swt301, mas291): ');
    if (!subjectInput) continue;

    matchedForum = allSubjects.find(s => s.toLowerCase() === subjectInput.toLowerCase());
    if (!matchedForum) {
      console.log(`✕ Không tìm thấy môn "${subjectInput}" trong danh mục FUOverflow.`);
      const suggestions = allSubjects.filter(s => s.toLowerCase().includes(subjectInput.toLowerCase())).slice(0, 5);
      if (suggestions.length > 0) {
        console.log(`  Gợi ý môn tương tự: ${suggestions.join(', ')}`);
      }
      console.log('Vui lòng nhập lại mã môn hợp lệ.\n');
    }
  }

  console.log(`✓ Tìm thấy môn học: ${matchedForum}`);

  // 3. Find threads
  console.log(`-> Đang tìm kiếm các đề thi FE (bộ lọc prefix_id=11)...`);
  const threads = await getExamThreads(matchedForum, headers);

  if (threads.length === 0) {
    console.log(`✕ Không tìm thấy đề thi FE nào cho môn ${matchedForum}.`);
    process.exit(0);
  }

  console.log(`\nTìm thấy ${threads.length} bộ đề thi FE cho môn ${matchedForum}:`);
  threads.forEach((t, i) => {
    console.log(`  [${i + 1}] ${t.title}`);
  });

  const countInput = await askQuestion(`\nBạn muốn cào bao nhiêu bộ đề gần nhất? (nhập số, hoặc gõ "all" để cào hết, mặc định: 5): `);
  let limit = 5;
  if (countInput.toLowerCase() === 'all') {
    limit = threads.length;
  } else if (!isNaN(parseInt(countInput))) {
    limit = Math.min(parseInt(countInput), threads.length);
  }

  const selectedThreads = threads.slice(0, limit);
  console.log(`\nSẽ tiến hành cào ${selectedThreads.length} bộ đề...`);

  const worker = await createWorker('eng');

  for (let i = 0; i < selectedThreads.length; i++) {
    console.log(`\n------------------------------------------------------`);
    console.log(`Tiến độ tổng: Bộ đề ${i + 1}/${selectedThreads.length}`);
    await scrapeThreadAndBuildBank(selectedThreads[i], matchedForum, headers, worker);
    await sleep(2000); // Friendly delay between threads
  }

  await worker.terminate();

  console.log(`\n======================================================`);
  console.log(`🎉 HOÀN TẤT TOÀN BỘ QUÁ TRÌNH CÀO VÀ ĐÓNG GÓI!`);
  console.log(`Thư mục chứa các bộ đề: ./output/${matchedForum.toUpperCase()}/`);
  console.log(`\nBƯỚC TIẾP THEO:`);
  console.log(`1. Mở web thi thử (chạy start.cmd trong examroom/ hoặc mở link GitHub Pages).`);
  console.log(`2. Chọn file "examroom_bank.json" trong thư mục vừa cào để làm bài thi!`);
  console.log(`======================================================\n`);
}

main().catch(err => {
  console.error('\n✕ Lỗi không mong muốn:', err);
  process.exit(1);
});
