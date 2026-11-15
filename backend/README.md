# HelpDesk+ — Backend NestJS Core Service
> **Dự án**: Nền tảng Hỗ trợ Khách hàng Đa kênh Tích hợp Trí tuệ Nhân tạo (HelpDesk+) — C1SE.92 (DTU)  
> **Lead Developer (Backend & AI) & Scrum Master**: **Võ Ngọc Phú**  
> **Phát triển hạ tầng & Kênh**: **Võ Thị Thu Lộc**  
> **Swagger API Docs (Local)**: `http://localhost:3000/api/docs`

---

## 🚀 1. Hướng Dẫn Chạy Môi Trường Backend

```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi động môi trường phát triển (Watch Mode)
npm run start:dev

# 3. Biên dịch bản dựng sản phẩm
npm run build
```

---

## 📌 2. ĐẶC TẢ API QUẢN LÝ VÉ HỖ TRỢ (TICKETS MODULE)

### 🎫 TASK 2.1 — API Tạo vé từ Web Form (`POST /api/v1/tickets`)
- **Mục đích**: Tiếp nhận khiếu nại/yêu cầu từ khách hàng qua Web Portal.
- **Phương thức**: `POST`
- **URL**: `http://localhost:3000/api/v1/tickets`
- **Request Body mẫu (JSON)**:
  ```json
  {
    "customer_name": "Alex Morgan",
    "customer_email": "alex.morgan@techcorp.io",
    "customer_phone": "+84 905 123 456",
    "subject": "Lỗi thanh toán đơn hàng #INV-992 qua cổng trực tuyến",
    "description": "Tôi đã thực hiện thanh toán qua VNPay thành công và trừ tiền trong tài khoản nhưng hệ thống vẫn báo chưa kích hoạt. Yêu cầu kiểm tra gấp!",
    "channel_type": "web",
    "priority": "medium",
    "attachment_url": "https://storage.helpdesk.vn/bill_992.png"
  }
  ```
- **Xử lý ngầm**:
  - Tự động tìm hoặc tạo User mới (`role: customer`).
  - Gán kênh `web`.
  - Sinh mã vé duy nhất `TK-xxxx` (ví dụ: `TK-1082`).
  - Lưu tin nhắn đầu tiên vào `TicketMessage`.
  - Ghi vết trạng thái ban đầu (`new`) vào `TicketStatusHistory`.

---

### 📋 TASK 2.2 — API Danh Sách Vé Hỗ Trợ Đa Kênh (`GET /api/v1/tickets`)
- **Mục đích**: Cung cấp hàng đợi vé hỗ trợ cho nhân viên CSKH và quản lý.
- **Phương thức**: `GET`
- **URL**: `http://localhost:3000/api/v1/tickets`
- **Query Parameters**:
  - `page` (number, default: 1): Trang hiện tại.
  - `limit` (number, default: 10): Số vé trên mỗi trang.
  - `search` (string): Tìm kiếm theo mã vé (`TK-xxxx`), tiêu đề hoặc tên khách hàng.
  - `status` (string): `new`, `open`, `pending`, `resolved`, `closed`.
  - `priority` (string): `low`, `medium`, `high`, `urgent`.
  - `channel_type` (string): `web`, `email`, `telegram`.
  - `sentiment_label` (string): `angry`, `neutral`, `positive`.
  - `is_urgent_bumped` (boolean): `true` / `false`.

- **⚡ Thuật toán sắp xếp ưu tiên AI (Priority Bump)**:
  ```sql
  ORDER BY ticket.is_urgent_bumped DESC, ticket.created_at DESC
  ```
  *Vé khẩn cấp do AI phát hiện tự động nổi lên đầu hàng đợi để Agent xử lý ngay.*

- **Response JSON mẫu (HTTP 200)**:
  ```json
  {
    "statusCode": 200,
    "message": "Lấy danh sách vé hỗ trợ thành công",
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "data": [
      {
        "ticket_id": "c1f7b884-3c6f-4cfa-8128-4ad01e9d1082",
        "ticket_code": "TK-1082",
        "subject": "Lỗi thanh toán đơn hàng #INV-992 qua cổng trực tuyến",
        "status": "new",
        "priority": "urgent",
        "is_urgent_bumped": true,
        "sentiment_label": "angry",
        "created_at": "2026-10-27T10:30:00.000Z",
        "customer": {
          "user_id": "8a7c6f10-1b2c-4d3e-9f0a-112233445566",
          "full_name": "Alex Morgan",
          "email": "alex.morgan@techcorp.io"
        },
        "channel": {
          "channel_name": "Web Form",
          "channel_type": "web"
        },
        "assigned_agent": null
      }
    ]
  }
  ```

---

### 🔍 TASK 2.2 — API Xem Chi Tiết Vé Hỗ Trợ (`GET /api/v1/tickets/:id`)
- **Mục đích**: Mở màn hình hội thoại chi tiết khi nhân viên click vào vé.
- **Phương thức**: `GET`
- **URL**: `http://localhost:3000/api/v1/tickets/:id` (chấp nhận cả UUID hoặc mã vé ví dụ: `/api/v1/tickets/TK-1082`).
- **Dữ liệu trả về**: Đầy đủ toàn bộ thông tin quan hệ bảng:
  - `customer`: Thông tin khách hàng.
  - `assigned_agent`: Nhân viên được giao xử lý.
  - `team`: Nhóm phụ trách.
  - `channel`: Kênh tiếp nhận.
  - `sla`: Chính sách cam kết thời gian xử lý.
  - `messages`: Toàn bộ tin nhắn trao đổi đa kênh (kèm thông tin sender).
  - `status_history`: Toàn bộ lịch sử thay đổi trạng thái (kèm người đổi).

---

## 🤝 3. HƯỚNG DẪN KẾT NỐI CHO CÁC THÀNH VIÊN TRONG TEAM

### Dành cho Võ Hồng Phúc (Frontend Lead — Task 2.6 & Task 3.6):
Sử dụng trực tiếp Service do Phú đã viết tại `frontend/src/services/ticket.service.js`:
```javascript
import ticketService from './services/ticket.service.js';

// Gọi API danh sách vé (Task 2.6):
const response = await ticketService.getTickets({ page: 1, limit: 10, search: 'Alex' });

// Gọi API xem chi tiết vé (Task 3.6):
const ticketDetail = await ticketService.getTicketById('TK-1082');
```

### Dành cho Trương Đình Thảo Đoan (QA / Tester — Task 2.7):
Kịch bản kiểm thử API cần chạy thử:
1. `GET /api/v1/tickets?page=1&limit=5`: Xác minh phân trang đúng `limit`, tổng trang `totalPages`.
2. `GET /api/v1/tickets?search=TK-1082`: Xác minh tìm kiếm trả đúng mã vé.
3. `GET /api/v1/tickets/TK-1082`: Xác minh trả về đầy đủ mảng `messages` và `status_history`.
4. `GET /api/v1/tickets/TK-INVALID`: Xác minh trả về HTTP 404 NotFound.
5. Kiểm tra vé `is_urgent_bumped: true` luôn đứng vị trí đầu tiên trong danh sách.

### Dành cho Võ Thị Thu Lộc (Backend Channels — Task 2.4):
Khi hoàn thành đọc Email IMAP ở Task 2.3 & 2.4, Thu Lộc map các trường email vào bảng `tickets` và `ticket_messages` theo đúng cấu trúc trên để hiển thị thống nhất trên danh sách vé.
