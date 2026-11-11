# Examroom local

Web luyện trắc nghiệm dùng lại cho nhiều môn, chạy bằng Node.js có sẵn, không cần cài package hoặc tài khoản. Có server Python thay thế nếu máy đã cài Python thực sự.

## Chạy

Nhấp đúp `start.cmd` trong thư mục này, hoặc chạy trong PowerShell:

```powershell
cd D:\Ki5\SSG\examroom
node server.mjs
```

Mở http://127.0.0.1:8765. Giữ cửa sổ chạy server mở trong lúc sử dụng. Dừng bằng Ctrl+C. Nếu cổng mặc định bận, đóng server cũ hoặc đặt biến `EXAMROOM_PORT` trước khi chạy. Mỗi địa chỉ/cổng là một vùng lưu dữ liệu trình duyệt khác nhau.

Nếu đã cài Python, cũng có thể chạy `python run.py` hoặc `python run.py --port 8766`. Trên máy hiện tại, `python.exe` và `py.exe` đang trỏ tới Windows App Execution Alias chưa chạy được, nên Node.js là cách chạy đã kiểm tra.

Server chỉ lắng nghe trên máy hiện tại, không chia sẻ lên Internet. Các route được giới hạn vào file giao diện, bộ đề mẫu và ảnh FE; không mở toàn bộ thư mục tài liệu để tải qua HTTP. Không có thư viện, font, dịch vụ hay CDN bên ngoài.

## Hiện có

- Bộ FE SSG105 30 câu có sẵn: câu hỏi, toàn bộ tình huống và các lựa chọn chép nguyên văn từ ảnh gốc; đáp án tham khảo và giải thích lưu riêng. Câu 22 giữ nguyên cách diễn đạt của đề và có ghi chú sau khi chấm.
- Bộ RETAKE `SSG105_SU26_RE_578312` gồm 30 câu nguyên văn, dùng đúng bảng đáp án người dùng cung cấp. Giải thích ngắn lưu riêng. Ảnh gốc lấy từ `../retake`; ghép theo số Question trên ảnh, có kiểm tra các cặp file đảo thứ tự 8–9 và 13–14.
- Nhập JSON với nội dung câu hỏi, lựa chọn A–F, một đáp án đúng, giải thích tùy chọn và ảnh base64 tùy chọn.
- Nhập nhiều ảnh + bảng đáp án TXT/JSON hoặc dán văn bản. Một ảnh cho mỗi câu, chứa cả các lựa chọn. Xác định số câu của từng file trong bảng nhập, không tự đoán từ tên file Facebook. Có thể chỉnh số phương án riêng từng ảnh.
- Kiểm tra dữ liệu và xem thông tin bộ đề trước khi lưu. Tối đa 500 câu; JSON tối đa 45 MB; ảnh tối đa 8 MB/ảnh, tổng 32 MB.
- Thi thử: đếm giờ, tự nộp khi hết giờ, giấu lời giải đến khi nộp; đánh dấu câu, điều hướng, lưu và tiếp tục sau khi tải lại trang.
- Luyện tập: không giới hạn thời gian, xem giải thích sau khi chọn; mỗi câu khóa lựa chọn sau khi đã lộ đáp án.
- Mặc định giữ thứ tự câu gốc. Có thể chọn số câu, chủ động bật đảo thứ tự câu và ưu tiên ảnh gốc; phím A–F chọn đáp án, ← → chuyển câu. Đảo câu không thay đổi nội dung hay các phương án.
- Điểm thang 10, bản đồ kết quả, lọc câu chưa đúng hoặc đánh dấu, luyện lại câu sai/bỏ trống, lịch sử tối đa 30 lượt, xuất kết quả JSON.
- Bộ đề, ảnh, bài đang làm và lịch sử lưu tại IndexedDB của trình duyệt. Xuất JSON kèm ảnh để sao lưu hoặc chuyển máy.

## JSON mẫu

Trong giao diện chọn “Tải bộ đề mẫu”. `options` nhận object A–F hoặc mảng 2–6 phần tử; `answer` là một chữ cái. `id` duy nhất trong bộ đề. `durationMinutes` từ 1 đến 600.

```json
{
  "title": "Bộ đề của tôi",
  "subject": "SSG105",
  "durationMinutes": 30,
  "questions": [
    {
      "id": "1",
      "text": "Nội dung câu hỏi",
      "options": {"A": "Lựa chọn thứ nhất", "B": "Lựa chọn thứ hai"},
      "answer": "A",
      "explanation": "Giải thích ngắn."
    }
  ]
}
```

Ảnh nhập qua JSON phải dùng `data:image/jpeg;base64,...` (hoặc PNG/WebP). Chức năng xuất bộ đề tự nhúng cả ảnh có sẵn thành dạng này. Không tải ảnh từ URL bên ngoài.

Với bảng đáp án ảnh, dùng `1. A` mỗi dòng một câu, hoặc:

```json
{"answers":{"1":{"answer":"A","explanation":"Vì ..."},"2":"C"}}
```

Nhập đúng một danh sách đáp án; không dán cả tài liệu có nhiều bảng đáp án lặp lại. Mọi câu phải có đáp án khớp số phương án đã chọn.

## Phạm vi bản đầu

Chưa có OCR, đọc PDF/Word/slide, hoặc tự trả lời bằng AI. Giải thích hiển thị là nội dung có trong bộ đề đã nhập. Đây là nền tảng để sau này bổ sung luồng tải tài liệu + câu hỏi, tạo đáp án nháp có trích dẫn, kiểm tra lại rồi đưa vào thư viện. Chưa tích hợp API hay gửi tài liệu đi đâu.

Đáp án ở ứng dụng local không nhằm chống gian lận: người có quyền mở công cụ phát triển vẫn có thể đọc dữ liệu. Chế độ thi thử phục vụ tự luyện tập.

## Cấu trúc

- `server.mjs`: server local Node.js, không cần package.
- `start.cmd`: mở server bằng cách nhấp đúp.
- `run.py`: server thay thế dùng Python tiêu chuẩn.
- `data/fe-original.json`: bản chép nguyên văn 30 câu từ ảnh gốc, là nguồn duy nhất cho câu hỏi và lựa chọn; không diễn đạt lại, không tự sửa ngữ pháp.
- `prepare-demo.mjs`: chạy `node prepare-demo.mjs` để tạo lại `web/demo.json` từ nguồn nguyên văn và bảng đáp án. Bản Python tương đương là `prepare_demo.py`. Cần thư mục `../FE` và `../SSG105_FE_225597_Dap_an.md`.
- `web/index.html`, `style.css`, `app.js`: giao diện không cần build.
- `web/core.mjs`: kiểm tra bộ đề, đọc bảng đáp án, chấm điểm và đảo câu; tách riêng khỏi phần giao diện.
- `tests/core.test.mjs`: kiểm tra các quy tắc nhập dữ liệu/chấm điểm bằng `node --test tests/core.test.mjs`.
- `data/retake-original.json`: bản chép nguyên văn RETAKE và bảng đáp án người dùng. Chạy `node prepare-retake.mjs` để tạo lại `web/retake.json`.
- Kiểm tra toàn bộ: `node --test tests/core.test.mjs tests/retake.test.mjs`.

## Cập nhật nội dung đề có sẵn

Mỗi lần tải trang, ứng dụng kiểm tra phiên bản nội dung `/demo.json`. Bản sửa nguyên văn có `contentRevision: 2`. Thư viện, bài đang làm và bản đề dùng để xem lại lịch sử của bộ có ID `demo-fe` sẽ nhận nội dung đã sửa, giữ số câu, lựa chọn, đánh dấu, đồng hồ và điểm đã chấm. Lượt làm trước bản sửa được gắn ghi chú. Dữ liệu trước lần chuyển đổi đầu tiên được lưu dự phòng trong IndexedDB, khóa `fe-content-backup-v1`.

Các bộ đề người dùng nhập riêng không bị ghi đè; bộ đề đã xóa cũng không tự xuất hiện lại. Không cần xóa bộ nhớ trình duyệt để nhận bản sửa. Bộ đã xuất hoặc sao chép từ bản cũ cần được thay bằng bản xuất mới nếu nó đã mất ID bộ đề gốc.

RETAKE tự thêm một lần khi tải trang sau bản cập nhật, ở cạnh FE và các bộ người dùng đã nhập. Mốc cài đặt lưu tại `bundled-installed-retake-578312`; nếu sau đó bạn chủ động xóa RETAKE, lần tải trang tiếp theo sẽ không tự thêm lại. Ảnh RETAKE được nhúng vào JSON khi dùng chức năng xuất bộ đề, giống FE.
