# AGENTS.md

## Custom Slash Commands

### `/archify`
When the user runs `/archify` or asks for architecture diagrams, workflows, sequence diagrams, dataflow, or state lifecycle diagrams:
- Use the `archify` CLI tool or skill.
- The command supports generating interactive HTML diagrams with dark/light themes, inline SVG, animations, and export features.
- Types: `architecture`, `workflow`, `sequence`, `dataflow`, `lifecycle`.
- Compile & deliver with `archify deliver <type> <candidate.json> <output.html> --quality showcase --json`.

---

## Phân công vai trò & Kế hoạch Sprint dự án HelpDesk+ (C1SE.92) — Đội ngũ 4 thành viên (Chuẩn)

### 1. Phân định vai trò ĐỘI NGŨ 4 THÀNH VIÊN (ĐÃ LOẠI BỎ HÙNG, BỎ DEVOPS):
- **Võ Ngọc Phú** (16 tasks - 78.5h): **Scrum Master, Lead Developer (Backend & AI)**
  - Quản lý quy trình, theo dõi tiến độ Sprint và điều phối chung.
  - Thiết kế kiến trúc 4 tầng, phát triển các API cốt lõi Backend (NestJS).
  - Nghiên cứu & triển khai 2 tính năng AI: (1) Sentiment & Urgency detection (tự động đẩy Priority lên đầu); (2) AI Auto-Draft Reply (gợi ý câu trả lời chuẩn mực).
  - *Nhiệm vụ gốc giữ nguyên* + nhận thêm hỗ trợ: Task 1.8a (Data Specs & tiêu chí nghiệm thu AI), Task 2.5b (Frontend API Service & Axios).
- **Võ Thị Thu Lộc** (19 tasks - 89.5h): **Developer (Backend & Channels)**
  - Phối hợp xây dựng Backend, xử lý các Channel Adapters (Web Form, Email IMAP/SMTP, Telegram Webhook).
  - Xây dựng hệ thống Message Queue (BullMQ/Redis) xử lý bất đồng bộ & WebSocket Server (Socket.IO).
  - Cấu hình Docker Compose local (Postgres 16 + Redis 7).
  - *Nhiệm vụ gốc giữ nguyên* + gánh từ Hùng: Task 1.8c (Figma Base 1 Customer Portal & Base 5 Assign Modal), Task 2.5c (Cấu hình kênh Web Form & Email Template), Task 4.7 (Frontend Modal phân công ticket), Task 7.8 (Kiểm tra giao diện cuối & bàn giao).
- **Võ Hồng Phúc** (15 tasks - 91.0h): **Developer (Frontend Lead & UI/UX)**
  - Chuyên sâu Frontend React.js + Vite + Tailwind CSS.
  - Phụ trách chính: Giao diện **Unified Inbox** (chat đa kênh tập trung), Màn hình chi tiết Ticket Timeline, Hàng đợi Ticket, Badge nguồn kênh & Nhãn cảm xúc/khẩn cấp AI, Tích hợp WebSocket client realtime.
  - *Nhiệm vụ gốc giữ nguyên* + gánh từ Hùng: Task 1.7 (Khung frontend React+Vite+Tailwind), Task 1.8b (Figma Base 2, 3, 4 Core Inbox & AI Draft), Task 2.5a (UI Customer Portal Form), Task 3.7 (Khung xem trước tin nhắn khách hàng), Task 4.5 (UI Auth Login/Register), Task 5.7 (Khung gợi ý AI Draft UI & 1-click), Task 6.6 (Tinh chỉnh UI/UX responsive).
- **Trương Đình Thảo Đoan** (14 tasks - 77.0h): **QA/Tester Chuyên trách**
  - Kiểm thử toàn bộ chất lượng hệ thống từ Frontend đến Backend (Web, Email, Telegram), test hiệu năng API (< 500ms, 50 req/s).
  - Kiểm định độ chính xác và hợp lý của 2 tính năng AI (Phân loại cảm xúc/khẩn cấp & Độ chuẩn mực câu trả lời gợi ý).
  - Lập Test Report tổng kết đồ án, chuẩn bị Slide bảo vệ.
  - *Nhiệm vụ gốc giữ nguyên* + gánh từ Hùng: Task 1.8d (Figma Base 6 Dashboard & Nối dây Prototype 15 sự kiện), Task 2.5d (Kiểm thử UX & Validation form khách hàng), Task 6.4 (Frontend Dashboard thống kê Recharts SLA & Cảm xúc), Task 7.4 (Quay video demo đầy đủ kịch bản).

### 2. Nguyên tắc bất di bất dịch:
- **Tuyệt đối không có thành viên Hùng trong dự án.**
- **Ở các sprint, CHỈ CÁC TASK CỦA HÙNG MỚI ĐƯỢC CHIA RA CHO 4 THÀNH VIÊN, CÒN CÁC NHIỆM VỤ GỐC CỦA PHÚ, LỘC, PHÚC, ĐOAN THÌ GIỮ NGUYÊN 100%.**
- File chuẩn gốc của dự án: `d:\HELPDESK\HelpDesk_PhanCongCongViec_4ThanhVien_C1SE92.xlsx`.

### 3. Hai tính năng AI cốt lõi:
1. **Đọc thái độ cảm xúc & Phát hiện từ ngữ gấp rút (Sentiment & Urgency Analysis)**: Quét tin nhắn đến, nhận diện từ ngữ cấp bách để tự động nâng Priority lên mức cao nhất (`Urgent`), gắn nhãn cảnh báo đỏ và đẩy ticket lên đầu hàng đợi.
2. **Gợi ý câu trả lời chuẩn mực (AI Auto-Draft Smart Reply)**: Quét yêu cầu của khách và ngữ cảnh hội thoại để sinh câu trả lời mẫu chuẩn mực, nhân viên CSKH chỉ cần xem qua, điều chỉnh nhẹ và bấm gửi nhanh chóng trên Unified Inbox.
