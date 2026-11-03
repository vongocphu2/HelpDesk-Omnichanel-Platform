
import { useState } from "react";

const initialForm = {
  fullName: "",
  email: "",
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

    // Giữ lỗi file hiện tại cho đến khi người dùng chọn lại file.
    if (errors.file) {
      next.file = errors.file;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFile = (event) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setErrors((prev) => ({ ...prev, file: "" }));

    if (selected && !["image/png", "image/jpeg", "application/pdf"].includes(selected.type)) {
      setErrors((prev) => ({
        ...prev,
        file: "Chỉ hỗ trợ PNG, JPG hoặc PDF trong bản demo.",
      }));
      setFile(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setSubmitError("");
    if (!validate()) return;

    if (file) {
      setSubmitError(
        "Chức năng tải tệp chưa được kết nối. Vui lòng bỏ tệp để thử gửi yêu cầu."
      );
      return;
    }

    if (!onSubmitTicket) {
      setSubmitError("Chưa kết nối API tạo ticket.");
      return;
    }

    const payload = {
      customer_name: form.fullName.trim(),
      customer_email: form.email.trim(),
      subject: form.subject.trim(),
      description: form.description.trim(),
      channel_type: "web",
    };

    try {
      setLoading(true);
      const result = await onSubmitTicket(payload);

      if (!result?.ticket_code) {
        throw new Error("API chưa trả về mã ticket.");
      }

      setTicketId(result.ticket_code);
    } catch (error) {
      const message =
        error.code === "ERR_NETWORK"
          ? "Không thể kết nối máy chủ. Vui lòng thử lại sau."
          : error.response?.data?.message ||
          error.message ||
          "Không thể gửi yêu cầu.";

      setSubmitError(
        Array.isArray(message) ? message.join(" ") : message
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-[#E4EAE6] px-4 py-3 outline-none focus:border-[#047857] focus:ring-2 focus:ring-emerald-100";

  const ErrorText = ({ field }) =>
    errors[field] ? (
      <p className="mt-1 text-sm text-red-600" role="alert">
        {errors[field]}
      </p>
    ) : null;

  return (
    <main className="min-h-screen bg-[#F6F8F7] px-4 py-8 text-slate-800">
      <header className="mx-auto mb-8 flex max-w-3xl items-center justify-between">
        <h1 className="text-2xl font-bold text-[#047857]">
          HelpDesk+
        </h1>
        <span className="text-sm text-emerald-800">
          Customer Portal
        </span>
      </header>

      <section className="mx-auto max-w-3xl rounded-2xl border border-[#E4EAE6] bg-white p-6 shadow-sm md:p-10">
        {ticketId ? (
          <div className="py-12 text-center">
            <div className="mb-4 text-5xl text-[#047857]">✓</div>
            <h2 className="text-2xl font-bold">
              Yêu cầu hỗ trợ đã được tiếp nhận!
            </h2>
            <p className="mt-3">
              Mã Ticket: <strong>#{ticketId}</strong>
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Vui lòng lưu mã ticket để tra cứu và liên hệ hỗ trợ.
            </p>
            <button
              onClick={() => {
                setTicketId(null);
                setForm(initialForm);
                setFile(null);
                setErrors({});
              }}
              className="mt-6 rounded-xl bg-[#047857] px-6 py-3 text-white"
            >
              Gửi yêu cầu khác
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold">
              Gửi yêu cầu hỗ trợ kỹ thuật
            </h2>
            <p className="mb-8 mt-2 text-gray-500">
              Submit Support Ticket
            </p>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="fullName" className="mb-2 block font-medium">
                  Full Name *
                </label>
                <input
                  id="fullName"
                  className={inputClass}
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  placeholder="Nguyen Van A"
                />
                <ErrorText field="fullName" />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block font-medium">
                  Email Address *
                </label>
                <input
                  id="email"
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="abc@example.com"
                />
                <ErrorText field="email" />
              </div>

              <div>
                <label htmlFor="channel" className="mb-2 block font-medium">
                  Channel Source
                </label>
                <input
                  id="channel"
                  className={inputClass}
                  value="Web Portal"
                  readOnly
                />
              </div>

              <div>
                <label htmlFor="subject" className="mb-2 block font-medium">
                  Subject *
                </label>
                <input
                  id="subject"
                  className={inputClass}
                  value={form.subject}
                  onChange={(e) => update("subject", e.target.value)}
                  placeholder="Lỗi thanh toán gói Premium"
                />
                <ErrorText field="subject" />
              </div>

              <div>
                <label htmlFor="description" className="mb-2 block font-medium">
                  Description *
                </label>
                <textarea
                  id="description"
                  rows={5}
                  className={inputClass}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Mô tả chi tiết vấn đề của bạn..."
                />
                <ErrorText field="description" />
              </div>

              <div>
                <label htmlFor="attachment" className="mb-2 block font-medium">
                  File Upload
                </label>
                <input
                  id="attachment"
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={handleFile}
                  className="block w-full rounded-xl border border-dashed border-[#E4EAE6] p-4 text-sm"
                />
                {file && (
                  <p className="mt-2 text-sm text-emerald-700">
                    Đã chọn: {file.name}
                  </p>
                )}
                <ErrorText field="file" />
              </div>

              {submitError && (
                <p role="alert" className="text-sm text-red-600">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#047857] px-6 py-3 font-semibold text-white hover:bg-[#065F46] disabled:opacity-50"
              >
                {loading ? "Đang gửi..." : "Submit Ticket →"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
