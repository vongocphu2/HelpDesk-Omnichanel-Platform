# Email intake: cấu hình và kiểm thử Sprint 2

## IMAP

Với Gmail, đặt `EMAIL_IMAP_PORT=993` và `EMAIL_IMAP_SECURE=true` trong `.env`.
Nếu chưa có `EMAIL_IMAP_SECURE`, backend mặc định bật TLS trên cổng 993;
các cổng khác mặc định dùng kết nối IMAP/STARTTLS. Giá trị `true` hoặc `false`
được cấu hình rõ ràng sẽ được ưu tiên. Không commit thông tin đăng nhập.

## Email lỗi và thử lại

Cron chạy mỗi phút. File `data/email-sync-state.json` lưu `uidValidity`,
`lastProcessedUid` và `failedUids`. File cũ chưa có `failedUids` vẫn đọc được.

Khi một email lỗi, backend ghi UID vào `failedUids`, ghi log và xử lý email
tiếp theo. Mỗi lượt Cron thử lại các UID lỗi cùng email mới. Danh sách được
lưu cùng cursor, nên email lỗi vẫn được thử lại sau khi khởi động lại backend.
UID chỉ rời danh sách khi xử lý thành công hoặc được DB nhận diện đã xử lý.
Không bỏ vĩnh viễn email sau một số lần thử. Email lỗi cố định cần được kiểm
tra theo UID trong log; không tự ý xóa danh sách thử lại.

Lỗi ghi file trạng thái dừng lượt đồng bộ. Lượt sau có thể đọc lại email đã
tạo ticket; khóa duy nhất trong DB tiếp tục chống tạo trùng. File này phải
được lưu bền vững và chỉ có một tiến trình đồng bộ sử dụng nó. Không chạy
nhiều backend đồng thời dùng chung hộp thư và file trạng thái.

Lần khởi tạo đầu tiên vẫn lấy UID hiện tại làm mốc và bỏ qua email cũ.
UIDVALIDITY thay đổi vẫn yêu cầu kiểm tra thủ công, không tự reset cursor.

## Kiểm thử nghiệm thu với dịch vụ thật

1. Khởi động backend với Gmail/PostgreSQL thử nghiệm; đợi Cron khởi tạo mốc.
2. Gửi email mới, đợi lượt Cron và kiểm tra ticket cùng bản ghi processed.
3. Gây lỗi xử lý một email trong môi trường thử nghiệm, sau đó gửi email khác:
   email sau phải được tạo ticket; UID lỗi phải nằm trong `failedUids`.
4. Khởi động lại backend, khắc phục nguyên nhân lỗi và đợi Cron: email lỗi
   phải được xử lý, xóa khỏi danh sách thử lại và không tạo ticket trùng.
5. Kiểm tra Web Form vẫn tạo ticket và gửi email xác nhận qua SMTP.

Unit test dùng IMAP, filesystem và DB giả lập; không thay thế các bước trên.
