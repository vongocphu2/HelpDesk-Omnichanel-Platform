import ticketService from "./services/ticket.service.js";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import SettingsPage from "./SettingsPage.jsx";
import CustomerPortal from "./pages/CustomerPortal.jsx";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Building2,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Eye,
  EyeOff,
  Globe2,
  Headset,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  MessageCircle,
  LogOut,
  Menu,
  MoreHorizontal,
  Moon,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Smile,
  Users,
  UserRound,
  Sun,
  Trash2,
  X,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", title: "Báo cáo", icon: LayoutDashboard },
  { label: "Unified Inbox", title: "Hộp thư", icon: Inbox, badge: "8" },
  { label: "Ticket List", title: "Danh sách yêu cầu", icon: FileText },
  { label: "Settings", title: "Cài đặt", icon: Settings },
];

const teamMembers = [
  { name: "Võ Thị Thu Lộc", initials: "TL", color: "peach" },
  { name: "Trương Đình Thảo Đoan", initials: "TĐ", color: "blue" },
  { name: "Võ Ngọc Phú", initials: "NP", color: "mint" },
  { name: "Võ Hồng Phúc", initials: "HP", color: "lilac" },
];

const ticketManagementSamples = [
  {
    id: "#TK-2852",
    subject: "Không thể cập nhật phương thức thanh toán",
    preview: "Trang thanh toán báo lỗi dù thông tin thẻ vẫn hợp lệ.",
    customer: "Võ Thị Thu Lộc",
    initials: "TL",
    color: "peach",
    channel: "Email",
    assignee: "Võ Hồng Phúc",
    priority: "Cao",
    status: "Đang mở",
    time: "5 phút trước",
  },
  {
    id: "#TK-2851",
    subject: "Cần xuất hóa đơn VAT tháng 9",
    preview: "Vui lòng bổ sung mã số thuế vào hóa đơn gần nhất.",
    customer: "Trương Đình Thảo Đoan",
    initials: "TĐ",
    color: "blue",
    channel: "Web Form",
    assignee: "Võ Thị Thu Lộc",
    priority: "Trung bình",
    status: "Đang xử lý",
    time: "10:42 AM",
  },
  {
    id: "#TK-2850",
    subject: "Không nhận được mã xác thực đăng nhập",
    preview: "Mã OTP không đến email sau nhiều lần gửi lại.",
    customer: "Võ Ngọc Phú",
    initials: "NP",
    color: "mint",
    channel: "Livechat",
    assignee: "Trương Đình Thảo Đoan",
    priority: "Cao",
    status: "Chờ phản hồi",
    time: "18 phút trước",
  },
  {
    id: "#TK-2849",
    subject: "Yêu cầu đổi địa chỉ nhận hàng",
    preview: "Đơn hàng chưa được bàn giao cho đơn vị vận chuyển.",
    customer: "Trần Văn Hoàng",
    initials: "TH",
    color: "blue",
    channel: "Hotline",
    assignee: "Võ Ngọc Phú",
    priority: "Thấp",
    status: "Đang xử lý",
    time: "32 phút trước",
  },
  {
    id: "#TK-2848",
    subject: "Ứng dụng bị treo khi tải báo cáo",
    preview: "Báo cáo doanh thu không tải xong trên trình duyệt Chrome.",
    customer: "Nguyễn Minh Anh",
    initials: "MA",
    color: "lilac",
    channel: "Email",
    assignee: "Võ Hồng Phúc",
    priority: "Cao",
    status: "Đang mở",
    time: "45 phút trước",
  },
  {
    id: "#TK-2847",
    subject: "Kiểm tra trạng thái hoàn tiền đơn hàng",
    preview: "Khoản hoàn tiền chưa hiển thị trong sao kê ngân hàng.",
    customer: "Trần Hoàng Nam",
    initials: "TN",
    color: "peach",
    channel: "Livechat",
    assignee: "Võ Hồng Phúc",
    priority: "Trung bình",
    status: "Đang xử lý",
    time: "1 giờ trước",
  },
  {
    id: "#TK-2846",
    subject: "Tài khoản bị khóa sau khi đổi mật khẩu",
    preview: "Không thể đăng nhập trên ứng dụng di động.",
    customer: "Phạm Gia Bảo",
    initials: "GB",
    color: "blue",
    channel: "Web Form",
    assignee: "Võ Thị Thu Lộc",
    priority: "Cao",
    status: "Chờ phản hồi",
    time: "2 giờ trước",
  },
  {
    id: "#TK-2845",
    subject: "Cập nhật thông tin xuất hóa đơn",
    preview: "Tên công ty trên hóa đơn chưa đúng với hồ sơ mới.",
    customer: "Lê Thu Hà",
    initials: "TH",
    color: "mint",
    channel: "Email",
    assignee: "Võ Ngọc Phú",
    priority: "Thấp",
    status: "Đã giải quyết",
    time: "3 giờ trước",
  },
  {
    id: "#TK-2844",
    subject: "Không đồng bộ được dữ liệu khách hàng",
    preview: "Danh sách liên hệ thiếu các bản ghi vừa nhập.",
    customer: "Đỗ Minh Khang",
    initials: "MK",
    color: "peach",
    channel: "Hotline",
    assignee: "Trương Đình Thảo Đoan",
    priority: "Trung bình",
    status: "Đang xử lý",
    time: "Hôm qua",
  },
  {
    id: "#TK-2843",
    subject: "Hướng dẫn thiết lập xác thực hai lớp",
    preview: "Cần hỗ trợ bật bảo mật hai lớp cho nhóm làm việc.",
    customer: "Phan Ngọc Mai",
    initials: "NM",
    color: "lilac",
    channel: "Web Form",
    assignee: "Võ Ngọc Phú",
    priority: "Thấp",
    status: "Đã giải quyết",
    time: "Hôm qua",
  },
];

const PerformanceChart = lazy(() =>
  import("./DashboardCharts.jsx").then((charts) => ({
    default: charts.PerformanceChart,
  })),
);
const MessageSourceChart = lazy(() =>
  import("./DashboardCharts.jsx").then((charts) => ({
    default: charts.MessageSourceChart,
  })),
);

const metrics = [
  {
    label: "Tổng số ticket",
    value: "248",
    change: "+12,8%",
    icon: Inbox,
    tone: "green",
    sparkline: "0,33 18,29 36,31 54,20 72,24 90,15 108,18 126,8 144,10 160,2",
  },
  {
    label: "Ticket đã xong",
    value: "184",
    change: "+8,1%",
    icon: Check,
    tone: "blue",
    sparkline: "0,29 18,33 36,24 54,26 72,17 90,22 108,12 126,14 144,5 160,8",
  },
  {
    label: "Ticket đang chờ",
    value: "36",
    change: "-4,2%",
    icon: Clock3,
    tone: "amber",
    down: true,
    sparkline: "0,5 18,10 36,8 54,18 72,15 90,24 108,21 126,31 144,28 160,39",
  },
  {
    label: "Thời gian phản hồi TB (SLA)",
    value: "1,7 giờ",
    change: "đạt mục tiêu",
    footnote: "SLA không quá 2 giờ",
    icon: Activity,
    tone: "coral",
    neutral: true,
    sparkline: "0,31 18,24 36,27 54,19 72,22 90,14 108,17 126,10 144,12 160,5",
  },
];

const tickets = [
  {
    id: "#TK-2841",
    subject: "Không thể cập nhật thông tin thanh toán",
    name: "Nguyễn Minh Anh",
    initials: "MA",
    color: "lilac",
    channel: "Email",
    status: "Ưu tiên cao",
    tone: "high",
    time: "4 phút trước",
    assignee: "Võ Hồng Phúc",
  },
  {
    id: "#TK-2839",
    subject: "Yêu cầu hoàn tiền đơn hàng #ORD-9381",
    name: "Trần Hoàng Nam",
    initials: "TN",
    color: "peach",
    channel: "Live chat",
    status: "Đang xử lý",
    tone: "progress",
    time: "18 phút trước",
    assignee: "Võ Thị Thu Lộc",
  },
  {
    id: "#TK-2836",
    subject: "Tài khoản bị khóa sau khi đăng nhập",
    name: "Lê Thu Hà",
    initials: "TH",
    color: "mint",
    channel: "Email",
    status: "Chờ phản hồi",
    tone: "waiting",
    time: "42 phút trước",
    assignee: "Trương Đình Thảo Đoan",
  },
  {
    id: "#TK-2832",
    subject: "Hướng dẫn xuất hóa đơn điện tử",
    name: "Phạm Gia Bảo",
    initials: "GB",
    color: "blue",
    channel: "Điện thoại",
    status: "Đang xử lý",
    tone: "progress",
    time: "1 giờ trước",
    assignee: "Võ Ngọc Phú",
  },
];

const activity = [
  {
    initials: "TL",
    color: "peach",
    name: "Võ Thị Thu Lộc",
    action: "đã giải quyết",
    ticket: "#TK-2828",
    time: "2 phút trước",
  },
  {
    initials: "NP",
    color: "mint",
    name: "Võ Ngọc Phú",
    action: "đã phản hồi",
    ticket: "#TK-2836",
    time: "12 phút trước",
  },
  {
    initials: "HP",
    color: "lilac",
    name: "Võ Hồng Phúc",
    action: "đã nhận yêu cầu",
    ticket: "#TK-2841",
    time: "26 phút trước",
  },
];

const initialConversations = [
  {
    id: "#TK-2852",
    name: "Võ Thị Thu Lộc",
    initials: "TL",
    color: "lilac",
    channel: "Email",
    preview: "Mình chưa nhận được hóa đơn tháng này.",
    time: "10:42",
    unread: true,
    email: "votthuloc@dtu.edu.vn",
    phone: "+84 912 345 678",
    company: "HelpDesk Pro",
    status: "pending",
    priority: "Cao",
    assignee: "Võ Hồng Phúc",
    messages: [
      {
        sender: "customer",
        time: "10:18",
        text: "Chào đội ngũ hỗ trợ, mình cần kiểm tra hóa đơn tháng này.",
      },
      {
        sender: "customer",
        time: "10:19",
        text: "Mình chưa nhận được hóa đơn tháng này dù thanh toán đã hoàn tất.",
      },
      {
        sender: "agent",
        time: "10:31",
        text: "Chào Thu Lộc, mình đang kiểm tra giao dịch và sẽ gửi lại hóa đơn cho bạn ngay nhé.",
      },
      {
        sender: "customer",
        time: "10:42",
        text: "Cảm ơn bạn. Mình cần hóa đơn trước cuối ngày hôm nay.",
      },
    ],
  },
  {
    id: "#TK-2847",
    name: "Trương Đình Thảo Đoan",
    initials: "TĐ",
    color: "peach",
    channel: "Telegram",
    preview: "Cho mình hỏi đơn hàng đã được gửi chưa?",
    time: "10:26",
    unread: true,
    email: "thaodoan29082005@gmail.com",
    phone: "+84 903 222 410",
    company: "Khách hàng cá nhân",
    status: "pending",
    priority: "Vừa",
    assignee: "Võ Thị Thu Lộc",
    messages: [
      {
        sender: "customer",
        time: "10:12",
        text: "Xin chào, mình muốn kiểm tra tình trạng đơn hàng #ORD-9412.",
      },
      {
        sender: "agent",
        time: "10:19",
        text: "Mình đang tra cứu đơn hàng giúp bạn nhé.",
      },
      {
        sender: "customer",
        time: "10:26",
        text: "Cho mình hỏi đơn hàng đã được gửi chưa?",
      },
    ],
  },
  {
    id: "#TK-2844",
    name: "Võ Ngọc Phú",
    initials: "NP",
    color: "mint",
    channel: "Web Form",
    preview: "Tôi muốn cập nhật địa chỉ nhận hàng.",
    time: "09:58",
    unread: false,
    email: "vongocphu136@gmail.com",
    phone: "+84 987 654 321",
    company: "Khách hàng cá nhân",
    status: "pending",
    priority: "Thấp",
    assignee: "Võ Ngọc Phú",
    messages: [
      {
        sender: "customer",
        time: "09:46",
        text: "Tôi muốn cập nhật địa chỉ nhận hàng cho đơn hàng tiếp theo.",
      },
      {
        sender: "agent",
        time: "09:58",
        text: "Chào anh Phú, anh có thể gửi địa chỉ mới để mình cập nhật giúp anh nhé.",
      },
    ],
  },
  {
    id: "#TK-2841",
    name: "Trần Văn Hoàng",
    initials: "TH",
    color: "blue",
    channel: "Email",
    preview: "Cảm ơn, vấn đề đã được giải quyết rồi.",
    time: "09:32",
    unread: false,
    email: "hoangtran246@gmail.com",
    phone: "+84 908 111 246",
    company: "HelpDesk Pro",
    status: "done",
    priority: "Vừa",
    assignee: "Trương Đình Thảo Đoan",
    messages: [
      {
        sender: "customer",
        time: "09:14",
        text: "Tôi không thể đăng nhập sau khi đổi mật khẩu.",
      },
      {
        sender: "agent",
        time: "09:22",
        text: "Mình đã gửi hướng dẫn đặt lại phiên đăng nhập đến email của bạn.",
      },
      {
        sender: "customer",
        time: "09:32",
        text: "Cảm ơn, vấn đề đã được giải quyết rồi.",
      },
    ],
  },
];

function getTeamMember(identity) {
  return (
    teamMembers.find(
      (member) => member.name === identity || member.initials === identity,
    ) ?? teamMembers[0]
  );
}

function ChannelIcon({ channel, size = 14 }) {
  const Icon =
    channel === "Email" ? Mail : channel === "Telegram" ? Send : Globe2;
  return <Icon size={size} aria-hidden="true" />;
}

function InboxScreen({ initialQuery = "" }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState(initialConversations[0].id);
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState("Tất cả");
  const [draft, setDraft] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  useEffect(() => setQuery(initialQuery), [initialQuery]);
  const selected = conversations.find(
    (conversation) => conversation.id === selectedId,
  );
  const selectedAssignee = getTeamMember(selected?.assignee);
  const visibleConversations = conversations.filter((conversation) => {
    const matchesQuery =
      `${conversation.name} ${conversation.preview} ${conversation.id}`
        .toLowerCase()
        .includes(query.toLowerCase());
    return matchesQuery && (filter !== "Chưa đọc" || conversation.unread);
  });

  const updateSelected = (updates) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedId
          ? { ...conversation, ...updates }
          : conversation,
      ),
    );
  };

  const selectConversation = (conversation) => {
    setSelectedId(conversation.id);
    setMobileChatOpen(true);
    setDetailsOpen(false);
    setConversations((current) =>
      current.map((item) =>
        item.id === conversation.id ? { ...item, unread: false } : item,
      ),
    );
  };

  const sendReply = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedId
          ? {
            ...conversation,
            preview: text,
            time: "Vừa xong",
            messages: [
              ...conversation.messages,
              { sender: "agent", time: "Vừa xong", text },
            ],
          }
          : conversation,
      ),
    );
    setDraft("");
  };

  return (
    <section
      className={`inbox-layout ${detailsOpen ? "details-open" : ""} ${mobileChatOpen ? "mobile-chat-open" : ""}`}
    >
      <aside className="inbox-queue" aria-label="Danh sách tin nhắn">
        <div className="queue-heading">
          <div>
            <h1>Hộp thư đến</h1>
            <p>
              {
                conversations.filter((conversation) => conversation.unread)
                  .length
              }{" "}
              tin nhắn chưa đọc
            </p>
          </div>
          <button
            className="icon-button queue-compose"
            aria-label="Tạo tin nhắn mới"
          >
            <Plus size={18} />
          </button>
        </div>
        <label className="queue-search">
          <Search size={16} />
          <input
            aria-label="Tìm trong hộp thư"
            placeholder="Tìm tên hoặc nội dung..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label="Xóa tìm kiếm"
              onClick={() => setQuery("")}
            >
              <X size={14} />
            </button>
          )}
        </label>
        <div className="queue-filters" role="group" aria-label="Lọc tin nhắn">
          {["Tất cả", "Chưa đọc"].map((item) => (
            <button
              key={item}
              className={filter === item ? "queue-filter-active" : ""}
              onClick={() => setFilter(item)}
            >
              {item}
              {item === "Tất cả" && <span>{conversations.length}</span>}
            </button>
          ))}
        </div>
        <div className="conversation-list">
          {visibleConversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`conversation-row ${selectedId === conversation.id ? "conversation-row-active" : ""}`}
              onClick={() => selectConversation(conversation)}
            >
              <Avatar
                initials={conversation.initials}
                color={conversation.color}
              />
              <span className="conversation-row-copy">
                <span className="conversation-row-top">
                  <strong>{conversation.name}</strong>
                  <time>{conversation.time}</time>
                </span>
                <span className="conversation-row-preview">
                  {conversation.preview}
                </span>
                <span className="conversation-row-bottom">
                  <span
                    className={`channel-label channel-${conversation.channel.toLowerCase().replace(" ", "-")}`}
                  >
                    <ChannelIcon channel={conversation.channel} />{" "}
                    {conversation.channel}
                  </span>
                  <span className="conversation-ticket">{conversation.id}</span>
                  {conversation.unread && (
                    <i className="unread-dot" aria-label="Chưa đọc" />
                  )}
                </span>
              </span>
            </button>
          ))}
          {visibleConversations.length === 0 && (
            <p className="queue-empty">Không tìm thấy hội thoại phù hợp.</p>
          )}
        </div>
        <div className="queue-footer">
          <span className="online-indicator" /> Đồng bộ trực tiếp
        </div>
      </aside>

      {selected && (
        <main className="inbox-conversation">
          <header className="conversation-header">
            <button
              className="icon-button conversation-back"
              aria-label="Quay lại danh sách"
              onClick={() => setMobileChatOpen(false)}
            >
              <ChevronLeft size={20} />
            </button>
            <Avatar initials={selected.initials} color={selected.color} />
            <div className="conversation-contact">
              <strong>{selected.name}</strong>
              <span>
                <i /> Đang hoạt động
              </span>
            </div>
            <span className="conversation-header-channel">
              <ChannelIcon channel={selected.channel} /> {selected.channel}
            </span>
            <div className="conversation-tools">
              <button
                className="icon-button details-toggle"
                aria-label="Thông tin khách hàng"
                onClick={() => setDetailsOpen(!detailsOpen)}
              >
                <UserRound size={17} />
              </button>
              <button className="icon-button" aria-label="Tùy chọn hội thoại">
                <MoreHorizontal size={19} />
              </button>
            </div>
          </header>
          <div className="ticket-subject">
            <span className="subject-ticket-id">{selected.id}</span>
            <strong>{selected.preview}</strong>
          </div>
          <div className="message-history" aria-live="polite">
            <div className="message-date">Hôm nay, 1 tháng 10</div>
            {selected.messages.map((message, index) => (
              <div
                className={`message-line message-${message.sender}`}
                key={`${selected.id}-${index}`}
              >
                {message.sender === "customer" && (
                  <Avatar
                    initials={selected.initials}
                    color={selected.color}
                    small
                  />
                )}
                <div className="message-body">
                  <p>{message.text}</p>
                  <span>
                    {message.time}
                    {message.sender === "agent" && <CheckCheck size={13} />}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <form className="reply-composer" onSubmit={sendReply}>
            <textarea
              aria-label="Soạn phản hồi"
              placeholder={`Trả lời ${selected.name}...`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form.requestSubmit();
                }
              }}
            />
            <div className="composer-actions">
              <div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Đính kèm tệp"
                >
                  <Paperclip size={17} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Chèn biểu tượng cảm xúc"
                >
                  <Smile size={17} />
                </button>
                <span className="composer-hint">
                  Enter để gửi · Shift + Enter xuống dòng
                </span>
              </div>
              <button
                className="send-reply"
                type="submit"
                disabled={!draft.trim()}
                aria-label="Gửi phản hồi"
              >
                <span>Gửi phản hồi</span>
                <Send size={15} />
              </button>
            </div>
          </form>
        </main>
      )}

      {selected && (
        <aside className="customer-details" aria-label="Thông tin khách hàng">
          <div className="details-heading">
            <h2>Thông tin</h2>
            <button
              className="icon-button details-close"
              aria-label="Đóng thông tin khách hàng"
              onClick={() => setDetailsOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          <div className="customer-profile">
            <Avatar initials={selected.initials} color={selected.color} />
            <strong>{selected.name}</strong>
            <span>Khách hàng từ tháng 3, 2024</span>
          </div>
          <div className="customer-contact-list">
            <div>
              <Mail size={15} />
              <span>
                <small>Email</small>
                <strong>{selected.email}</strong>
              </span>
            </div>
            <div>
              <MessageCircle size={15} />
              <span>
                <small>Điện thoại</small>
                <strong>{selected.phone}</strong>
              </span>
            </div>
            <div>
              <Globe2 size={15} />
              <span>
                <small>Tổ chức</small>
                <strong>{selected.company}</strong>
              </span>
            </div>
          </div>
          <div className="details-divider" />
          <section className="ticket-properties">
            <h3>Thuộc tính ticket</h3>
            <div className="property-group">
              <span>Trạng thái</span>
              <div
                className="status-switch"
                role="group"
                aria-label="Trạng thái ticket"
              >
                <button
                  className={
                    selected.status === "pending" ? "status-selected" : ""
                  }
                  onClick={() => updateSelected({ status: "pending" })}
                >
                  <Clock3 size={13} /> Chờ xử lý
                </button>
                <button
                  className={
                    selected.status === "done"
                      ? "status-selected status-done"
                      : ""
                  }
                  onClick={() => updateSelected({ status: "done" })}
                >
                  <Check size={13} /> Đã xong
                </button>
              </div>
            </div>
            <label className="property-group">
              <span>Độ ưu tiên</span>
              <select
                className={`priority-select priority-${selected.priority.toLowerCase()}`}
                value={selected.priority}
                onChange={(event) =>
                  updateSelected({ priority: event.target.value })
                }
              >
                <option>Cao</option>
                <option>Vừa</option>
                <option>Thấp</option>
              </select>
            </label>
            <label className="property-group">
              <span>Người phụ trách</span>
              <span className="assignee-select-wrap">
                <Avatar
                  initials={selectedAssignee.initials}
                  color={selectedAssignee.color}
                  small
                  title={selectedAssignee.name}
                />
                <select
                  aria-label="Chọn người phụ trách"
                  value={selected.assignee}
                  onChange={(event) =>
                    updateSelected({ assignee: event.target.value })
                  }
                >
                  {teamMembers.map((member) => (
                    <option key={member.initials} value={member.name}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </span>
            </label>
          </section>
          <div className="details-divider" />
          <section className="ticket-context">
            <h3>Ticket hiện tại</h3>
            <div>
              <span>Mã yêu cầu</span>
              <strong>{selected.id}</strong>
            </div>
            <div>
              <span>Kênh tiếp nhận</span>
              <strong className="detail-channel">
                <ChannelIcon channel={selected.channel} /> {selected.channel}
              </strong>
            </div>
            <div>
              <span>Thời gian tạo</span>
              <strong>Hôm nay, 10:18</strong>
            </div>
          </section>
          <button className="customer-history-button">
            <Clock3 size={15} /> Lịch sử yêu cầu <ChevronDown size={14} />
          </button>
        </aside>
      )}
    </section>
  );
}

function Avatar({ initials, color = "mint", small = false, title }) {
  return (
    <span
      className={`avatar avatar-${color} ${small ? "avatar-small" : ""}`}
      title={title}
    >
      {initials}
    </span>
  );
}

const helpArticles = [
  {
    question: "Cách tạo yêu cầu mới?",
    answer:
      "Mở Danh sách yêu cầu, chọn Tạo yêu cầu mới, nhập thông tin khách hàng và nội dung cần hỗ trợ, sau đó lưu ticket.",
  },
  {
    question: "Cách phân công công việc cho thành viên?",
    answer:
      "Mở ticket cần xử lý, chọn Người phụ trách trong bảng thông tin bên phải và chọn thành viên phù hợp trong nhóm.",
  },
  {
    question: "Cách kết nối Email hỗ trợ?",
    answer:
      "Vào Cài đặt → Kênh hỗ trợ, bật Email Support và cấu hình địa chỉ nhận thư của workspace.",
  },
  {
    question: "Làm sao để đổi trạng thái ticket?",
    answer:
      "Trong chi tiết ticket, chọn Chờ xử lý hoặc Đã xong tại mục Thuộc tính ticket. Trạng thái mới được cập nhật ngay.",
  },
];

const workspacePlans = [
  {
    id: "free",
    name: "Miễn phí",
    price: "0đ",
    period: "/tháng",
    features: ["Tối đa 3 thành viên", "1 kênh hỗ trợ", "100 ticket / tháng"],
  },
  {
    id: "basic",
    name: "Cơ bản",
    price: "299.000đ",
    period: "/tháng",
    features: [
      "Tối đa 10 thành viên",
      "3 kênh hỗ trợ",
      "Ticket không giới hạn",
    ],
  },
  {
    id: "pro",
    name: "Chuyên nghiệp",
    price: "799.000đ",
    period: "/tháng",
    features: [
      "Thành viên không giới hạn",
      "Tất cả kênh hỗ trợ",
      "Báo cáo nâng cao",
    ],
  },
];

function HelpDrawer({ onClose }) {
  const [query, setQuery] = useState("");
  const [openArticle, setOpenArticle] = useState(null);
  const filteredArticles = helpArticles.filter((article) =>
    `${article.question} ${article.answer}`
      .toLocaleLowerCase("vi-VN")
      .includes(query.toLocaleLowerCase("vi-VN")),
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="help-drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="help-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-drawer-title"
      >
        <header className="help-drawer-header">
          <span className="help-drawer-mark">
            <CircleHelp size={19} />
          </span>
          <div>
            <span className="help-drawer-eyebrow">HELPDESK SUPPORT</span>
            <h2 id="help-drawer-title">Trung tâm trợ giúp</h2>
          </div>
          <button
            className="icon-button help-drawer-close"
            aria-label="Đóng trợ giúp"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="help-drawer-content">
          <div className="help-drawer-intro">
            <h3>Chúng tôi có thể giúp gì?</h3>
            <p>Tìm câu trả lời nhanh cho các thao tác thường dùng.</p>
          </div>
          <label className="help-search">
            <Search size={16} />
            <input
              aria-label="Tìm tài liệu hướng dẫn"
              placeholder="Tìm hướng dẫn..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm trợ giúp"
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </label>
          <section className="help-faq-section">
            <div className="help-section-label">
              <BookOpen size={15} /> CÂU HỎI THƯỜNG GẶP
            </div>
            <div className="help-faq-list">
              {filteredArticles.map((article, index) => {
                const expanded = openArticle === index;
                return (
                  <article
                    className={`help-faq-item ${expanded ? "help-faq-item-open" : ""}`}
                    key={article.question}
                  >
                    <button
                      aria-expanded={expanded}
                      onClick={() => setOpenArticle(expanded ? null : index)}
                    >
                      <span>{article.question}</span>
                      <ChevronDown size={16} />
                    </button>
                    {expanded && <p>{article.answer}</p>}
                  </article>
                );
              })}
              {filteredArticles.length === 0 && (
                <p className="help-no-results">
                  Không tìm thấy hướng dẫn phù hợp.
                </p>
              )}
            </div>
          </section>
          <div className="help-drawer-bottom">
            <span className="help-online-status">
              <i /> Đội ngũ kỹ thuật đang trực tuyến
            </span>
            <a
              className="help-support-cta"
              href="mailto:technical@helpdesk.com?subject=Ho%20tro%20ky%20thuat%20HelpDesk"
            >
              <Mail size={16} /> Gửi yêu cầu hỗ trợ cho Kỹ thuật
              <ArrowRight size={15} />
            </a>
            <p>Phản hồi thường trong vòng một ngày làm việc.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Sidebar({
  active,
  onNavigate,
  open,
  onClose,
  onLogout,
  darkMode,
  onToggleTheme,
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [workspaces, setWorkspaces] = useState([
    {
      id: "helpdesk",
      name: "HelpDesk",
      plan: "Gói chuyên nghiệp",
      planId: "pro",
    },
    {
      id: "support-team",
      name: "HelpDesk Support Team",
      plan: "Gói Cơ bản",
      planId: "basic",
    },
    {
      id: "test-project",
      name: "Dự án Thử nghiệm",
      plan: "Gói Miễn phí",
      planId: "free",
    },
  ]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("helpdesk");
  const selectedWorkspace =
    workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
    workspaces[0];
  const workspaceRef = useRef(null);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    if (!workspaceMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!workspaceRef.current?.contains(event.target)) {
        setWorkspaceMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setWorkspaceMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [workspaceMenuOpen]);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  const openSettings = (options = {}) => {
    setProfileMenuOpen(false);
    onNavigate("Settings", options);
  };

  return (
    <>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Đóng menu"
          onClick={onClose}
        />
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <a
          className="brand"
          href="#dashboard"
          onClick={() => onNavigate("Dashboard")}
        >
          <span className="brand-mark">
            <Headset size={21} />
          </span>
          <span>
            HelpDesk
            <small>SUPPORT PLATFORM</small>
          </span>
          <button
            className="icon-button sidebar-close"
            aria-label="Đóng menu"
            onClick={(event) => {
              event.preventDefault();
              onClose();
            }}
          >
            <X size={19} />
          </button>
        </a>
        <div className="workspace-switcher-anchor" ref={workspaceRef}>
          <button
            className={`workspace-switcher ${workspaceMenuOpen ? "workspace-switcher-open" : ""}`}
            type="button"
            aria-haspopup="menu"
            aria-expanded={workspaceMenuOpen}
            onClick={() => setWorkspaceMenuOpen((current) => !current)}
          >
            <span className="workspace-mark">
              {selectedWorkspace.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="workspace-copy">
              <strong>{selectedWorkspace.name}</strong>
              <small>{selectedWorkspace.plan}</small>
            </span>
            <ChevronDown
              className="workspace-switcher-chevron"
              size={15}
              style={{
                transform: workspaceMenuOpen
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
              }}
            />
          </button>
          {workspaceMenuOpen && (
            <div
              className="workspace-dropdown"
              role="menu"
              aria-label="Chọn workspace"
            >
              <span className="workspace-dropdown-label">
                KHÔNG GIAN LÀM VIỆC
              </span>
              {workspaces.map((workspace) => (
                <button
                  className="workspace-option"
                  key={workspace.id}
                  role="menuitemradio"
                  aria-checked={workspace.id === selectedWorkspaceId}
                  onClick={() => {
                    setSelectedWorkspaceId(workspace.id);
                    setWorkspaceMenuOpen(false);
                  }}
                >
                  <span className="workspace-option-mark">
                    <Building2 size={15} />
                  </span>
                  <span className="workspace-option-copy">
                    <strong>{workspace.name}</strong>
                    <small>{workspace.plan}</small>
                  </span>
                  {workspace.id === selectedWorkspaceId && (
                    <Check className="workspace-selected-check" size={16} />
                  )}
                </button>
              ))}
              <span className="workspace-dropdown-divider" />
              <button
                className="workspace-action"
                role="menuitem"
                onClick={() => {
                  setNewWorkspaceName("");
                  setWorkspaceMenuOpen(false);
                  setCreateWorkspaceOpen(true);
                }}
              >
                <Plus size={15} /> Tạo không gian làm việc mới
              </button>
              <button
                className="workspace-action"
                role="menuitem"
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  openSettings({ tab: "workspace" });
                }}
              >
                <Settings size={15} /> Cài đặt không gian làm việc
              </button>
              <button
                className="workspace-action workspace-upgrade-action"
                role="menuitem"
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  setPlansOpen(true);
                }}
              >
                <Sparkles size={15} /> Nâng cấp gói dịch vụ{" "}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
        <p className="nav-caption">KHÔNG GIAN LÀM VIỆC</p>
        <nav className="nav-list" aria-label="Menu chính">
          {navigation.map(({ label, title, icon: Icon, badge }) => (
            <button
              key={label}
              className={`nav-item ${active === label ? "nav-item-active" : ""}`}
              onClick={() => onNavigate(label)}
            >
              <Icon size={18} />
              <span>{title}</span>
              {badge && <span className="nav-badge">{badge}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="help-card"
            type="button"
            onClick={() => setHelpOpen(true)}
          >
            <span className="help-card-icon">
              <CircleHelp size={17} />
            </span>
            <div>
              <strong>Cần hỗ trợ?</strong>
              <p>Chúng tôi luôn ở đây.</p>
            </div>
            <ArrowRight size={15} />
          </button>
          <div className="profile-row">
            <button
              className="profile-account"
              type="button"
              onClick={() => openSettings({ tab: "profile" })}
            >
              <Avatar initials="HP" color="lilac" title="Võ Hồng Phúc" />
              <span className="profile-copy">
                <strong>Võ Hồng Phúc</strong>
                <small>Quản trị viên</small>
              </span>
            </button>
            <div className="profile-menu-anchor" ref={profileMenuRef}>
              <button
                className="icon-button profile-menu-trigger"
                type="button"
                aria-label="Menu nhanh hồ sơ"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((current) => !current)}
              >
                <MoreHorizontal size={19} />
              </button>
              {profileMenuOpen && (
                <div className="profile-dropdown" role="menu">
                  <button
                    role="menuitem"
                    onClick={() => openSettings({ tab: "profile" })}
                  >
                    <UserRound size={15} /> Thông tin tài khoản
                  </button>
                  <button
                    role="menuitem"
                    onClick={() =>
                      openSettings({ tab: "profile", focusPassword: true })
                    }
                  >
                    <LockKeyhole size={15} /> Đổi mật khẩu
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onToggleTheme();
                    }}
                  >
                    {darkMode ? <Sun size={15} /> : <Moon size={15} />}
                    {darkMode ? "Chế độ Sáng" : "Chế độ Tối"}
                    <span className="profile-theme-state">
                      {darkMode ? "Đang bật" : ""}
                    </span>
                  </button>
                  <span className="profile-dropdown-divider" />
                  <button
                    className="profile-dropdown-logout"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onLogout();
                    }}
                  >
                    <LogOut size={15} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
      {helpOpen && <HelpDrawer onClose={() => setHelpOpen(false)} />}
      {createWorkspaceOpen && (
        <div
          className="workspace-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setCreateWorkspaceOpen(false);
          }}
        >
          <section
            className="workspace-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-create-title"
          >
            <header className="workspace-modal-header">
              <div>
                <span>HELPDESK WORKSPACE</span>
                <h2 id="workspace-create-title">Tạo không gian làm việc</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Đóng"
                onClick={() => setCreateWorkspaceOpen(false)}
              >
                <X size={17} />
              </button>
            </header>
            <form
              className="workspace-modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                const name = newWorkspaceName.trim();
                if (!name) return;
                const workspace = {
                  id: `workspace-${Date.now()}`,
                  name,
                  plan: "Gói Miễn phí",
                  planId: "free",
                };
                setWorkspaces((current) => [...current, workspace]);
                setSelectedWorkspaceId(workspace.id);
                setCreateWorkspaceOpen(false);
              }}
            >
              <label>
                Tên không gian làm việc
                <input
                  autoFocus
                  required
                  value={newWorkspaceName}
                  onChange={(event) => setNewWorkspaceName(event.target.value)}
                  placeholder="Ví dụ: Nhóm chăm sóc khách hàng"
                />
              </label>
              <p>
                Workspace mới bắt đầu với gói Miễn phí. Bạn có thể nâng cấp bất
                cứ lúc nào.
              </p>
              <footer>
                <button
                  type="button"
                  className="workspace-cancel-button"
                  onClick={() => setCreateWorkspaceOpen(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="primary-button">
                  <Plus size={15} /> Tạo workspace
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
      {plansOpen && (
        <div
          className="workspace-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPlansOpen(false);
          }}
        >
          <section
            className="workspace-plans-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-plans-title"
          >
            <header className="workspace-modal-header">
              <div>
                <span>CHỌN GÓI PHÙ HỢP</span>
                <h2 id="workspace-plans-title">Gói dịch vụ HelpDesk</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Đóng"
                onClick={() => setPlansOpen(false)}
              >
                <X size={17} />
              </button>
            </header>
            <div className="workspace-plan-grid">
              {workspacePlans.map((plan) => (
                <article
                  className={`workspace-plan-card ${selectedWorkspace.planId === plan.id ? "workspace-plan-current" : ""}`}
                  key={plan.id}
                >
                  {selectedWorkspace.planId === plan.id && (
                    <span className="workspace-plan-current-label">
                      <Check size={12} /> Gói hiện tại
                    </span>
                  )}
                  <h3>{plan.name}</h3>
                  <p className="workspace-plan-price">
                    <strong>{plan.price}</strong>
                    <span>{plan.period}</span>
                  </p>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check size={13} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={
                      selectedWorkspace.planId === plan.id
                        ? "workspace-plan-button workspace-plan-button-current"
                        : "workspace-plan-button"
                    }
                    disabled={selectedWorkspace.planId === plan.id}
                    onClick={() => {
                      setWorkspaces((current) =>
                        current.map((workspace) =>
                          workspace.id === selectedWorkspaceId
                            ? {
                              ...workspace,
                              plan: `Gói ${plan.name}`,
                              planId: plan.id,
                            }
                            : workspace,
                        ),
                      );
                      setPlansOpen(false);
                    }}
                  >
                    {selectedWorkspace.planId === plan.id
                      ? "Đang sử dụng"
                      : "Chọn gói này"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

const notificationSamples = [
  {
    id: "new-ticket",
    title: "Ticket mới",
    message: "Khách hàng Võ Thị Thu Lộc vừa tạo yêu cầu #TK-2852",
    time: "5 phút trước",
    icon: FileText,
    tone: "green",
    destination: "Ticket List",
    search: "#TK-2852",
  },
  {
    id: "ticket-reply",
    title: "Cập nhật",
    message: "Trương Đình Thảo Đoan vừa phản hồi trong ticket #TK-2841",
    time: "18 phút trước",
    icon: MessageCircle,
    tone: "blue",
    destination: "Ticket List",
    search: "#TK-2841",
  },
  {
    id: "high-priority",
    title: "Nhắc nhở",
    message: "Có 2 yêu cầu ưu tiên cao chưa được xử lý",
    time: "32 phút trước",
    icon: Clock3,
    tone: "amber",
    destination: "Ticket List",
    search: "Cao",
  },
];

function GlobalSearchModal({ onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const customerMap = new Map();
  [...initialConversations, ...ticketManagementSamples].forEach((record) => {
    if (!customerMap.has(record.name ?? record.customer)) {
      customerMap.set(record.name ?? record.customer, {
        name: record.name ?? record.customer,
        email: record.email ?? "Khách hàng HelpDesk",
        initials: record.initials,
        color: record.color,
      });
    }
  });
  const customers = [...customerMap.values()];
  const searchText = query.trim().toLocaleLowerCase("vi-VN");
  const ticketResults = ticketManagementSamples
    .filter((ticket) =>
      `${ticket.id} ${ticket.subject} ${ticket.preview}`
        .toLocaleLowerCase("vi-VN")
        .includes(searchText),
    )
    .slice(0, searchText ? 6 : 4)
    .map((ticket) => ({
      id: `ticket-${ticket.id}`,
      type: "ticket",
      title: ticket.subject,
      detail: `${ticket.id} · ${ticket.status}`,
      icon: FileText,
      destination: "Ticket List",
      search: ticket.id,
    }));
  const customerResults = customers
    .filter((customer) =>
      `${customer.name} ${customer.email}`
        .toLocaleLowerCase("vi-VN")
        .includes(searchText),
    )
    .slice(0, searchText ? 5 : 3)
    .map((customer) => ({
      id: `customer-${customer.name}`,
      type: "customer",
      title: customer.name,
      detail: customer.email,
      initials: customer.initials,
      color: customer.color,
      destination: "Unified Inbox",
      search: customer.name,
    }));
  const pageResults = navigation
    .filter((item) =>
      `${item.title} ${item.label}`
        .toLocaleLowerCase("vi-VN")
        .includes(searchText),
    )
    .map((item) => ({
      id: `page-${item.label}`,
      type: "page",
      title: item.title,
      detail: "Chuyển tới trang",
      icon: item.icon,
      destination: item.label,
    }));
  const groups = [
    { label: "Yêu cầu / Ticket", items: ticketResults },
    { label: "Khách hàng", items: customerResults },
    { label: "Trang chức năng", items: pageResults },
  ].filter((group) => group.items.length > 0);
  const flattenedResults = groups.flatMap((group) => group.items);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (!flattenedResults.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % flattenedResults.length);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (current) =>
            (current - 1 + flattenedResults.length) % flattenedResults.length,
        );
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const result = flattenedResults[activeIndex];
        if (result) onSelect(result);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, flattenedResults, onClose, onSelect]);

  let resultIndex = -1;
  return (
    <div
      className="global-search-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="global-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm toàn cục"
      >
        <label className="global-search-input-wrap">
          <Search size={19} />
          <input
            ref={inputRef}
            aria-label="Tìm kiếm ticket, khách hàng hoặc trang"
            placeholder="Tìm ticket, khách hàng hoặc trang..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>ESC</kbd>
        </label>
        <div
          className="global-search-results"
          role="listbox"
          aria-label="Kết quả tìm kiếm"
        >
          {groups.map((group) => (
            <section className="global-search-group" key={group.label}>
              <h3>{group.label}</h3>
              {group.items.map((result) => {
                resultIndex += 1;
                const itemIndex = resultIndex;
                const Icon = result.icon;
                return (
                  <button
                    key={result.id}
                    className={`global-search-result ${activeIndex === itemIndex ? "global-search-result-active" : ""}`}
                    role="option"
                    aria-selected={activeIndex === itemIndex}
                    onMouseEnter={() => setActiveIndex(itemIndex)}
                    onClick={() => onSelect(result)}
                  >
                    {result.type === "customer" ? (
                      <Avatar
                        initials={result.initials}
                        color={result.color}
                        small
                      />
                    ) : (
                      <span className="global-search-result-icon">
                        <Icon size={16} />
                      </span>
                    )}
                    <span className="global-search-result-copy">
                      <strong>{result.title}</strong>
                      <small>{result.detail}</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                );
              })}
            </section>
          ))}
          {flattenedResults.length === 0 && (
            <p className="global-search-empty">
              Không tìm thấy kết quả phù hợp.
            </p>
          )}
        </div>
        <footer className="global-search-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> di chuyển
          </span>
          <span>
            <kbd>↵</kbd> mở kết quả
          </span>
          <span>
            <kbd>ESC</kbd> đóng
          </span>
        </footer>
      </section>
    </div>
  );
}

function Header({
  onMenu,
  onLogout,
  onNavigate,
  onOpenSearch,
  onToggleTheme,
  onMarkAllRead,
  unreadCount,
  darkMode,
  sectionTitle,
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const notificationsRef = useRef(null);
  const accountRef = useRef(null);

  useEffect(() => {
    if (!notificationsOpen && !accountOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!notificationsRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
      if (!accountRef.current?.contains(event.target)) {
        setAccountOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationsOpen, accountOpen]);

  const navigateSettings = (options = {}) => {
    setAccountOpen(false);
    onNavigate("Settings", options);
  };

  const navigateNotification = (notification) => {
    setNotificationsOpen(false);
    onNavigate(notification.destination, { search: notification.search });
  };

  return (
    <header className="topbar">
      <button
        className="icon-button mobile-menu"
        aria-label="Mở menu"
        onClick={onMenu}
      >
        <Menu size={21} />
      </button>
      <div className="breadcrumbs">
        <span>Không gian làm việc</span>
        <span className="breadcrumb-slash">/</span>
        <strong>{sectionTitle}</strong>
      </div>
      <div className="topbar-actions">
        <button
          className="search-box global-search-trigger"
          type="button"
          aria-label="Tìm kiếm nhanh"
          onClick={onOpenSearch}
        >
          <Search size={17} />
          <span>Tìm kiếm...</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="header-popover-anchor" ref={notificationsRef}>
          <button
            className="icon-button notification-button"
            aria-label="Thông báo"
            aria-haspopup="dialog"
            aria-expanded={notificationsOpen}
            onClick={() => {
              setAccountOpen(false);
              setNotificationsOpen((current) => !current);
            }}
          >
            <Bell size={18} />
            {unreadCount > 0 && <i />}
          </button>
          {notificationsOpen && (
            <section className="notification-popover" aria-label="Thông báo">
              <header className="notification-popover-header">
                <div>
                  <h2>Thông báo</h2>
                  {unreadCount > 0 && <span>{unreadCount} mới</span>}
                </div>
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  disabled={unreadCount === 0}
                >
                  Đánh dấu tất cả là đã đọc
                </button>
              </header>
              <div className="notification-list">
                {notificationSamples.map((notification) => {
                  const Icon = notification.icon;
                  return (
                    <button
                      className="notification-item"
                      key={notification.id}
                      onClick={() => navigateNotification(notification)}
                    >
                      <span
                        className={`notification-item-icon notification-${notification.tone}`}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="notification-item-copy">
                        <strong>{notification.title}</strong>
                        <span>{notification.message}</span>
                        <small>{notification.time}</small>
                      </span>
                      {unreadCount > 0 && (
                        <i className="notification-unread-dot" />
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                className="notification-see-all"
                onClick={() => {
                  setNotificationsOpen(false);
                  onNavigate("Unified Inbox");
                }}
              >
                Xem tất cả <ArrowRight size={14} />
              </button>
            </section>
          )}
        </div>
        <span className="topbar-divider" />
        <div
          className="header-popover-anchor account-popover-anchor"
          ref={accountRef}
        >
          <button
            className="user-menu"
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            onClick={() => {
              setNotificationsOpen(false);
              setAccountOpen((current) => !current);
            }}
          >
            <Avatar initials="HP" color="lilac" small title="Võ Hồng Phúc" />
            <span className="topbar-user-copy">
              <strong>Võ Hồng Phúc</strong>
              <small>Quản trị viên</small>
            </span>
            <ChevronDown size={15} />
          </button>
          {accountOpen && (
            <div className="header-account-menu" role="menu">
              <button
                role="menuitem"
                onClick={() => navigateSettings({ tab: "profile" })}
              >
                <UserRound size={15} /> Hồ sơ của tôi
              </button>
              <button
                role="menuitem"
                onClick={() => navigateSettings({ tab: "profile" })}
              >
                <Settings size={15} /> Cài đặt hệ thống
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setAccountOpen(false);
                  onToggleTheme();
                }}
              >
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
                {darkMode
                  ? "Chuyển sang chế độ Sáng"
                  : "Chuyển sang chế độ Tối"}
              </button>
              <span className="header-account-divider" />
              <button
                className="header-account-logout"
                role="menuitem"
                onClick={() => {
                  setAccountOpen(false);
                  onLogout();
                }}
              >
                <LogOut size={15} /> Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MetricCard({ metric }) {
  const Icon = metric.icon;
  const Trend = metric.down ? ArrowDownRight : ArrowUpRight;
  return (
    <article className="metric-card">
      <svg
        className={`metric-sparkline metric-sparkline-${metric.tone}`}
        viewBox="0 0 160 44"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline points={metric.sparkline} />
      </svg>
      <div className="metric-top">
        <span className={`metric-icon metric-${metric.tone}`}>
          <Icon size={18} />
        </span>
        <button className="metric-more" aria-label={`Tùy chọn ${metric.label}`}>
          <MoreHorizontal size={19} />
        </button>
      </div>
      <p className="metric-label">{metric.label}</p>
      <div className="metric-bottom">
        <strong className="metric-value">{metric.value}</strong>
        <span
          className={`metric-change ${metric.down ? "down" : ""} ${metric.neutral ? "neutral" : ""}`}
        >
          {!metric.neutral && <Trend size={14} />}
          {metric.change}
        </span>
      </div>
      <p className="metric-footnote">
        {metric.footnote ?? "so với tuần trước"}
      </p>
    </article>
  );
}

function ActivityPanel() {
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <h2>Hoạt động gần đây</h2>
          <p>Cập nhật mới từ nhóm của bạn</p>
        </div>
        <button className="metric-more" aria-label="Thêm tùy chọn">
          <MoreHorizontal size={19} />
        </button>
      </div>
      <div className="activity-list">
        {activity.map((item, index) => (
          <div className="activity-item" key={item.ticket}>
            <div className="activity-avatar-wrap">
              <Avatar initials={item.initials} color={item.color} />
              <span className="activity-indicator">
                {index === 0 ? <Check size={10} /> : <ArrowUpRight size={10} />}
              </span>
            </div>
            <div className="activity-copy">
              <p>
                <strong>{item.name}</strong> {item.action}{" "}
                <a href={`#${item.ticket}`}>{item.ticket}</a>
              </p>
              <span>{item.time}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="team-summary">
        <div className="team-avatars">
          {teamMembers.map((member) => (
            <Avatar
              key={member.initials}
              initials={member.initials}
              color={member.color}
              small
              title={member.name}
            />
          ))}
        </div>
        <span>
          <strong>5 thành viên</strong> đang trực tuyến
        </span>
        <i className="online-indicator" />
      </div>
    </section>
  );
}

function TicketTable({ onViewAll }) {
  return (
    <section className="panel ticket-panel">
      <div className="panel-heading ticket-heading">
        <div>
          <div className="heading-title-row">
            <h2>Yêu cầu gần đây</h2>
            <span className="subtle-count">248</span>
          </div>
          <p>Các yêu cầu cần được chú ý</p>
        </div>
        <button className="text-action" onClick={onViewAll}>
          Xem tất cả <ArrowRight size={15} />
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>YÊU CẦU</th>
              <th>TRẠNG THÁI</th>
              <th>THỜI GIAN</th>
              <th>PHỤ TRÁCH</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <div className="ticket-cell">
                    <Avatar initials={ticket.initials} color={ticket.color} />
                    <div className="ticket-copy">
                      <strong>{ticket.subject}</strong>
                      <span>
                        {ticket.id}
                        <i />
                        {ticket.name}
                        <i />
                        {ticket.channel}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`status status-${ticket.tone}`}>
                    <i />
                    {ticket.status}
                  </span>
                </td>
                <td className="time-cell">{ticket.time}</td>
                <td>
                  <Avatar
                    initials={getTeamMember(ticket.assignee).initials}
                    color={getTeamMember(ticket.assignee).color}
                    small
                    title={getTeamMember(ticket.assignee).name}
                  />
                </td>
                <td>
                  <button
                    className="row-more"
                    aria-label={`Tùy chọn ${ticket.id}`}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const ticketStatuses = [
  "Tất cả",
  "Đang mở",
  "Đang xử lý",
  "Chờ phản hồi",
  "Đã giải quyết",
];

const ticketStatusClasses = {
  "Đang mở": "open",
  "Đang xử lý": "progress",
  "Chờ phản hồi": "waiting",
  "Đã giải quyết": "resolved",
};

const ticketChannelIcons = {
  Email: Mail,
  "Web Form": Globe2,
  Livechat: MessageCircle,
  Hotline: Headset,
};

function TicketManagement({ initialSearch = "" }) {
  const [rows, setRows] = useState(ticketManagementSamples);
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState("Tất cả");
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState({});

  useEffect(() => setSearch(initialSearch), [initialSearch]);

  const selectedTicket = rows.find((ticket) => ticket.id === selectedId);
  const filteredRows = rows.filter((ticket) => {
    const matchesFilter = filter === "Tất cả" || ticket.status === filter;
    const searchableText = `${ticket.id} ${ticket.subject} ${ticket.preview} ${ticket.customer} ${ticket.priority} ${ticket.status} ${ticket.assignee}`;
    return (
      matchesFilter &&
      searchableText.toLowerCase().includes(search.toLowerCase())
    );
  });
  const isShowingAll = filter === "Tất cả" && search.trim() === "";
  const totalCount = isShowingAll ? 248 : filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / 10));
  const visibleStart = totalCount === 0 ? 0 : (page - 1) * 10 + 1;
  const visibleEnd = isShowingAll
    ? Math.min(page * 10, totalCount)
    : Math.min(page * 10, totalCount);
  const pageRows =
    isShowingAll && page > 1
      ? ticketManagementSamples
        .slice(0, visibleEnd - visibleStart + 1)
        .map((ticket, index) => ({
          ...ticket,
          id: `#TK-${String(2852 - (page - 1) * 10 - index).padStart(4, "0")}`,
        }))
      : filteredRows.slice((page - 1) * 10, page * 10);
  const pageNumbers =
    totalPages <= 4
      ? Array.from({ length: totalPages }, (_, index) => index + 1)
      : page <= 3
        ? [1, 2, 3, "...", totalPages]
        : [
          1,
          "...",
          page - 1,
          page,
          Math.min(page + 1, totalPages),
          "...",
          totalPages,
        ];

  const openCreateDialog = () => {
    setEditingId(null);
    setDraft({
      subject: "",
      preview: "",
      customer: "",
      initials: "",
      color: "lilac",
      channel: "Email",
      assignee: teamMembers[0].name,
      priority: "Trung bình",
      status: "Đang mở",
    });
    setDialog("form");
  };

  const openEditDialog = (ticket) => {
    setEditingId(ticket.id);
    setDraft({ ...ticket });
    setOpenMenu(null);
    setDialog("form");
  };

  const saveTicket = (event) => {
    event.preventDefault();
    const initials =
      draft.initials.trim() || draft.customer.trim().slice(0, 2).toUpperCase();
    const ticket = {
      ...draft,
      id: editingId ?? `#TK-${String(2852 + rows.length).padStart(4, "0")}`,
      initials,
      time: editingId
        ? (rows.find((item) => item.id === editingId)?.time ?? "Vừa xong")
        : "Vừa xong",
    };
    setRows((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? ticket : item))
        : [ticket, ...current],
    );
    setPage(1);
    setDialog(null);
  };

  const removeTicket = () => {
    setRows((current) => current.filter((ticket) => ticket.id !== selectedId));
    setDialog(null);
    setSelectedId(null);
    setOpenMenu(null);
  };

  const openDetails = (ticket) => {
    setSelectedId(ticket.id);
    setOpenMenu(null);
    setDialog("details");
  };

  return (
    <div className="ticket-management">
      <div className="ticket-management-heading">
        <div>
          <div className="ticket-management-title-line">
            <h1>Danh sách yêu cầu</h1>
            <span className="ticket-total-badge">248 yêu cầu</span>
          </div>
          <p>Theo dõi, phân công và xử lý các yêu cầu hỗ trợ.</p>
        </div>
        <button
          className="primary-button ticket-create-button"
          onClick={openCreateDialog}
        >
          <Plus size={16} /> Tạo yêu cầu mới
        </button>
      </div>

      <section className="ticket-management-panel">
        <div className="ticket-toolbar">
          <label className="ticket-search">
            <Search size={16} />
            <input
              aria-label="Tìm ticket theo mã hoặc nội dung"
              placeholder="Tìm theo mã ticket hoặc nội dung..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            )}
          </label>
          <span className="ticket-toolbar-summary">
            <i /> Cập nhật trực tiếp
          </span>
        </div>

        <div
          className="ticket-filter-tabs"
          role="tablist"
          aria-label="Lọc theo trạng thái"
        >
          {ticketStatuses.map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={filter === status}
              className={filter === status ? "ticket-filter-active" : ""}
              onClick={() => {
                setFilter(status);
                setPage(1);
              }}
            >
              {status}
              {status === "Tất cả" && <span>248</span>}
            </button>
          ))}
        </div>

        <div className="ticket-management-scroll">
          <table className="ticket-management-table">
            <thead>
              <tr>
                <th>YÊU CẦU</th>
                <th>KHÁCH HÀNG</th>
                <th>KÊNH</th>
                <th>NGƯỜI PHỤ TRÁCH</th>
                <th>ƯU TIÊN</th>
                <th>TRẠNG THÁI</th>
                <th>THỜI GIAN</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((ticket) => {
                const assignee = getTeamMember(ticket.assignee);
                const ChannelIcon = ticketChannelIcons[ticket.channel] ?? Mail;
                const priorityClass =
                  ticket.priority === "Cao"
                    ? "high"
                    : ticket.priority === "Thấp"
                      ? "low"
                      : "medium";
                return (
                  <tr key={ticket.id}>
                    <td>
                      <div className="management-ticket-cell">
                        <strong className="management-ticket-id">
                          {ticket.id}
                        </strong>
                        <span className="management-ticket-subject">
                          {ticket.subject}
                        </span>
                        <small>{ticket.preview}</small>
                      </div>
                    </td>
                    <td>
                      <div className="management-person-cell">
                        <Avatar
                          initials={ticket.initials}
                          color={ticket.color}
                          title={ticket.customer}
                        />
                        <span>{ticket.customer}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`management-channel channel-${ticket.channel.toLowerCase().replaceAll(" ", "-")}`}
                      >
                        <ChannelIcon size={15} /> {ticket.channel}
                      </span>
                    </td>
                    <td>
                      <div className="management-person-cell management-assignee">
                        <Avatar
                          initials={assignee.initials}
                          color={assignee.color}
                          small
                          title={assignee.name}
                        />
                        <span>{assignee.name}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`ticket-priority ticket-priority-${priorityClass}`}
                      >
                        <i />
                        {ticket.priority}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`ticket-status ticket-status-${ticketStatusClasses[ticket.status]}`}
                      >
                        <i />
                        {ticket.status}
                      </span>
                    </td>
                    <td>
                      <time className="management-time">{ticket.time}</time>
                    </td>
                    <td>
                      <div className="ticket-row-actions">
                        <button
                          className="icon-button ticket-row-menu-button"
                          aria-label={`Thao tác ${ticket.id}`}
                          aria-expanded={openMenu === ticket.id}
                          onClick={() =>
                            setOpenMenu(
                              openMenu === ticket.id ? null : ticket.id,
                            )
                          }
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {openMenu === ticket.id && (
                          <div className="ticket-action-menu">
                            <button onClick={() => openDetails(ticket)}>
                              <Eye size={15} /> Mở xem chi tiết
                            </button>
                            <button onClick={() => openEditDialog(ticket)}>
                              <Pencil size={15} /> Chỉnh sửa
                            </button>
                            <button
                              className="ticket-action-danger"
                              onClick={() => {
                                setSelectedId(ticket.id);
                                setOpenMenu(null);
                                setDialog("delete");
                              }}
                            >
                              <Trash2 size={15} /> Xóa yêu cầu
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td className="ticket-empty-cell" colSpan={8}>
                    Không tìm thấy yêu cầu phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="ticket-pagination">
          <span>
            Hiển thị {visibleStart}-{visibleEnd} trong tổng số {totalCount} yêu
            cầu
          </span>
          <nav aria-label="Phân trang yêu cầu">
            <button
              className="pagination-arrow"
              aria-label="Trang trước"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={15} /> Trước
            </button>
            {pageNumbers.map((pageNumber, index) =>
              pageNumber === "..." ? (
                <span className="pagination-ellipsis" key={`ellipsis-${index}`}>
                  …
                </span>
              ) : (
                <button
                  key={pageNumber}
                  className={`pagination-page ${page === pageNumber ? "pagination-page-active" : ""}`}
                  aria-current={page === pageNumber ? "page" : undefined}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ),
            )}
            <button
              className="pagination-arrow"
              aria-label="Trang sau"
              disabled={page === totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Sau <ChevronRight size={15} />
            </button>
          </nav>
        </footer>
      </section>

      {dialog && (
        <div
          className="ticket-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialog(null);
          }}
        >
          <section
            className="ticket-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-dialog-title"
          >
            <header className="ticket-dialog-header">
              <div>
                <span className="ticket-dialog-eyebrow">
                  HELPDESK · YÊU CẦU
                </span>
                <h2 id="ticket-dialog-title">
                  {dialog === "delete"
                    ? "Xóa yêu cầu?"
                    : dialog === "details"
                      ? `Chi tiết ${selectedTicket?.id ?? "ticket"}`
                      : editingId
                        ? "Chỉnh sửa yêu cầu"
                        : "Tạo yêu cầu mới"}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Đóng"
                onClick={() => setDialog(null)}
              >
                <X size={18} />
              </button>
            </header>
            {dialog === "form" ? (
              <form className="ticket-dialog-form" onSubmit={saveTicket}>
                <label>
                  Tiêu đề yêu cầu
                  <input
                    required
                    value={draft.subject ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, subject: event.target.value })
                    }
                    placeholder="Ví dụ: Không thể đăng nhập tài khoản"
                  />
                </label>
                <label>
                  Nội dung xem trước
                  <textarea
                    required
                    rows={3}
                    value={draft.preview ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, preview: event.target.value })
                    }
                    placeholder="Tóm tắt nội dung khách hàng cần hỗ trợ"
                  />
                </label>
                <div className="ticket-dialog-form-grid">
                  <label>
                    Khách hàng
                    <input
                      required
                      value={draft.customer ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, customer: event.target.value })
                      }
                      placeholder="Tên khách hàng"
                    />
                  </label>
                  <label>
                    Initial avatar
                    <input
                      maxLength={3}
                      value={draft.initials ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, initials: event.target.value })
                      }
                      placeholder="VD"
                    />
                  </label>
                  <label>
                    Kênh tiếp nhận
                    <select
                      value={draft.channel}
                      onChange={(event) =>
                        setDraft({ ...draft, channel: event.target.value })
                      }
                    >
                      <option>Email</option>
                      <option>Web Form</option>
                      <option>Livechat</option>
                      <option>Hotline</option>
                    </select>
                  </label>
                  <label>
                    Người phụ trách
                    <select
                      value={draft.assignee}
                      onChange={(event) =>
                        setDraft({ ...draft, assignee: event.target.value })
                      }
                    >
                      {teamMembers.map((member) => (
                        <option key={member.initials} value={member.name}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Độ ưu tiên
                    <select
                      value={draft.priority}
                      onChange={(event) =>
                        setDraft({ ...draft, priority: event.target.value })
                      }
                    >
                      <option>Cao</option>
                      <option>Trung bình</option>
                      <option>Thấp</option>
                    </select>
                  </label>
                  <label>
                    Trạng thái
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDraft({ ...draft, status: event.target.value })
                      }
                    >
                      {ticketStatuses.slice(1).map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <footer className="ticket-dialog-actions">
                  <button
                    type="button"
                    className="ticket-secondary-button"
                    onClick={() => setDialog(null)}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="primary-button">
                    <Check size={15} /> Lưu yêu cầu
                  </button>
                </footer>
              </form>
            ) : dialog === "details" && selectedTicket ? (
              <div className="ticket-detail-content">
                <span className="ticket-detail-id">{selectedTicket.id}</span>
                <h3>{selectedTicket.subject}</h3>
                <p>{selectedTicket.preview}</p>
                <dl>
                  <div>
                    <dt>Khách hàng</dt>
                    <dd>{selectedTicket.customer}</dd>
                  </div>
                  <div>
                    <dt>Kênh tiếp nhận</dt>
                    <dd>{selectedTicket.channel}</dd>
                  </div>
                  <div>
                    <dt>Người phụ trách</dt>
                    <dd>{selectedTicket.assignee}</dd>
                  </div>
                  <div>
                    <dt>Độ ưu tiên</dt>
                    <dd>{selectedTicket.priority}</dd>
                  </div>
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>{selectedTicket.status}</dd>
                  </div>
                  <div>
                    <dt>Thời gian</dt>
                    <dd>{selectedTicket.time}</dd>
                  </div>
                </dl>
                <footer className="ticket-dialog-actions">
                  <button
                    className="ticket-secondary-button"
                    onClick={() => setDialog(null)}
                  >
                    Đóng
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => openEditDialog(selectedTicket)}
                  >
                    <Pencil size={15} /> Chỉnh sửa
                  </button>
                </footer>
              </div>
            ) : (
              <div className="ticket-delete-content">
                <p>
                  Yêu cầu <strong>{selectedTicket?.id}</strong> sẽ bị xóa khỏi
                  danh sách mẫu.
                </p>
                <footer className="ticket-dialog-actions">
                  <button
                    className="ticket-secondary-button"
                    onClick={() => setDialog(null)}
                  >
                    Giữ lại
                  </button>
                  <button
                    className="ticket-delete-button"
                    onClick={removeTicket}
                  >
                    <Trash2 size={15} /> Xóa yêu cầu
                  </button>
                </footer>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function SectionPlaceholder({ section, onDashboard }) {
  const current = navigation.find((item) => item.label === section);
  const Icon = current?.icon ?? Activity;
  return (
    <div className="empty-section">
      <span className="empty-section-icon">
        <Icon size={24} />
      </span>
      <h2>{current?.title ?? section}</h2>
      <p>Khu vực này đã sẵn sàng để kết nối với dữ liệu của bạn.</p>
      <button className="primary-button" onClick={onDashboard}>
        <LayoutDashboard size={16} />
        Về tổng quan
      </button>
    </div>
  );
}

function AuthPage({ mode, onLogin }) {
  const isRegister = mode === "register";
  const location = useLocation();
  const navigate = useNavigate();
  const rememberedEmail =
    localStorage.getItem("helpdesk-remembered-email") ?? "";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(() =>
    isRegister ? "" : (location.state?.email ?? rememberedEmail),
  );
  const [role, setRole] = useState("support");
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedEmail));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice ?? "");

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");

    if (isRegister) {
      if (password !== formData.get("confirmPassword")) {
        setError("Mật khẩu xác nhận chưa khớp.");
        return;
      }
      navigate("/login", {
        replace: true,
        state: {
          email,
          notice: "Tạo tài khoản thành công. Bạn có thể đăng nhập để tiếp tục.",
        },
      });
      return;
    }

    if (rememberMe) {
      localStorage.setItem("helpdesk-remembered-email", email);
    } else {
      localStorage.removeItem("helpdesk-remembered-email");
    }
    onLogin();
  };

  return (
    <div className="auth-shell">
      <aside className="auth-brand-panel">
        <div className="auth-brand-lockup">
          <span className="auth-brand-mark">
            <Headset size={22} />
          </span>
          <span>HelpDesk</span>
        </div>
        <div className="auth-brand-copy">
          <span className="auth-kicker">KHÔNG GIAN HỖ TRỢ</span>
          <h1>Mọi cuộc trò chuyện, trong tầm tay.</h1>
          <p>HelpDesk · Nền tảng chăm sóc khách hàng</p>
        </div>
        <div className="auth-brand-footer">
          <span className="auth-status-dot" />
          Hệ thống hỗ trợ đang hoạt động
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-form-wrap">
          <div className="auth-main-brand">
            <span className="auth-brand-mark">
              <Headset size={20} />
            </span>
            <strong>HelpDesk</strong>
          </div>
          <header className="auth-form-header">
            <span className="auth-kicker">
              {isRegister ? "BẮT ĐẦU CÙNG HELPDESK" : "CHÀO MỪNG TRỞ LẠI"}
            </span>
            <h2>{isRegister ? "Tạo tài khoản" : "Đăng nhập"}</h2>
            <p>
              {isRegister
                ? "Điền thông tin để tạo tài khoản làm việc."
                : "Đăng nhập để tiếp tục đến không gian làm việc."}
            </p>
          </header>

          {notice && (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <label className="auth-field" htmlFor="fullName">
                <span>Họ và tên</span>
                <span className="auth-input-wrap">
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Nhập họ và tên"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                  />
                </span>
              </label>
            )}

            <label className="auth-field" htmlFor="authEmail">
              <span>Email</span>
              <span className="auth-input-wrap">
                <Mail size={17} />
                <input
                  id="authEmail"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </span>
            </label>

            {isRegister && (
              <label className="auth-field" htmlFor="authRole">
                <span>Vai trò</span>
                <span className="auth-input-wrap auth-select-wrap">
                  <ShieldCheck size={17} />
                  <select
                    id="authRole"
                    name="role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                  >
                    <option value="support">Nhân viên CSKH</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                  <ChevronDown size={15} />
                </span>
              </label>
            )}

            <label className="auth-field" htmlFor="authPassword">
              <span>Mật khẩu</span>
              <span className="auth-input-wrap">
                <LockKeyhole size={17} />
                <input
                  id="authPassword"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập mật khẩu"
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  minLength={isRegister ? 8 : undefined}
                  required
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {isRegister && (
              <label className="auth-field" htmlFor="confirmPassword">
                <span>Xác nhận mật khẩu</span>
                <span className="auth-input-wrap">
                  <LockKeyhole size={17} />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmation ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    aria-label={
                      showConfirmation ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                    }
                    onClick={() => setShowConfirmation(!showConfirmation)}
                  >
                    {showConfirmation ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </span>
              </label>
            )}

            {!isRegister && (
              <label className="remember-row">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>
            )}

            <button className="auth-submit" type="submit">
              {isRegister ? "Tạo tài khoản" : "Đăng nhập"}
              <ArrowRight size={17} />
            </button>
          </form>

          <p className="auth-switch">
            {isRegister ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
            <Link to={isRegister ? "/login" : "/register"}>
              {isRegister ? "Đăng nhập" : "Đăng ký ngay"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function App() {
  const location = useLocation();
  const routeNavigate = useNavigate();
  const [active, setActive] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("profile");
  const [settingsRequest, setSettingsRequest] = useState(0);
  const [focusPassword, setFocusPassword] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [ticketSearch, setTicketSearch] = useState("");
  const [inboxSearch, setInboxSearch] = useState("");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(3);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("helpdesk-theme") === "dark",
  );
  const pathname = location.pathname.replace(/\/+$/, "") || "/";

  useEffect(() => {
    localStorage.setItem("helpdesk-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const handleGlobalShortcut = (event) => {
      if (
        pathname !== "/login" &&
        pathname !== "/register" &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, [pathname]);

  useEffect(() => {
    document.title =
      pathname === "/login"
        ? "Đăng nhập | HelpDesk"
        : pathname === "/register"
          ? "Đăng ký | HelpDesk"
          : "HelpDesk | Tổng quan";
  }, [pathname]);

  if (pathname === "/customer-portal") {
    return (
      <CustomerPortal
        onSubmitTicket={(payload) => ticketService.createTicket(payload)}
        onUploadAttachment={(file) => ticketService.uploadAttachment(file)}
      />
    );
  }

  if (pathname === "/login") {
    return (
      <AuthPage
        key="login"
        mode="login"
        onLogin={() => {
          setActive("Dashboard");
          routeNavigate("/", { replace: true });
        }}
      />
    );
  }

  if (pathname === "/register") {
    return <AuthPage key="register" mode="register" onLogin={() => { }} />;
  }

  const navigate = (section, options = {}) => {
    setActive(section);
    setSidebarOpen(false);
    setTicketSearch(section === "Ticket List" ? (options.search ?? "") : "");
    setInboxSearch(section === "Unified Inbox" ? (options.search ?? "") : "");
    if (section === "Settings") {
      setSettingsTab(options.tab ?? "profile");
      setSettingsRequest((current) => current + 1);
      setFocusPassword(Boolean(options.focusPassword));
    } else {
      setFocusPassword(false);
    }
  };
  const handleLogout = () => {
    setGlobalSearchOpen(false);
    setActive("Dashboard");
    setSidebarOpen(false);
    routeNavigate("/login");
  };
  const selectGlobalSearchResult = (result) => {
    navigate(result.destination, { search: result.search });
    setGlobalSearchOpen(false);
  };
  return (
    <div className={`app-shell ${darkMode ? "app-shell-dark" : ""}`}>
      <Sidebar
        active={active}
        onNavigate={navigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((current) => !current)}
      />
      <main className="main-area">
        <Header
          onMenu={() => setSidebarOpen(true)}
          onLogout={handleLogout}
          onNavigate={navigate}
          onOpenSearch={() => setGlobalSearchOpen(true)}
          onToggleTheme={() => setDarkMode((current) => !current)}
          unreadCount={unreadNotificationCount}
          onMarkAllRead={() => setUnreadNotificationCount(0)}
          darkMode={darkMode}
          sectionTitle={
            navigation.find((item) => item.label === active)?.title ??
            "Tổng quan"
          }
        />
        {active === "Dashboard" ? (
          <div className="dashboard-content">
            <div className="welcome-row">
              <div>
                <div className="eyebrow">
                  <span />
                  THỨ HAI, 14 THÁNG 10, 2024
                </div>
                <h1>
                  Chào buổi sáng, Võ Hồng Phúc <span className="wave">✳</span>
                </h1>
                <p>Đây là những gì đang diễn ra với nhóm hỗ trợ của bạn.</p>
              </div>
              <button
                className="primary-button"
                onClick={() => navigate("Ticket List")}
              >
                <Plus size={17} />
                Tạo yêu cầu mới
              </button>
            </div>
            <section className="metrics-grid" aria-label="Chỉ số tổng quan">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </section>
            <div className="dashboard-grid">
              <Suspense
                fallback={
                  <div
                    className="panel dashboard-chart-fallback"
                    aria-label="Đang tải biểu đồ ticket"
                  />
                }
              >
                <PerformanceChart />
              </Suspense>
              <Suspense
                fallback={
                  <div
                    className="panel dashboard-chart-fallback"
                    aria-label="Đang tải biểu đồ nguồn tin nhắn"
                  />
                }
              >
                <MessageSourceChart />
              </Suspense>
              <ActivityPanel />
            </div>
            <TicketTable onViewAll={() => navigate("Ticket List")} />
            <footer className="dashboard-footer">
              <span>
                <i className="footer-status" />
                Tất cả hệ thống đang hoạt động
              </span>
              <span>Cập nhật lần cuối: vừa xong</span>
            </footer>
          </div>
        ) : active === "Unified Inbox" ? (
          <InboxScreen initialQuery={inboxSearch} />
        ) : active === "Ticket List" ? (
          <TicketManagement initialSearch={ticketSearch} />
        ) : active === "Settings" ? (
          <SettingsPage
            key={settingsRequest}
            defaultTab={settingsTab}
            focusPassword={focusPassword}
          />
        ) : (
          <div className="dashboard-content section-content">
            <SectionPlaceholder
              section={active}
              onDashboard={() => navigate("Dashboard")}
            />
          </div>
        )}
      </main>
      {globalSearchOpen && (
        <GlobalSearchModal
          onClose={() => setGlobalSearchOpen(false)}
          onSelect={selectGlobalSearchResult}
        />
      )}
    </div>
  );
}

export default App;
