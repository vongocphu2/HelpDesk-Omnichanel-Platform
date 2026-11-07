# Kết nối Gemini 3.5 Flash Lite cho Task 3.3 và 3.4

Thêm GEMINI_API_KEY thật trực tiếp vào backend/.env rồi lưu file.
Kiểm tra riêng Gemini trước khi đổi provider đang chạy.

~~~powershell
npm run build
# Biên dịch adapter Gemini và OpenAI.
npm run ai:check -- --provider gemini
# Gọi Gemini 3.5 Flash Lite một lần, đọc GEMINI_API_KEY, không tạo ticket.
~~~

Mong đợi ok=true, model=gemini-3.5-flash-lite, kết quả neutral và isUrgent=false.
Chỉ sau khi kết quả này đạt, đặt các dòng sau vào backend/.env và khởi động lại backend.

~~~dotenv
AI_TRIAGE_ENABLED=true
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=THAY_BANG_GEMINI_API_KEY_THAT
~~~

Giá trị mẫu của GEMINI_API_KEY cần được thay bằng key thật trên máy.
Mỗi provider dùng biến key riêng. HTTP 400/401/403/404 sẽ tạm dừng worker cho đến
khi sửa cấu hình và khởi động lại. HTTP 429/503 tuân theo thời gian chờ của Google.
Worker gửi cách nhau ít nhất 15 giây trong một tiến trình. Hạn mức ngày và tốc độ
được Google quyết định theo project/model. API status chỉ kiểm tra cấu hình cục bộ.
Sau khi khởi động lại, dùng phần migration và bộ 8 ca bên dưới để nghiệm thu.
Báo cáo cũ có thể kiểm tra tiếp với --resume, sau khi đưa các ticket failed về
pending bằng ai:retry. Bộ ca phải xác nhận nhãn cảm xúc, ưu tiên urgent, bộ lọc,
model đã lưu và ticket khẩn cấp đứng đầu hàng đợi. Kết quả provider probe chưa
đủ để kết luận hoàn tất hai task.

## 4. Chạy backend và kiểm tra cấu hình đã nạp

Giữ PostgreSQL đang dùng hoạt động. Đổi provider không cần xóa DB/volume hoặc chạy
lại migration đã `[X]`. Với máy mới, cần migration AddTicketTriage trên database dự
án có schema nền; migration AI không tự khởi tạo toàn bộ database trống.

Terminal A:

```powershell
npm run start:dev
# Giữ terminal này mở để backend chạy và hiển thị log.
```

Mong đợi: Nest khởi động và log `[AI TRIAGE READY] model=gemini-3.5-flash-lite; interval=5s; min_request_interval=15s`.

Mở Terminal B mới:

```powershell
Set-Location 'D:\HELPDESK\backend'
# Vào backend trong terminal thứ hai, giữ Terminal A hoạt động.

Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/health' | ConvertTo-Json -Depth 5
# Xác nhận database.status là connected.

Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/ai/triage/status' | Format-List
# Xác nhận enabled=True, ready=True, provider=gemini, model=gemini-3.5-flash-lite.
```

provider_retry_at và provider_blocked_code bình thường null/trống. ready chỉ kiểm
tra cấu hình local; ai:check ở bước 3 mới gọi API thật. Nếu model/provider còn cũ,
lưu `.env` rồi Ctrl+C/start:dev lại. Không cần frontend để kiểm thử 3.3/3.4 bằng API.

## 5. Chạy lại tám ticket lỗi cũ bằng Gemini

Dùng bộ ticket của báo cáo
`D:\HELPDESK\backend\artifacts\ai-triage\AI33-20261106084344380.json`.
Tiếp tục Terminal B, chỉ sau khi ai:check thành công:

```powershell
$aiTicketCodes = @('TK-8499', 'TK-7667', 'TK-1031', 'TK-6082', 'TK-4195', 'TK-6742', 'TK-5425', 'TK-6216')
# Tám ticket đã thất bại do Gemini; giữ nguyên yêu cầu khách và tiêu chí test.

foreach ($aiTicketCode in $aiTicketCodes) {
    npm run ai:retry -- --ticket $aiTicketCode
    # Đưa ticket failed còn mở về pending để backend phân tích bằng Gemini.
    if ($LASTEXITCODE -ne 0) { throw 'Retry lỗi; kiểm tra build/database trước khi tiếp tục.' }
    # Dừng vòng lặp nếu công cụ gặp lỗi.
}

npm run ai:smoke -- --resume './artifacts/ai-triage/AI33-20261106084344380.json'
# Chờ, đọc lại tám ticket qua API và ghi báo cáo mới; không sửa báo cáo cũ.
```

Mong đợi: retry trả pending; Terminal A lần lượt có AI TRIAGE COMPLETED.
Retry không sửa ticket completed, pending/processing, skipped hoặc resolved/closed.
Resume không tự retry. Nếu bộ cũ đã completed với model khác, nó không được tính
là bằng chứng Gemini; trong trường hợp đó cần bộ test mới.

Nếu máy/database khác không có tám ticket/báo cáo cũ, bỏ các lệnh ở bước 5 trên và
chỉ chạy một lần:

```powershell
npm run ai:smoke
# Tạo một bộ tám ticket tổng hợp mới và kiểm tra Gemini từ đầu.
```

Chỉ chọn một cách. Script chờ tối đa 20 phút, in tiến độ mỗi 5 giây. Khi provider bị
chặn hoặc yêu cầu chờ quá thời hạn, script lưu lỗi rồi kết thúc. Không gửi email
hay Telegram từ công cụ này. Chạy mặc định lần nữa sẽ tạo thêm tám ticket.

## 6. Kết quả mong đợi

| Case | Cảm xúc | Nâng urgent? |
|---|---|---|
| URGENT | frustrated | Có |
| NORMAL | neutral | Không |
| NEGATED | neutral | Không |
| FRUSTRATED_NOT_URGENT | frustrated | Không |
| POSITIVE | positive | Không |
| POLITE_URGENT | neutral | Có |
| HISTORICAL | neutral | Không; giữ priority=high |
| INJECTION | neutral | Không |

Cả tám dòng phải có Status=completed, Passed=true, model đúng cấu hình Gemini.
Bảng tổng hợp:

```text
AllTicketsCreated       true
AllAiCompleted          true
AllCasesMatched         true
UrgentTicketsFirst      true
UrgentFilterCorrect     true
SentimentFilterCorrect  true
ModelRecorded          true
```

Đây là kỳ vọng, không phải xác nhận test thật đã qua. Nếu AI phân loại sai, giữ
bằng chứng và expected để kiểm tra prompt/nội dung. Không sửa expected cho xanh test.
Confidence là tự đánh giá của model; tám ca smoke không chứng minh độ chính xác
tổng quát. Đoan tiếp tục kiểm định trên tập dữ liệu rộng hơn ở Task 3.8.

## 7. Giữ bằng chứng

```powershell
$aiReport = Get-ChildItem -LiteralPath 'D:\HELPDESK\backend\artifacts\ai-triage' -Filter '*.json' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
# Lấy báo cáo mới nhất do smoke test vừa ghi.

Get-Content -LiteralPath $aiReport.FullName -Raw -Encoding UTF8
# Xem mã ticket, nhãn, ưu tiên, model và các kiểm tra; không chứa API key.
```

Gửi bảng tám ca, bảy kiểm tra và báo cáo mới để xác thực. Dữ liệu AI được lưu trong
PostgreSQL, trả qua API danh sách/chi tiết và UI của Phúc khi đã tích hợp.

## 8. Xử lý lỗi

| Mã/hiện tượng | Xử lý |
|---|---|
| ready=false / AI_NOT_CONFIGURED | Lưu `.env`, kiểm tra OPENAI_API_KEY/provider/model, restart |
| AI_HTTP_401 / AI_HTTP_403 | Kiểm tra key, project, quyền Gemini API và quyền model |
| AI_HTTP_404 | Kiểm tra model ID và quyền dùng model của project |
| AI_HTTP_400 | Request/model bị từ chối; kiểm tra adapter/cấu hình trước |
| AI_INSUFFICIENT_QUOTA / AI_CREDIT_BALANCE_EXHAUSTED | Kiểm tra credit trong Billing; tạo key mới không cấp credit |
| AI_PROJECT_SPEND_LIMIT_EXCEEDED / AI_ORGANIZATION_SPEND_LIMIT_EXCEEDED | Kiểm tra giới hạn chi tiêu project/organization |
| AI_ORGANIZATION_USAGE_LIMIT_EXCEEDED / AI_BILLING_HARD_LIMIT_REACHED | Kiểm tra giới hạn tài khoản trong API Platform |
| AI_HTTP_429 | Giới hạn tốc độ tạm thời; chờ provider_retry_at và giảm lưu lượng |
| AI_HTTP_503 / AI_HTTP_500 / AI_TIMEOUT | Lỗi tạm thời; thử tối đa ba lần có thời gian nghỉ |
| AI_PROVIDER_COOLDOWN | Chưa đến thời điểm được thử tiếp |
| AI_REFUSED | Model từ chối; giữ ticket cho người xử lý, không gán nhãn giả |
| AI_INVALID_RESULT / AI_INCOMPLETE_OR_BLOCKED | Kết quả sai schema/bị cắt; kiểm tra báo cáo |
| AI_INPUT_INVALID_OR_TOO_LONG | Nội dung rỗng hoặc tiêu đề+nội dung vượt 20.000 ký tự |
| AI TRIAGE STORAGE_ERROR | Kiểm tra DB và migration AddTicketTriage đã chạy |

Lỗi key/quyền/model/billing làm provider_blocked_code có giá trị: worker dừng lấy
ticket khác trong tiến trình này. Sau khi sửa nguyên nhân, restart backend,
ai:check một lần và retry ticket failed cần thiết. Pending vẫn được giữ.
Đổi key không chữa được thiếu credit hoặc model quá tải. Không chạy bộ smoke liên
tục khi một lần kiểm tra còn lỗi. Xem [mã lỗi](https://ai.google.dev/gemini-api/docs/api-errors)
và [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

## 9. Luồng xử lý và giới hạn hiện tại

- Gemini GenerateContent API với responseJsonSchema. Backend kiểm tra sáu trường
  kết quả trước khi lưu; không dùng kết quả giả khi AI lỗi.
- Chỉ gửi subject và tin nhắn khách đầu tiên, không gửi toàn bộ hồ sơ/tệp đính kèm.
  Nội dung do khách nhập vẫn có thể chứa thông tin cá nhân.
- PostgreSQL polling mỗi 5 giây, tối đa một công việc; gọi cách nhau ít nhất 15 giây.
  Đây là nhịp thử nghiệm local, không bảo đảm phù hợp mọi tier Gemini.
- Không giữ transaction tạo ticket khi gọi AI. Mọi kênh dùng chung luồng phân tích.
- Nâng urgent khi isUrgent=true và urgencyScore>=0.8. Không tự nâng vì bực bội, không
  hạ priority hiện có và không nâng ticket resolved/closed.
- Lỗi tạm thời tối đa ba lần, chờ tối thiểu 30/60 giây. HTTP 429/5xx nghỉ ít nhất
  60 giây, theo Retry-After/reset dài hơn. Thời gian nghỉ không bảo đảm API phục hồi.
- Retry/claim của ticket lưu trong DB; cooldown/pacing/trạng thái chặn chung ở RAM.
  Test với một backend; nhiều instance cần limiter dùng chung.
- Timeout API 60 giây, claim 90 giây; có phục hồi khi tiến trình dừng giữa chừng.
  Ticket trước migration là skipped, không tự gửi lịch sử. BullMQ thuộc Sprint 6.

## 10. Telegram và bàn giao Phúc

Sau khi tám ca đạt, giữ backend/tunnel/webhook thật ở 3.1–3.2 hoạt động và tự gửi
một tin mới tới bot:

```text
Email: sprint3-ai@example.com
Nội dung: AI33-GEMINI-TELE-01 Tôi rất bực bội! Toàn bộ hệ thống thanh toán đang ngừng hoạt động, khách không thể mua hàng. Tôi cần hỗ trợ ngay trong 10 phút, hiện chưa có cách khắc phục.
```

```powershell
$aiTelegram = Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/tickets?channel_type=telegram&search=AI33-GEMINI-TELE-01&limit=100'
# Tìm ticket Telegram sau khi backend có log AI TRIAGE COMPLETED.

$aiTelegram.data | Select-Object ticket_code, ai_status, ai_model, sentiment_label, urgency_score, priority, is_urgent_bumped
# Mong đợi completed, gemini-3.5-flash-lite, frustrated, urgent và True.
```

Nếu chưa có ticket, kiểm tra webhook; nếu có nhưng AI chưa xong, xem ai_error.
Không yêu cầu bot trả lời xác nhận trong 3.3/3.4. Gmail thật làm sau.

Phúc tiếp tục dùng GET /api/v1/tickets và GET /api/v1/tickets/:id, các trường:
sentiment_label, sentiment_score, urgency_score, priority, is_urgent_bumped, ai_status,
ai_reason, ai_detected_keywords, ai_model, ai_analyzed_at. Numeric có thể là chuỗi;
FE dùng Number(...) khi hiển thị. Không gán neutral khi AI chưa completed.
Bộ lọc sentiment_label, is_urgent_bumped, priority giữ nguyên. Sắp xếp bumped DESC,
created_at DESC, ticket_id ASC. Đổi provider không đổi hợp đồng API frontend.

## 11. Kiểm tra code trước commit

```powershell
Set-Location 'D:\HELPDESK\backend'
# Vào backend để kiểm thử code.

npm test
# Chạy test dùng mock và HTTP local, không dùng credit Gemini.

npm run build
# Kiểm tra biên dịch.

Set-Location 'D:\HELPDESK'
# Trở về repository.

git diff --check
# Kiểm tra whitespace của các thay đổi tracked.

git status --short
# Chỉ chọn file Task 3.3/3.4; giữ .env và tài liệu cá nhân ngoài commit.
```

Chỉ nghiệm thu AI thật khi báo cáo thật đạt; unit test mock xanh chưa đủ.
