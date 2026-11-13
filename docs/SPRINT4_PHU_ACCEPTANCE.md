# Sprint 4 — Phú: Task 4.1 và 4.3

Ngày kiểm tra: 2026-11-14.

## Phạm vi bàn giao

- Task 4.1: PATCH ticket bằng UUID/mã ticket; kiểm tra status/priority; transaction và khóa dòng; lịch sử thay đổi trạng thái lấy người thao tác từ JWT; đóng/mở lại ticket và hạ ưu tiên thủ công.
- Task 4.3: đăng nhập bcrypt/JWT, kiểm tra tài khoản hiện tại và trạng thái active, phân quyền theo role, giới hạn đăng nhập 10 lần/phút/IP.
- Tích hợp frontend phục vụ kiểm thử Auth: đăng nhập thật, lưu token, kiểm tra phiên qua `/auth/me`, xóa phiên bị từ chối và đăng xuất. Không bao gồm các chỉnh sửa giao diện/sắp xếp ticket khác trong working tree.

| API | Public | Admin | Manager | Agent |
| --- | --- | --- | --- | --- |
| POST auth/login | Có, giới hạn tần suất | Có | Có | Có |
| GET auth/me | 401 | Có | Có | Có |
| GET tickets, GET tickets/:id, PATCH tickets/:id | 401 | Có | Có | Có |
| GET ai/triage/status | 401 | Có | 403 | 403 |
| GET email/test-connection, POST email/sync | 401 | Có | 403 | 403 |
| POST tickets, Web Form | Có | Có | Có | Có |

## Kiểm chứng

- Live API: `node scripts/check-sprint4.mjs` trong backend — đạt 31 kiểm tra HTTP, thêm kiểm tra giới hạn tần suất trả 429; dữ liệu kiểm thử tạm đã được dọn.
- Frontend: `npm run test:auth` — đạt 6 nhóm kiểm tra: token/header, phản hồi đăng nhập, token lỗi/401, 403 giữ phiên, request cũ không xóa token mới, public portal và render login.
- Bước 49: logic token lỗi/xóa phiên/chuyển login đã được kiểm tra tự động. Chưa xác nhận thao tác F5 và đăng xuất trực tiếp trên trình duyệt: phiên điều khiển trình duyệt mất kết nối. Không coi test interceptor/SSR là kiểm thử trình duyệt đầy đủ.
- Bước 50: bản staging độc lập dùng để commit đã build backend/frontend thành công; backend đạt 16/16 test files và 144/144 unit tests; frontend đạt cả 6 nhóm kiểm tra Auth. `git diff --cached --check` không báo lỗi whitespace.

## Chạy lại

1. Cấu hình database local đã migrate và có các roles/channels; dùng `.env.example` để cấu hình môi trường riêng. `JWT_SECRET` phải là chuỗi hex ngẫu nhiên 64 ký tự. Không commit `.env` hay token.
2. Trong backend: `npm ci`, `npm run build`, `npm test`; chạy server bằng `npm run start:dev`.
3. Trong frontend: `npm ci`, `npm run build`, `npm run test:auth`.
4. Khi backend và database local đang chạy, chạy `node scripts/check-sprint4.mjs` từ backend. Script tạo tài khoản/ticket tạm bằng UUID rồi xóa đúng fixture đó; không gọi gửi email hay AI provider. Đợi ít nhất một phút giữa hai lần kiểm tra vì giới hạn đăng nhập theo IP.
5. Tài khoản demo được seed bằng `scripts/seed-auth-test.mjs` với biến `AUTH_TEST_PASSWORD` do người chạy cung cấp: `admin@example.com`, `manager@example.com`, `agent@example.com`. Không dùng mật khẩu mặc định trong mã nguồn.

## Giới hạn

- Agent hiện được đọc/cập nhật ticket theo quyền role, chưa giới hạn theo ticket được phân công.
- Logout xóa token tại trình duyệt; chưa có thu hồi JWT phía server. Token hết hạn theo cấu hình (mặc định 1 giờ); tài khoản bị khóa mất quyền ngay khi kiểm tra request tiếp theo.
- Rate limit dùng bộ nhớ một tiến trình, cần storage dùng chung khi chạy nhiều instance.
- Cấp tài khoản nhân viên qua quản trị/seed; không cung cấp đăng ký nhân viên công khai.
