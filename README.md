# Examroom FPTU 🎓
> Nền tảng thi thử trắc nghiệm cá nhân & Công cụ tự động cào đề FUOverflow dành cho sinh viên FPTU.

Dự án này sinh ra nhằm giải quyết vấn đề: Thay vì chỉ nhìn đề bài và đáp án thụ động trên FUOverflow, **Examroom** mang đến trải nghiệm **mô phỏng phòng thi thật** (đồng hồ đếm ngược, giao diện chọn phương án A–B–C–D, đánh dấu câu phân vân, tự nộp bài và chấm điểm thang 10).

Toàn bộ dữ liệu bài làm và điểm số được lưu an toàn tại **trình duyệt của chính bạn (IndexedDB)**.

---

## 🧭 CÁC QUY TRÌNH SỬ DỤNG

Dự án được phân chia thành **3 quy trình rõ ràng**, giúp bạn tiếp cận nhanh chóng mà không bị ngợp:

1. **[Quy trình 1: Trải nghiệm & Sử dụng ứng dụng luyện thi](#-quy-trình-1-trải-nghiệm--sử-dụng-ứng-dụng-thi-thử)** (Chạy trực tiếp trên Web hoặc chạy Local).
2. **[Quy trình 2: Tự cào thêm bộ đề mới cho môn học của bạn](#-quy-trình-2-tự-cào-thêm-bộ-đề-cho-môn-học-của-bạn)** (Dành cho ai muốn ôn môn khác: CSD201, MAS291, PRN211...).
3. **[Quy trình 3: Tự thêm ghi chú & lời giải chi tiết](#-quy-trình-3-tự-thêm-ghi-chú--lời-giải-chi-tiết-tùy-chọn)** (Tùy chọn học sâu).

---

## 🚀 QUY TRÌNH 1: TRẢI NGHIỆM & SỬ DỤNG ỨNG DỤNG THI THỬ

Bạn có **2 lựa chọn** để mở ứng dụng thi thử:

### Lựa chọn 1: Chạy trực tiếp Online (Không cần cài đặt gì)
> Thích hợp để học ngay trên điện thoại, iPad, máy tính mà không cần tải code hay cài đặt Node.js.

1. Truy cập vào đường link GitHub Pages của dự án:
   👉 **`https://tuw025.github.io/examroom-fptu/examroom/web/`**
2. Tại giao diện chính, bấm nút **"Tải lên bộ đề"**.
3. Chọn 1 trong các bộ đề mẫu có sẵn trong thư mục [`sample_banks/`](./sample_banks/):
   - `sample_banks/SWT301_FA25_RE/examroom_bank.json` (Môn Kiểm thử phần mềm)
   - `sample_banks/SSG104_SP25_FE/examroom_bank.json` (Môn Kỹ năng mềm)
4. Bấm bắt đầu và trải nghiệm làm bài như trong phòng thi thật!

---

### Lựa chọn 2: Chạy Offline trên máy tính cá nhân (Clone code về máy)
> Thích hợp khi bạn không có kết nối Internet hoặc muốn sử dụng hoàn toàn cục bộ trên máy.

1. Tải hoặc Clone repository này về máy:
   ```bash
   git clone https://github.com/Tuw025/examroom-fptu.git
   cd examroom-fptu
   ```
2. Nhấp đúp vào file **`start.cmd`** trong thư mục `examroom/` (hoặc mở terminal chạy `node examroom/server.mjs`).
3. Mở trình duyệt tại địa chỉ: **`http://localhost:8765`**.
4. Nạp bộ đề từ thư mục `sample_banks/` hoặc bộ đề bạn vừa cào được để làm bài.

---

## 📥 QUY TRÌNH 2: TỰ CÀO THÊM BỘ ĐỀ CHO MÔN HỌC CỦA BẠN

Khi bạn cần ôn thi các môn học khác (`CSD201`, `MAS291`, `PRN211`, `SWT301`...), bạn chỉ cần chạy công cụ cào tự động:

### Bước 1: Lấy Cookie tài khoản FUOverflow của bạn
Do FUOverflow yêu cầu đăng nhập để xem đề thi, bạn cần lấy Cookie tài khoản cá nhân:
1. Mở trình duyệt và đăng nhập vào [fuoverflow.com](https://fuoverflow.com/).
2. Nhấn phím **F12** (hoặc click chuột phải chọn *Kiểm tra / Inspect*).
3. Chuyển sang tab **Application** (trên Chrome/Edge) hoặc **Storage** (trên Firefox) -> Chọn mục **Cookies** -> `https://fuoverflow.com`.
4. Tìm và copy giá trị cookie (hoặc copy toàn bộ chuỗi header `Cookie` trong tab *Network*).

---

### Bước 2: Chạy công cụ cào tự động
1. Cài đặt thư viện phụ trợ (chỉ cần chạy 1 lần duy nhất):
   ```bash
   npm install
   ```
2. Nhấp đúp vào file **`start_crawler.cmd`** (hoặc gõ lệnh `npm run crawl`).
3. **Nhập Cookie**: Dán cookie đã lấy ở Bước 1 (Tool sẽ tự lưu vào file `cookie.txt` để các lần sau bạn không cần nhập lại).
4. **Nhập mã môn học**: Gõ mã môn bạn muốn cào (ví dụ: `csd201`, `mas291`, `swt301`...).

---

### Bước 3: Nhận kết quả tự động 100%
Tool sẽ tự động:
- Kiểm tra mã môn tại danh mục chính thức của FUOverflow.
- Lọc toàn bộ đề thi FE (`prefix_id=11`).
- Tự tải ảnh câu hỏi, tự phân tích đáp án có tỷ lệ bình chọn cao nhất từ cộng đồng.
- Tự động chạy OCR bóc tách nội dung câu hỏi và các phương án A, B, C, D.
- Đóng gói hoàn chỉnh thành file **`examroom_bank.json`** tại thư mục `./output/<MÃ_MÔN>/<TÊN_ĐỀ>/`.

👉 Bây giờ, bạn chỉ việc quay lại **Quy trình 1**, bấm "Tải lên" file `examroom_bank.json` vừa tạo và bắt đầu luyện thi!

---

## 📝 QUY TRÌNH 3: TỰ THÊM GHI CHÚ & LỜI GIẢI CHI TIẾT (TÙY CHỌN)

### Tại sao công cụ không dùng AI để tự chế lời giải?
Đề thi trắc nghiệm FPTU thường có những câu hỏi mang tính đặc thù theo giáo trình riêng hoặc bẫy từ ngữ. Việc dùng AI tự sinh giải thích có thể dẫn đến **ảo giác thông tin (AI Hallucination)**, đưa ra giải thích sai khiến người học học vẹt và bị mất điểm oan. 

Vì vậy, phần giải thích được thiết kế dưới dạng **Tùy chọn cá nhân (Optional)** để mỗi người tự ghi chú kiến thức chuẩn xác của riêng mình.

### Cách thêm ghi chú vào bộ đề:
1. Mở file `examroom_bank.json` của đề thi bằng **Notepad**, **VS Code** hoặc trình soạn thảo văn bản bất kỳ.
2. Tìm đến trường `"explanation"` trong câu hỏi bạn muốn ghi chú:
   ```json
   {
     "id": "1",
     "text": "When to stop testing?",
     "options": {
       "A": "Stop when scheduled time for testing expires",
       "B": "Stop if 75% of errors are detected",
       "C": "Stop when all test cases execute",
       "D": "None of the others"
     },
     "answer": "A",
     "explanation": "Điền ghi chú của bạn vào đây: Xem Slide chương 1 trang 15 - Exit criteria dừng khi hết thời gian dự kiến."
   }
   ```
3. Lưu file lại (`Ctrl + S`). Khi thi thử trên web và xem lại kết quả, lời giải này sẽ hiển thị ngay bên dưới câu hỏi.

---

## 📂 CẤU TRÚC THƯ MỤC REPOSITORY

```text
├── examroom/                 # Ứng dụng Web thi thử (HTML / CSS / Vanilla JS)
│   ├── web/                  # Giao diện chính, CSS, file JS xử lý IndexedDB
│   ├── server.mjs            # Server local siêu nhẹ chạy bằng Node.js có sẵn
│   └── start.cmd             # Nhấp đúp để mở web thi thử local
├── sample_banks/             # Các bộ đề mẫu sẵn sàng tải lên trải nghiệm ngay
│   ├── SWT301_FA25_RE/       # Đề mẫu môn Kiểm thử phần mềm (SWT301)
│   └── SSG104_SP25_FE/       # Đề mẫu môn Kỹ năng mềm (SSG104)
├── crawler.mjs               # Công cụ CLI cào đề thông minh tự động 100%
├── start_crawler.cmd         # Nhấp đúp để chạy công cụ cào trên Windows
├── package.json              # Khai báo dependency (tesseract.js cho OCR)
├── cookie.example.txt        # File mẫu định dạng cookie
├── .gitignore                # Bỏ qua node_modules, cookie cá nhân, file rác
└── README.md                 # Tài liệu hướng dẫn sử dụng
```

---

## 🔒 BẢO MẬT & BẢN QUYỀN

- **Bảo mật Cookie cá nhân**: File `cookie.txt` đã được cấu hình trong `.gitignore`, tuyệt đối không bao giờ bị đẩy lên GitHub khi bạn chia sẻ dự án.
- **Dữ liệu riêng tư**: Mọi tiến trình làm bài, kết quả thi và bộ đề được lưu trữ hoàn toàn trên trình duyệt cá nhân của bạn, không gửi về bất kỳ máy chủ nào.
- **Mục đích giáo dục**: Dự án được xây dựng phi lợi nhuận với mục đích hỗ trợ sinh viên FPTU nâng cao tinh thần tự học và rèn luyện kỹ năng phòng thi.

Chúc các bạn ôn tập thật tốt và đạt điểm cao trong kỳ thi FE! 🚀

