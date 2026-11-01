# Thiết lập Telegram — Task 3.1 và 3.2

## Điều kiện

- Cài dependencies backend bằng `npm ci`.
- PostgreSQL và Redis đang chạy.
- Database đã có các bảng nền của dự án, gồm users, roles,
  channels, tickets, ticket_messages và các bảng liên quan.
- Migration Telegram hiện tại không khởi tạo toàn bộ database mới.

## Cấu hình môi trường

Nếu chưa có file môi trường, sao chép `.env.example` ở thư mục
gốc thành `backend/.env`, sau đó điền cấu hình local.
Không ghi đè `.env` đang sử dụng.

Bắt buộc:

```env
DB_SYNCHRONIZE=false
TELEGRAM_WEBHOOK_SECRET=
```

Tạo secret riêng bằng:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Điền kết quả vào TELEGRAM_WEBHOOK_SECRET trong `.env`.
Không commit `.env` hoặc secret thật.

Để nhận tin từ Telegram thật:
- Cấu hình TELEGRAM_BOT_TOKEN.
- Đăng ký webhook với URL HTTPS:
  https://<domain>/api/v1/telegram/webhook
- secret_token khi đăng ký phải khớp TELEGRAM_WEBHOOK_SECRET.
- Chỉ đặt TELEGRAM_WEBHOOK_URL trong `.env` không tự đăng ký webhook.

## Áp dụng migration

Dừng backend và sao lưu database trước khi chạy.

Migration này dành cho database nền chưa có:
- users.telegram_user_id
- users.telegram_contact_email
- bảng telegram_processed_updates

Nếu database đã có các thành phần trên do synchronize hoặc
bản Telegram cũ, cần đối chiếu schema trước; không xóa bảng
hoặc bật synchronize để vượt qua lỗi migration.

Từ thư mục backend:

```powershell
npm run build
npx typeorm migration:show -d dist/database/data-source.js
npx typeorm migration:run -d dist/database/data-source.js
npx typeorm migration:show -d dist/database/data-source.js
```

Migration AddTelegramIdentity1793462400000 phải hiển thị [X].
Migration này không hỗ trợ tự động revert; rollback cần kế hoạch
dữ liệu riêng và bản sao lưu.

## Khởi tạo vai trò customer

Chạy SQL sau trên đúng database của ứng dụng:

```sql
INSERT INTO public.roles (role_id, role_name)
VALUES (gen_random_uuid(), 'customer')
ON CONFLICT (role_name) DO NOTHING;
```

## Chạy ứng dụng

Từ thư mục backend:

```powershell
npm run start:dev
```

## Quy tắc nhận diện khách Telegram

- Dùng message.from.id làm telegram_user_id.
- Khách Telegram mới có email tài khoản là NULL.
- Email tự nhập được lưu ở telegram_contact_email, chưa xác minh.
- Không tự liên kết với tài khoản khác theo email tự nhập.
- Ghi nhận update và tạo ticket trong cùng transaction.
- update_id có ràng buộc unique để chống xử lý trùng.

## Định dạng tin nhắn hiện tại

```text
Email: customer@example.com
Nội dung: Tôi cần hỗ trợ về yêu cầu của mình.
```

Nội dung phải có ít nhất 10 ký tự.
Hiện /start và tin sai mẫu chưa có phản hồi hướng dẫn từ bot.

## Bằng chứng kiểm thử local

Đã kiểm thử thủ công bằng request webhook giả lập:
- Thiếu secret: 401.
- Secret đúng, thiếu update_id: 400.
- Tin hợp lệ: tạo ticket kênh telegram.
- Gửi lại cùng update: không tạo thêm ticket.
- Hai request cùng update gửi đồng thời: chỉ tạo một ticket.
- Nhập email của tài khoản khác: không gắn sai tài khoản,
  không ghi đè tên tài khoản đó.
- Gây lỗi khi lưu tin nhắn: rollback dữ liệu.
- Gỡ lỗi và gửi lại cùng update: tạo ticket thành công.

18 test tự động Email/AppController đã pass.
Các test này chưa bao phủ tự động chức năng Telegram.
Cần kiểm thử lại bằng Telegram thật trước khi nghiệm thu tích hợp.