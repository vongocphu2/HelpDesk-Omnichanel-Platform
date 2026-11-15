import { useState } from "react";
import { Headset } from "lucide-react";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  channel: "Web Portal",
  subject: "",
  description: "",
};

export default function CustomerPortal({ onSubmitTicket }) {
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [ticketId, setTicketId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const next = {};

    if (form.fullName.trim().length < 2) {
      next.fullName = "Họ và tên phải có ít nhất 2 ký tự.";
    }

    const email = form.email.trim();
    if (!email) {
      next.email = "Vui lòng nhập email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Email không hợp lệ.";
    }

    if (form.subject.trim().length < 5) {
      next.subject = "Tiêu đề phải có ít nhất 5 ký tự.";
    }

    if (form.description.trim().length < 10) {
      next.description = "Mô tả phải có ít nhất 10 ký tự.";
    }

    if (errors.file) {
      next.file = errors.file;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFile = (event) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setSubmitError("");
    setErrors((prev) => ({ ...prev, file: "" }));

    if (selected && !["image/png", "image/jpeg", "application/pdf"].includes(selected.type)) {
      setErrors((prev) => ({
        ...prev,
        file: "Chỉ hỗ trợ PNG, JPG hoặc PDF trong bản demo.",
      }));
      setFile(null);
    } else if (selected && selected.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, file: "Tệp đính kèm không được vượt quá 5 MB." }));
      setFile(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setSubmitError("");
    if (!validate()) return;

    if (!onSubmitTicket) {
      setSubmitError("Chưa kết nối API tạo ticket.");
      return;
    }

    const payload = {
      customer_name: form.fullName.trim(),
      customer_email: form.email.trim(),
      customer_phone: form.phone.trim() || undefined,
      subject: form.subject.trim(),
      description: form.description.trim(),
      channel_type: "web",
    };

    try {
      setLoading(true);
      if (file) {
        payload.attachment_url = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Không đọc được tệp. Vui lòng chọn lại."));
          reader.onabort = () => reject(new Error("Đã hủy đọc tệp. Vui lòng chọn lại."));
          reader.readAsDataURL(file);
        });
      }
      const result = await onSubmitTicket(payload);

      const code =
        result?.ticket_code ||
        result?.data?.ticket_code ||
        result?.ticketCode ||
        result?.data?.ticketCode;

      if (!code) throw new Error("API chưa trả về mã ticket. Vui lòng kiểm tra trước khi gửi lại.");

      setTicketId(code);
    } catch (error) {
      const message =
        error.code === "ERR_NETWORK"
          ? "Không thể kết nối máy chủ. Vui lòng kiểm tra Backend đang chạy."
          : error.response?.data?.message ||
            error.message ||
            "Không thể gửi yêu cầu.";

      setSubmitError(Array.isArray(message) ? message.join(" ") : message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-[#E4EAE6] px-4 py-3 outline-none focus:border-[#047857] focus:ring-2 focus:ring-emerald-100 bg-white text-slate-800 transition-colors";

  const ErrorText = ({ field }) =>
    errors[field] ? (
      <p className="mt-1 text-sm text-red-600" role="alert">
        {errors[field]}
      </p>
    ) : null;

  return (
    <main className="min-h-screen bg-[#F6F8F7] px-4 py-8 text-slate-800 font-sans">
      <header className="mx-auto mb-8 flex max-w-3xl items-center justify-between border-b border-[#E4EAE6] pb-4">
        <a
          href="/"
          className="brand"
          style={{ textDecoration: "none" }}
          title="Quay lại giao diện HelpDesk"
        >
          <span className="brand-mark">
            <Headset size={21} />
          </span>
          <span>
            HelpDesk
            <small>SUPPORT PLATFORM</small>
          </span>
        </a>
        <a
          href="/"
          className="rounded-lg border border-[#E4EAE6] bg-white px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition"
        >
          Dành cho Nhân viên CSKH →
        </a>
      </header>

      <section className="mx-auto max-w-3xl rounded-2xl border border-[#E4EAE6] bg-white p-6 shadow-sm md:p-10">
        {ticketId ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-bold text-[#047857]">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-[#1E2D26]">
              Yêu cầu hỗ trợ đã được tiếp nhận!
            </h2>
            <p className="mt-3 text-base text-gray-700">
              Mã Ticket: <strong className="rounded bg-emerald-50 px-2 py-1 text-[#047857] font-mono text-lg">#{ticketId}</strong>
            </p>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              Hệ thống đã ghi nhận yêu cầu vào hàng đợi xử lý. Đội ngũ CSKH sẽ phản hồi qua email <strong className="text-gray-700">{form.email}</strong> trong thời gian sớm nhất.
            </p>
            <button
              onClick={() => {
                setTicketId(null);
                setForm(initialForm);
                setFile(null);
                setErrors({});
              }}
              className="mt-8 rounded-xl bg-[#047857] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#065F46] transition"
            >
              Gửi thêm yêu cầu khác
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 border-b border-[#F0F2F0] pb-4">
              <span className="inline-block rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[#047857] border border-emerald-200">
                Web Portal · Tiếp nhận trực tuyến
              </span>
              <h2 className="mt-2 text-2xl font-bold text-[#1E2D26]">
                Gửi yêu cầu hỗ trợ kỹ thuật
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Vui lòng điền thông tin chi tiết để chúng tôi phân công nhân viên hỗ trợ bạn nhanh nhất.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fullName" className="mb-1.5 block text-xs font-bold text-[#344039]">
                    Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="fullName"
                    className={inputClass}
                    value={form.fullName}
                    onChange={(e) => update("fullName", e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn A"
                  />
                  <ErrorText field="fullName" />
                </div>

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-[#344039]">
                    Địa chỉ Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={inputClass}
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="nguyen.vana@gmail.com"
                  />
                  <ErrorText field="email" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-xs font-bold text-[#344039]">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    id="phone"
                    className={inputClass}
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+84 xxxxxxxxx"
                  />
                </div>

                <div>
                  <label htmlFor="channel" className="mb-1.5 block text-xs font-bold text-[#344039]">
                    Kênh tiếp nhận
                  </label>
                  <input
                    id="channel"
                    className="w-full rounded-xl border border-[#E4EAE6] bg-gray-50 px-4 py-3 text-slate-500 text-sm font-medium outline-none cursor-not-allowed"
                    value="Web Portal (Web Form)"
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="mb-1.5 block text-xs font-bold text-[#344039]">
                  Tiêu đề yêu cầu <span className="text-red-500">*</span>
                </label>
                <input
                  id="subject"
                  className={inputClass}
                  value={form.subject}
                  onChange={(e) => update("subject", e.target.value)}
                  placeholder="Ví dụ: Lỗi thanh toán đơn hàng / Không đăng nhập được tài khoản..."
                />
                <ErrorText field="subject" />
              </div>

              <div>
                <label htmlFor="description" className="mb-1.5 block text-xs font-bold text-[#344039]">
                  Nội dung chi tiết <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  rows={4}
                  className={inputClass}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Mô tả chi tiết sự cố, mã lỗi hoặc hoàn cảnh bạn cần hỗ trợ..."
                />
                <ErrorText field="description" />
              </div>

              <div>
                <label htmlFor="attachment" className="mb-1.5 block text-xs font-bold text-[#344039]">
                  Tệp đính kèm (Ảnh chụp màn hình, sao kê hoặc tài liệu)
                </label>
                <input
                  id="attachment"
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={handleFile}
                  disabled={loading}
                  className="block w-full rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-3 text-xs text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#047857] hover:file:bg-emerald-100 cursor-pointer"
                />
                <p className="mt-2 text-xs text-slate-500">Hỗ trợ PNG, JPG hoặc PDF. Dung lượng tối đa 5 MB.</p>
                {file && (
                  <p className="mt-2 text-xs text-emerald-700 font-medium">
                    ✓ Đã đính kèm: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                <ErrorText field="file" />
              </div>

              {submitError && (
                <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  ⚠️ {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#047857] px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-[#065F46] disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? "Đang xử lý gửi yêu cầu..." : "Gửi yêu cầu hỗ trợ (Submit Ticket) →"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

