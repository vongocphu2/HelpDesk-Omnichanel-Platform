# HelpDesk+ — Omnichannel Customer Support Platform with AI

> **Đồ án Tốt nghiệp Capstone Project (C1SE.92) — Đại học Duy Tân (DTU)**  
> **Giảng viên hướng dẫn:** ThS. Võ Văn Thuận  
> **Hệ thống Quản lý Hỗ trợ Khách hàng Đa kênh Tích hợp Trí tuệ Nhân tạo**

---

## 📌 1. Giới Thiệu Dự Án

**HelpDesk+** là nền tảng quản lý yêu cầu hỗ trợ khách hàng đa kênh (Omnichannel Helpdesk) thu nhỏ, hiện đại và tập trung. Hệ thống tiếp nhận khiếu nại và thắc mắc từ nhiều nguồn kênh khác nhau (**Web Form, Email IMAP/SMTP, Telegram Bot Webhook**), chuẩn hóa dữ liệu thành các Ticket duy nhất và điều phối đến các nhân viên hỗ trợ (Agent) thông qua giao diện hội thoại tập trung (**Unified Inbox**) với khả năng cập nhật thời gian thực (Realtime WebSocket).

Điểm khác biệt cốt lõi của **HelpDesk+** là việc tích hợp sâu **2 tính năng Trí tuệ nhân tạo (AI Engine)** vào quy trình vận hành dịch vụ khách hàng:

1. **Phân tích Cảm xúc & Phát hiện Mức độ Cấp bách (AI Sentiment & Urgency Analysis)**:
   * AI tự động quét nội dung tin nhắn đến từ mọi kênh, nhận diện sắc thái cảm xúc (*Tức giận / Bực bội / Bình thường / Hài lòng*) và phát hiện các từ khóa cấp bách (*"gấp", "lỗi nghiêm trọng", "không vào được", "hỏng hệ thống"*).
   * **Cơ chế tự động nâng độ ưu tiên (Priority Bump)**: Tự động nâng ticket lên mức cao nhất (`Urgent`), gắn nhãn cảnh báo đỏ và đẩy lên đầu danh sách chờ xử lý nhằm giải quyết kịp thời, ngăn ngừa vi phạm SLA.
2. **Gợi ý Câu trả lời Chuẩn mực (AI Auto-Draft Smart Reply)**:
   * Khi nhân viên CSKH mở giao diện Unified Inbox, AI quét yêu cầu của khách hàng cùng lịch sử hội thoại để sinh ra một câu trả lời mẫu chuẩn mực, lịch sự và đúng nghiệp vụ.
   * Nhân viên chỉ cần xem nhanh, điều chỉnh nhẹ và bấm nút **"1-Click Áp dụng & Gửi"** để phản hồi khách hàng trong tích tắc.

---

## 👥 2. Thành Viên Nhóm Thực Hiện (C1SE.92)

| STT | Họ và tên | MSSV | Vai trò chính trong đồ án | Email liên hệ |
| :---: | :--- | :---: | :--- | :--- |
| 1 | **Võ Ngọc Phú** | 29211162610 | **Scrum Master, Lead Dev (Backend & AI)** | `vongocphu136@gmail.com` |
| 2 | **Võ Thị Thu Lộc** | 29209224248 | **Developer (Backend, Channels & Queue)** | `votthuloc@dtu.edu.vn` |
| 3 | **Võ Hồng Phúc** | 29219021591 | **Developer (Frontend Lead & UI/UX)** | `vohongphucnt05@gmail.com` |
| 4 | **Trương Đình Thảo Đoan** | 29204138095 | **QA / Tester Chuyên trách (Test Plan, Automation & Report)** | `thaodoan29082005@gmail.com` |

---

## 🛠️ 3. Ngăn Xếp Công Nghệ (Tech Stack)

* **Backend**: Node.js, [NestJS](https://nestjs.com/) (TypeScript), TypeORM.
* **Database & Cache**: [PostgreSQL 16](https://www.postgresql.org/), [Redis 7](https://redis.io/).
* **Message Queue & Async Processing**: [BullMQ](https://docs.bullmq.io/) (xử lý hàng đợi bất đồng bộ tránh nghẽn API tiếp nhận và AI inference).
* **Realtime Communication**: [Socket.IO](https://socket.io/) (WebSocket Gateway cho Unified Inbox và Live Ticket Status).
* **Channel Adapters**:
  * **Web Form**: RESTful API Ingestion.
  * **Email**: IMAP (nhận thư tự động định kỳ) & SMTP ([Nodemailer](https://nodemailer.com/) gửi phản hồi).
  * **Telegram**: Telegram Bot API qua cơ chế Webhook.
* **AI Copilot Engine**: LLM API ([Google Gemini API](https://ai.google.dev/) / [OpenAI API](https://openai.com/)) với kỹ thuật Prompt Engineering có cấu trúc.
* **Frontend**: [React.js](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), Axios, Zustand.
* **Local DevOps**: Docker, Docker Compose (chạy PostgreSQL và Redis trên môi trường phát triển local).

---

## 🏛️ 4. Kiến Trúc Hệ Thống 4 Tầng

```
+-------------------------------------------------------------------------+
|                        1. CHANNEL INGESTION LAYER                       |
|   [Web Customer Portal]  |  [Email: IMAP / SMTP]  |  [Telegram Bot API] |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
|                  2. CORE BACKEND & ASYNC QUEUE (NestJS)                 |
|   • Channel Adapters (Normalize to unified Ticket/Message DTO)          |
|   • Message Queue: BullMQ (Redis) chống nghẽn tác vụ nặng               |
|   • Routing & Dispatcher: Phân công vé Round-Robin / Phân quyền RBAC    |
|   • Outbound Reply Gateway: Định tuyến câu trả lời về đúng kênh gốc    |
+-------------------------------------------------------------------------+
                    │                                     │
                    ▼                                     ▼
+-----------------------------------+   +---------------------------------+
|      3. AI INTELLIGENCE ENGINE     |   |    4. PRESENTATION & REALTIME   |
| • Sentiment & Urgency Detection   |   | • WebSocket Server (Socket.IO)  |
| • Auto Priority Bump to "Urgent"  |   | • Unified Inbox (Agent Chat)    |
| • AI Auto-Draft Smart Reply       |   | • SLA & Analytics Dashboard     |
+-----------------------------------+   +---------------------------------+
```

---

## 🚀 5. Hướng Dẫn Cài Đặt & Chạy Môi Trường Phát Triển Local

### Yêu cầu tiên quyết:
* [Node.js](https://nodejs.org/) (phiên bản v18 trở lên hoặc v20 LTS).
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (đã cài đặt và đang chạy).
* [Git](https://git-scm.com/).

### Bước 1: Khởi động CSDL & Hàng đợi bằng Docker Compose
Mở terminal tại thư mục gốc dự án:
```bash
docker compose up -d
```
> Lệnh này sẽ khởi động container `helpdesk_postgres` (cổng 5432) và `helpdesk_redis` (cổng 6379) ở chế độ chạy nền.

### Bước 2: Thiết lập biến môi trường
Tạo file `.env` từ file mẫu:
```bash
cp .env.example .env
```
*(Điền API Key của mô hình AI, thông tin Telegram Bot Token và mật khẩu ứng dụng Gmail vào file `.env`).*

### Bước 3: Khởi chạy Backend (NestJS)
```bash
cd backend
npm install
npm run start:dev
```
Backend API sẽ hoạt động tại: `http://localhost:3000` (Swagger Docs: `http://localhost:3000/api/docs`).

### Bước 4: Khởi chạy Frontend (React + Vite)
Mở một cửa sổ terminal mới:
```bash
cd frontend
npm install
npm run dev
```
Giao diện người dùng sẽ chạy tại: `http://localhost:5173`.

---

## 📅 6. Kế Hoạch 6 Sprint (Agile/Scrum Timeline)

* **Sprint 1 (21/09 – 29/09/2026)**: Nền tảng kỹ thuật, Docker local, ERD CSDL, UI Design System trên Figma, Prompt AI baseline.
* **Sprint 2 (30/09 – 07/10/2026)**: Tiếp nhận Ticket qua Web Form & Email (IMAP/SMTP), Customer Portal.
  * **Task 2.1 (Phú - 5h)**: API tạo vé từ Web Form (`POST /api/v1/tickets`) — **Đã hoàn thành 100%**.
  * **Task 2.2 (Phú - 5h)**: API xem danh sách & chi tiết vé (`GET /api/v1/tickets`, `GET /api/v1/tickets/:id`) kèm bộ lọc phân trang và ưu tiên vé AI Bump — **Đã hoàn thành 100%** (Xem tài liệu tích hợp: `docs/API_TASK_2.2_SPEC_GUIDE.md`).
  * **Task 2.5b (Phú - 1.5h)**: Frontend API Service & Validation Client-side (`ticket.service.js`) — **Đã hoàn thành 100%**.
  * **Task 2.3 & 2.4 (Lộc - 12h)**: Kết nối Email IMAP/SMTP & Chuẩn hóa Email thành Ticket — *Đang tiến hành*.
  * **Task 2.5a & 2.6 (Phúc - 9.5h)**: UI Customer Portal & Bảng danh sách Ticket — *Đang tiến hành*.
  * **Task 2.5d & 2.7 (Đoan - 7h)**: Kiểm thử Validation & Kịch bản tiếp nhận vé Web/Email — *Đang tiến hành*.
* **Sprint 3 (08/10 – 16/10/2026)**: Kênh Telegram Bot Webhook & **AI Feature 1: Đọc cảm xúc & Tự động nâng Priority**.
* **Sprint 4 (17/10 – 24/10/2026)**: Quản lý vòng đời Ticket, Phân quyền RBAC (Admin/Manager/Agent), Thuật toán phân công Round-robin.
* **Sprint 5 (25/10 – 03/11/2026)**: Giao diện **Unified Inbox realtime** (WebSocket) & **AI Feature 2: Gợi ý câu trả lời chuẩn mực**.
* **Sprint 6 (04/11 – 13/11/2026)**: Xử lý hàng đợi bất đồng bộ BullMQ, Dashboard thống kê SLA & Tỷ lệ cảm xúc khách hàng.
* **Buffer & Delivery (14/11 – 13/12/2026)**: Tối ưu hoàn thiện, Video demo thực tế, Tổng kết Test Report chi tiết và Bảo vệ đồ án.

---

## 📜 7. Quy Ước Đóng Góp (Git Workflow)
Vui lòng tham khảo tài liệu [CONTRIBUTING.md](CONTRIBUTING.md) để nắm rõ:
* Quy tắc đặt tên nhánh (`feature/`, `bugfix/`).
* Quy chuẩn đặt tên Commit Message (Conventional Commits).
* Quy trình tạo Pull Request (PR) và nghiệm thu DoD trước khi merge code vào nhánh `develop`.

---

*© 2026 Capstone Project Team C1SE.92 — Trường Đại học Duy Tân (Duy Tan University)*
