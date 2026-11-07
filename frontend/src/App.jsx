import { getTicketTriage, getTicketStatus } from "./services/ticket-triage.js";
import { ticketService, watchTickets } from "./services/ticket.service.js";
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
  { label: "Unified Inbox", title: "Hộp thư", icon: Inbox },
  { label: "Ticket List", title: "Danh sách yêu cầu", icon: FileText },
  { label: "Settings", title: "Cài đặt", icon: Settings },
];

const teamMembers = [
  { name: "Võ Ngọc Phú", initials: "NP", color: "mint" },
  { name: "Võ Thị Thu Lộc", initials: "TL", color: "peach" },
  { name: "Võ Hồng Phúc", initials: "HP", color: "lilac" },
  { name: "Trương Đình Thảo Đoan", initials: "TĐ", color: "blue" },
];

const ticketManagementSamples = [];

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
    value: "0",
    change: "0%",
    icon: Inbox,
    tone: "green",
    sparkline: "0,33 18,29 36,31 54,20 72,24 90,15 108,18 126,8 144,10 160,2",
  },
  {
    label: "Ticket đã xong",
    value: "0",
    change: "đạt chuẩn",
    icon: Check,
    tone: "blue",
    sparkline: "0,29 18,33 36,24 54,26 72,17 90,22 108,12 126,14 144,5 160,8",
  },
  {
    label: "Ticket đang chờ",
    value: "0",
    change: "Đang trống",
    icon: Clock3,
    tone: "amber",
    down: false,
    sparkline: "0,5 18,10 36,8 54,18 72,15 90,24 108,21 126,31 144,28 160,39",
  },
  {
    label: "Thời gian phản hồi TB (SLA)",
    value: "< 2 giờ",
    change: "đạt mục tiêu",
    footnote: "SLA chuẩn < 2 giờ",
    icon: Activity,
    tone: "coral",
    neutral: true,
    sparkline: "0,31 18,24 36,27 54,19 72,22 90,14 108,17 126,10 144,12 160,5",
  },
];

const tickets = [];

const activity = [];

const initialConversations = [];

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

function formatRelativeTime(dateInput) {
  if (!dateInput) return "Vừa xong";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "Vừa xong";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "Vừa xong";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

function formatClockTime(dateInput) {
  if (!dateInput) {
    const now = new Date();
    return now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "Vừa xong";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDateHeader(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const timeStr = formatClockTime(d);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `HÔM NAY, ${timeStr}`;
  }
  const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  return `${dateStr}, ${timeStr}`;
}

function calculateSla(dateInput, isUrgent) {
  if (!dateInput) return { sla: isUrgent ? "Còn 30 phút" : "Còn 2 giờ", slaPercent: 80 };
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return { sla: isUrgent ? "Còn 30 phút" : "Còn 2 giờ", slaPercent: 80 };
  const totalMinutes = isUrgent ? 30 : 120;
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  const remainingMinutes = totalMinutes - elapsedMinutes;
  if (remainingMinutes <= 0) {
    return { sla: "Quá hạn SLA", slaPercent: 100 };
  }
  const percent = Math.min(100, Math.round(((totalMinutes - remainingMinutes) / totalMinutes) * 100));
  if (remainingMinutes < 60) {
    return { sla: `Còn ${remainingMinutes} phút`, slaPercent: percent };
  }
  const hours = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;
  return { sla: `Còn ${hours} giờ ${mins > 0 ? `${mins}p` : ""}`.trim(), slaPercent: percent };
}

const unifiedTickets = [];

const currentAgent = "Võ Ngọc Phú";

function TicketFeedStatus({ state }) {
  if (state === "ready") return null;
  return <p className="ticket-feed-status" role="status">
    {state === "loading" ? "Đang tải yêu cầu…" : "Chưa cập nhật được dữ liệu. Hệ thống sẽ tự thử lại."}
  </p>;
}

function TriageBadge({ ticket }) {
  return <span
    className={"unified-sentiment sentiment-" + (ticket.sentiment || ticket.aiStatus || "skipped")}
    title={ticket.aiReason || ticket.sentimentLabel || "Chưa phân tích AI"}
  >
    {ticket.sentimentLabel || "Chưa phân tích AI"}
    {ticket.sentimentScore != null && <strong>{ticket.sentimentScore}</strong>}
  </span>;
}

function TriageDetails({ ticket }) {
  return <section className="ticket-detail-panel ai-triage-details" aria-label="Kết quả phân tích AI">
    <h3><Sparkles size={15} /> Kết quả phân tích AI</h3>
    <TriageBadge ticket={ticket} />
    {ticket.aiReason && <p>{ticket.aiReason}</p>}
    {ticket.urgencyScore != null && <p>Mức khẩn cấp AI đánh giá · {ticket.urgencyScore}</p>}
    {ticket.aiKeywords?.length > 0 && <p>Dấu hiệu nhận diện · {ticket.aiKeywords.join(" · ")}</p>}
    {ticket.aiModel && <p className="ai-model-name">Model · {ticket.aiModel}</p>}
    {ticket.isAiBumped && <p className="ai-bump-label">AI đã nâng ưu tiên lên khẩn cấp</p>}
  </section>;
}

function InboxScreen({ initialQuery = "" }) {
  const [feedState, setFeedState] = useState("loading");
  const [ticketList, setTicketList] = useState([]);
  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState("Tất cả");
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [assignedTickets, setAssignedTickets] = useState({});
  const [ticketStatuses, setTicketStatuses] = useState({});
  const [repliesByTicket, setRepliesByTicket] = useState({});
  const [draft, setDraft] = useState("");
  const [aiDraftOpen, setAiDraftOpen] = useState(true);
  const [attachmentName, setAttachmentName] = useState("");
  const attachmentRef = useRef(null);
  const timelineEndRef = useRef(null);

  useEffect(() => {
    if (selectedTicketId) {
      timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedTicketId, repliesByTicket]);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  useEffect(() => watchTickets(
    { limit: 50 },
    (items) => {
            const mapped = items.map((rt) => {
              const custName =
                rt.customer?.full_name ||
                rt.customer_name ||
                rt.customer?.name ||
                "Khách hàng";
              const rawInitials = custName
                ? custName
                    .trim()
                    .split(/\s+/)
                    .map((w) => w[0])
                    .slice(-2)
                    .join("")
                    .toUpperCase()
                : "KH";
              const firstMsg =
                rt.description ||
                rt.messages?.[0]?.content ||
                rt.messages?.[rt.messages.length - 1]?.content ||
                "";
              const attachment =
                rt.messages?.[0]?.attachments ||
                rt.messages?.find((m) => m.attachments)?.attachments ||
                rt.attachment_url ||
                null;
              return {
                ...getTicketTriage(rt),
                id: rt.ticket_code || rt.id || `#TK-${String(rt.id).slice(0, 4)}`,
                customer: custName,
                initials: rawInitials || "KH",
                email: rt.customer?.email || rt.customer_email || "customer@example.com",
                phone: rt.customer?.phone || rt.customer_phone || "+84 900 000 000",
                company: rt.customer?.company || "Khách hàng cá nhân",
                plan: rt.customer?.plan || "Gói tiêu chuẩn",
                subject: rt.subject || "Yêu cầu hỗ trợ",
                channel:
                  rt.channel?.channel_type === "telegram" || rt.channel_type === "telegram"
                    ? "Telegram"
                    : rt.channel?.channel_type === "email" || rt.channel_type === "email"
                      ? "Email"
                      : "Web Form",
                channelTone:
                  rt.channel?.channel_type === "telegram" || rt.channel_type === "telegram"
                    ? "indigo"
                    : rt.channel?.channel_type === "email" || rt.channel_type === "email"
                      ? "sky"
                      : "teal",
                priority: rt.is_urgent_bumped
                  ? "🔥 AI Urgent (Priority Bump)"
                  : rt.priority === "urgent"
                    ? "Khẩn cấp"
                    : rt.priority === "high"
                      ? "High"
                      : "Normal",
                priorityTone:
                  rt.is_urgent_bumped || rt.priority === "urgent"
                    ? "urgent"
                    : rt.priority === "high"
                      ? "high"
                      : "normal",
                assignee: rt.assigned_agent?.full_name || rt.assignee?.name || rt.assignee_name || "",
                status: getTicketStatus(rt.status),
                created_at: rt.created_at || new Date().toISOString(),
                time: formatRelativeTime(rt.created_at),
                sla: calculateSla(rt.created_at, rt.is_urgent_bumped || rt.priority === "urgent").sla,
                slaPercent: calculateSla(rt.created_at, rt.is_urgent_bumped || rt.priority === "urgent").slaPercent,
                preview: firstMsg ? (firstMsg.slice(0, 75) + "...") : (rt.subject || "Yêu cầu hỗ trợ"),
                message: firstMsg || rt.subject || "Khách hàng không để lại nội dung chi tiết.",
                attachment,
                draftReply:
                  rt.ai_draft_reply ||
                  "Chào bạn, cảm ơn bạn đã gửi yêu cầu. Chúng tôi đang xử lý và sẽ phản hồi sớm nhất có thể.",
              };
            });
setTicketList(mapped);
setFeedState("ready");
}, () => setFeedState("error"),
), []);

  const selectedTicket = ticketList.find((t) => t.id === selectedTicketId);
  const selectedStatus = selectedTicket
    ? ticketStatuses[selectedTicket.id] ?? selectedTicket.status
    : "OPEN";

  const visibleTickets = ticketList.filter((ticket) => {
    const assignedTo = assignedTickets[ticket.id] ?? ticket.assignee;
    const matchesQuery =
      `${ticket.id} ${ticket.customer} ${ticket.subject} ${ticket.channel}`
        .toLowerCase()
        .includes(query.toLowerCase());
    const matchesFilter =
      activeFilter === "Khẩn cấp"
        ? ticket.priorityTone === "urgent"
        : activeFilter === "Chưa phân công"
          ? !assignedTo
          : activeFilter === "Của tôi"
            ? assignedTo === currentAgent
            : true;
    return matchesQuery && matchesFilter;
  });

  const sendReply = (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setRepliesByTicket((current) => ({
      ...current,
      [selectedTicketId]: [...(current[selectedTicketId] ?? []), draft.trim()],
    }));
    setDraft("");
    setAttachmentName("");
  };

  const assignToMe = () => {
    if (!selectedTicket) return;
    setAssignedTickets((current) => ({
      ...current,
      [selectedTicket.id]: currentAgent,
    }));
  };

  const handleAssignChange = (newAssignee) => {
    if (!selectedTicket) return;
    setAssignedTickets((current) => ({
      ...current,
      [selectedTicket.id]: newAssignee,
    }));
  };

  return (
    <section className="unified-inbox">
      {!selectedTicket ? (
        <div className="unified-queue">
          <div className="unified-queue-heading">
            <div>
              <span className="inbox-eyebrow">CUSTOMER SUPPORT / INBOX</span>
              <h1>Unified Inbox Queue</h1>
              <p>Ưu tiên những cuộc hội thoại cần được xử lý ngay.</p>
            </div>
            <div className="queue-live-status">
              <i /> Live queue <span>{ticketList.length} tickets</span>
            </div>
          </div>
          <div className="unified-queue-toolbar">
            <div className="unified-filter-tabs" role="tablist" aria-label="Lọc hàng đợi">
              {[
                ["Tất cả", String(ticketList.length)],
                [
                  "Khẩn cấp",
                  String(ticketList.filter((t) => t.priorityTone === "urgent").length),
                ],
                [
                  "Chưa phân công",
                  String(
                    ticketList.filter(
                      (t) => !(assignedTickets[t.id] ?? t.assignee),
                    ).length,
                  ),
                ],
                [
                  "Của tôi",
                  String(
                    ticketList.filter(
                      (t) => (assignedTickets[t.id] ?? t.assignee) === currentAgent,
                    ).length,
                  ),
                ],
              ].map(([label, count]) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === label}
                  className={activeFilter === label ? "unified-filter-active" : ""}
                  key={label}
                  onClick={() => setActiveFilter(label)}
                >
                  {label === "Khẩn cấp" && <span aria-hidden="true">🔥 </span>}
                  {label} <span className="unified-filter-count">{count}</span>
                </button>
              ))}
            </div>
            <label className="unified-queue-search">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Tìm trong hàng đợi"
                placeholder="Tìm vé, khách hàng..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <TicketFeedStatus state={feedState} />
          <div className="unified-ticket-list">
            {visibleTickets.map((ticket) => {
              const assignedPerson = assignedTickets[ticket.id] ?? ticket.assignee;
              const member = getTeamMember(assignedPerson);
              return (
                <button
                  type="button"
                  className={`unified-ticket-card ${
                    ticket.priorityTone === "urgent" ? "unified-ticket-urgent" : ""
                  }`}
                  key={ticket.id}
                  onClick={() => {
                    setSelectedTicketId(ticket.id);
                    setAiDraftOpen(true);
                  }}
                >
                  <span className="unified-ticket-topline">
                    <span className="unified-ticket-id">{ticket.id}</span>
                    <span
                      className={`unified-channel-badge channel-tone-${ticket.channelTone}`}
                    >
                      {ticket.channel === "Email" ? (
                        <Mail size={13} />
                      ) : ticket.channel === "Telegram" ? (
                        <Send size={13} />
                      ) : (
                        <Globe2 size={13} />
                      )}
                      {ticket.channel}
                    </span>
                    <time>{ticket.time}</time>
                    <MoreHorizontal size={17} aria-hidden="true" />
                  </span>
                  <span className="unified-ticket-person">
                    <Avatar
                      initials={ticket.initials}
                      color={ticket.priorityTone === "urgent" ? "peach" : "mint"}
                    />
                    <strong>{ticket.customer}</strong>
                  </span>
                  <span className="unified-ticket-subject">{ticket.subject}</span>
                  <span className="unified-ticket-preview">{ticket.preview}</span>
                  <span className="unified-ticket-bottom">
                    <span
                      className={`unified-priority-badge priority-tone-${ticket.priorityTone}`}
                    >
                      {ticket.priority}
                    </span>
                    <TriageBadge ticket={ticket} />
                    <span className="unified-ticket-assignee">
                      <Avatar
                        initials={assignedPerson ? member.initials : "?"}
                        color={assignedPerson ? member.color : "slate"}
                        small
                      />
                      {assignedPerson || "Chưa phân công"}
                    </span>
                    <span
                      className={`unified-ticket-status ${
                        (ticketStatuses[ticket.id] ?? ticket.status) === "CLOSED"
                          ? "is-closed"
                          : ""
                      }`}
                    >
                      <i /> {ticketStatuses[ticket.id] ?? ticket.status}
                    </span>
                  </span>
                </button>
              );
            })}
            {visibleTickets.length === 0 && (
              <div className="unified-empty-state" style={{ padding: "3.5rem 1.5rem", textAlign: "center", color: "#6b7280" }}>
                <Inbox size={42} style={{ margin: "0 auto 12px", opacity: 0.4, color: "#10b981" }} />
                <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937", marginBottom: "6px" }}>
                  Hàng đợi hiện đang trống
                </h3>
                <p style={{ fontSize: "13px", maxWidth: "420px", margin: "0 auto", lineHeight: "1.5" }}>
                  Chưa có yêu cầu hỗ trợ nào trong hệ thống. Khi khách hàng gửi yêu cầu qua Web Portal, Email hoặc Telegram, vé mới sẽ tự động hiển thị tại đây.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="ticket-detail-view">
          <header className="ticket-detail-header">
            <div className="ticket-detail-title">
              <button
                type="button"
                className="detail-back-button"
                onClick={() => setSelectedTicketId(null)}
              >
                <ChevronLeft size={17} /> Quay lại
              </button>
              <div>
                <span className="inbox-eyebrow">
                  TICKET DETAIL / {selectedTicket.channel.toUpperCase()}
                </span>
                <h1>
                  <span>{selectedTicket.id}</span> —{" "}
                  {selectedTicket.subject.replace("...", "")}
                </h1>
              </div>
            </div>
            <div className="ticket-detail-actions">
              <span
                className={`detail-status-pill ${
                  selectedStatus === "CLOSED" ? "detail-status-closed" : ""
                }`}
              >
                <i /> {selectedStatus}
              </span>
              <span
                className={`detail-priority-pill ${
                  selectedTicket.priorityTone !== "urgent"
                    ? "detail-priority-other"
                    : ""
                }`}
              >
                <i /> PRIORITY:{" "}
                {selectedTicket.priorityTone === "urgent"
                  ? "URGENT"
                  : selectedTicket.priority.toUpperCase()}
              </span>
              <button
                type="button"
                className="detail-assign-button"
                onClick={assignToMe}
              >
                <UserRound size={15} />{" "}
                {assignedTickets[selectedTicket.id]
                  ? "Đã phân công"
                  : "Phân công cho tôi"}
              </button>
              <button
                type="button"
                className="detail-status-button"
                onClick={() =>
                  setTicketStatuses((current) => ({
                    ...current,
                    [selectedTicket.id]:
                      selectedStatus === "OPEN" ? "CLOSED" : "OPEN",
                  }))
                }
              >
                {selectedStatus === "OPEN" ? "Đổi trạng thái" : "Mở lại vé"}{" "}
                <ChevronDown size={14} />
              </button>
            </div>
          </header>

          <div className="ticket-detail-content">
            {/* CỘT TRÁI: TIMELINE HỘI THOẠI & SOẠN THẢO */}
            <div className="ticket-detail-main">
              <div className="ticket-timeline">
                <div className="timeline-date">
                  <span /> {formatDateHeader(selectedTicket.created_at)} <span />
                </div>
                <article className="customer-message">
                  <Avatar initials={selectedTicket.initials} color="peach" />
                  <div className="customer-message-content">
                    <div className="customer-message-meta">
                      <strong>{selectedTicket.customer}</strong>
                      <time>{formatClockTime(selectedTicket.created_at)} · {selectedTicket.channel}</time>
                    </div>
                    <div className="customer-message-bubble">
                      <p>
                        {selectedTicket.message ||
                          selectedTicket.preview ||
                          selectedTicket.subject ||
                          "Khách hàng không để lại nội dung chi tiết."}
                      </p>
                      {selectedTicket.attachment && (
                        <div
                          className="customer-attachment-card"
                          aria-label="Tệp đính kèm của khách hàng"
                        >
                          <div className="customer-attachment-head">
                            <Paperclip size={14} />
                            <span>TỆP ĐÍNH KÈM TỪ KHÁCH HÀNG</span>
                          </div>
                          {selectedTicket.attachment.startsWith("data:image/") ||
                          /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(selectedTicket.attachment) ||
                          (selectedTicket.attachment.startsWith("http") && !selectedTicket.attachment.endsWith(".pdf")) ? (
                            <a
                              href={selectedTicket.attachment}
                              target="_blank"
                              rel="noreferrer"
                              title="Bấm để xem ảnh kích thước gốc"
                              className="customer-attachment-img-wrap"
                            >
                              <img
                                src={selectedTicket.attachment}
                                alt="Ảnh đính kèm"
                                className="customer-attachment-img"
                              />
                            </a>
                          ) : (
                            <div className="customer-attachment-file-wrap">
                              <FileText size={18} />
                              <span>{selectedTicket.attachment}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="customer-message-time">{formatClockTime(selectedTicket.created_at)}</span>
                  </div>
                </article>
                {(repliesByTicket[selectedTicket.id] ?? []).map((reply, index) => (
                  <article
                    className="agent-message"
                    key={`${selectedTicket.id}-reply-${index}`}
                  >
                    <div className="agent-message-bubble">
                      <p>{reply}</p>
                      <time>Vừa xong · Đã gửi</time>
                    </div>
                  </article>
                ))}
                <div className="timeline-system-note" role="status">
                  <Sparkles size={14} /><TriageBadge ticket={selectedTicket} />
                  {selectedTicket.isAiBumped && " · AI đã nâng ưu tiên lên khẩn cấp"}
                </div>
                <div className="ticket-context-note">
                  <Clock3 size={15} />
                  <span>
                    <strong>
                      {formatRelativeTime(selectedTicket.created_at) === "Vừa xong"
                        ? "Vé vừa mới được tạo"
                        : `Vé được tạo ${formatRelativeTime(selectedTicket.created_at)}`}
                    </strong>
                    <small>
                      {(repliesByTicket[selectedTicket.id] ?? []).length > 0
                        ? "Đã có phản hồi từ nhân viên CSKH"
                        : "Khách hàng đang chờ phản hồi đầu tiên"}
                    </small>
                  </span>
                </div>
                <div ref={timelineEndRef} />
              </div>

              <div className="ticket-reply-area">
                {aiDraftOpen && (
                  <aside
                    className="ai-auto-draft-card"
                    aria-label="AI Auto-Draft Card"
                  >
                    <div className="ai-draft-heading">
                      <span className="ai-draft-icon">
                        <Sparkles size={16} />
                      </span>
                      <span>
                        <strong>AI Auto-Draft</strong>
                        <small>Gợi ý phản hồi · Chuyên nghiệp, đồng cảm</small>
                      </span>
                      <button
                        type="button"
                        aria-label="Đóng bản nháp AI"
                        onClick={() => setAiDraftOpen(false)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <p>{selectedTicket.draftReply}</p>
                    <button
                      type="button"
                      className="ai-apply-button"
                      onClick={() => {
                        setDraft(selectedTicket.draftReply);
                        setAiDraftOpen(false);
                      }}
                    >
                      <Sparkles size={15} /> 1-Click Apply &amp; Insert
                    </button>
                  </aside>
                )}
                <button
                  type="button"
                  className="generate-ai-draft"
                  onClick={() => setAiDraftOpen((open) => !open)}
                >
                  <Sparkles size={15} /> Generate AI Draft Reply
                </button>
                <form className="unified-reply-composer" onSubmit={sendReply}>
                  <textarea
                    aria-label="Soạn phản hồi"
                    placeholder={`Trả lời ${selectedTicket.customer}...`}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form.requestSubmit();
                      }
                    }}
                  />
                  {attachmentName && (
                    <span className="composer-attachment-name">
                      <Paperclip size={13} /> {attachmentName}
                    </span>
                  )}
                  <input
                    ref={attachmentRef}
                    type="file"
                    className="composer-file-input"
                    onChange={(event) =>
                      setAttachmentName(event.target.files?.[0]?.name ?? "")
                    }
                  />
                  <div className="unified-composer-actions">
                    <button
                      type="button"
                      className="unified-attach-button"
                      aria-label="Đính kèm file"
                      onClick={() => attachmentRef.current?.click()}
                    >
                      <Paperclip size={17} />
                    </button>
                    <span className="unified-composer-hint">
                      Enter để gửi · Shift + Enter xuống dòng
                    </span>
                    <button
                      type="submit"
                      className="unified-send-button"
                      disabled={!draft.trim()}
                    >
                      <span>Send Reply</span>
                      <Send size={15} />
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* CỘT PHẢI: THÔNG TIN KHÁCH HÀNG & THUỘC TÍNH VÉ (FIGMA BASE 3 & BASE 5) */}
            <aside className="ticket-detail-aside" aria-label="Thông tin khách hàng & vé">
              <div className="ticket-detail-panel">
                <h3>
                  <UserRound size={15} /> Thông tin khách hàng
                </h3>
                <div className="ticket-detail-panel-row">
                  <span>Họ và tên</span>
                  <strong>{selectedTicket.customer}</strong>
                </div>
                <div className="ticket-detail-panel-row">
                  <span>Email</span>
                  <strong>{selectedTicket.email || "Chưa có"}</strong>
                </div>
                <div className="ticket-detail-panel-row">
                  <span>Điện thoại</span>
                  <strong>{selectedTicket.phone || "Chưa có"}</strong>
                </div>
                <div className="ticket-detail-panel-row">
                  <span>Công ty</span>
                  <strong>{selectedTicket.company || "Cá nhân"}</strong>
                </div>
                <div className="ticket-detail-panel-row">
                  <span>Gói dịch vụ</span>
                  <strong style={{ color: "#047857" }}>{selectedTicket.plan || "Premium"}</strong>
                </div>
                <div className="ticket-detail-panel-row">
                  <span>Kênh tiếp nhận</span>
                  <strong className="detail-channel">
                    <ChannelIcon channel={selectedTicket.channel} /> {selectedTicket.channel}
                  </strong>
                </div>
              </div>

              <div className="ticket-detail-panel">
                <h3>
                  <Clock3 size={15} /> Cam kết SLA & AI Triage
                </h3>
                <div className="ticket-detail-panel-row">
                  <span>Thời gian SLA</span>
                  <strong style={{ color: selectedTicket.priorityTone === "urgent" ? "#ef4444" : "#047857" }}>
                    {selectedTicket.sla || "Còn 28 phút"}
                  </strong>
                </div>
                <div className="sla-progress-wrap">
                  <div className="sla-progress-bar">
                    <div
                      className={`sla-progress-fill ${selectedTicket.priorityTone === "urgent" ? "urgent" : ""}`}
                      style={{ width: `${selectedTicket.slaPercent || 70}%` }}
                    />
                  </div>
                </div>
                <div className="ticket-detail-panel-row" style={{ marginTop: "10px" }}>
                  <span>Cảm xúc AI</span>
                  <strong>
                    <TriageBadge ticket={selectedTicket} />
                  </strong>
                </div>
                <div className="ticket-detail-panel-row">
                  <span>Priority Bump</span>
                  <strong>{selectedTicket.isAiBumped ? "AI đã nâng ưu tiên" : "Chưa nâng bằng AI"}</strong>
                </div>
              </div>

              <TriageDetails ticket={selectedTicket} />
              <div className="ticket-detail-panel">
                <h3>
                  <Users size={15} /> Nhân viên phụ trách
                </h3>
                <div className="ticket-detail-panel-row">
                  <span>Hiện tại</span>
                  <strong>
                    {(assignedTickets[selectedTicket.id] ?? selectedTicket.assignee) || "Chưa phân công"}
                  </strong>
                </div>
                <label style={{ display: "block", marginTop: "10px" }}>
                  <span style={{ fontSize: "10px", color: "#718078", fontWeight: 600 }}>
                    Chuyển phân công (4 thành viên):
                  </span>
                  <select
                    className="ticket-detail-assign-select"
                    value={assignedTickets[selectedTicket.id] ?? selectedTicket.assignee}
                    onChange={(e) => handleAssignChange(e.target.value)}
                  >
                    <option value="">-- Chưa phân công --</option>
                    {teamMembers.map((member) => (
                      <option key={member.name} value={member.name}>
                        {member.name} ({member.initials})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </aside>
          </div>
        </div>
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
  stats = { total: 0, pending: 0 },
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
          {[
            { label: "Dashboard", title: "Báo cáo", icon: LayoutDashboard },
            {
              label: "Unified Inbox",
              title: "Hộp thư",
              icon: Inbox,
              badge: stats?.pending > 0 ? String(stats.pending) : null,
            },
            {
              label: "Ticket List",
              title: "Danh sách yêu cầu",
              icon: FileText,
              badge: stats?.total > 0 ? String(stats.total) : null,
            },
            { label: "Settings", title: "Cài đặt", icon: Settings },
          ].map(({ label, title, icon: Icon, badge }) => (
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
          <a
            href="/customer-portal"
            target="_blank"
            rel="noreferrer"
            className="nav-item"
            style={{
              marginTop: "8px",
              border: "1px dashed rgba(16, 185, 129, 0.4)",
              background: "rgba(16, 185, 129, 0.04)",
              color: "#047857",
              fontWeight: 600,
            }}
            title="Mở cổng gửi yêu cầu dành cho khách hàng"
          >
            <Globe2 size={18} />
            <span>Customer Portal ↗</span>
          </a>
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
              <Avatar initials="NP" color="mint" title="Võ Ngọc Phú" />
              <span className="profile-copy">
                <strong>Võ Ngọc Phú</strong>
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

const notificationSamples = [];

function GlobalSearchModal({ onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [realTickets, setRealTickets] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (typeof ticketService !== "undefined" && ticketService.getTickets) {
      ticketService
        .getTickets({ limit: 50 })
        .then((res) => {
          const items =
            res?.data?.data ||
            res?.data?.items ||
            res?.data ||
            res?.items ||
            [];
          if (Array.isArray(items)) setRealTickets(items);
        })
        .catch(() => setRealTickets([]));
    }
  }, []);

  const customerMap = new Map();
  realTickets.forEach((rt) => {
    const custName = rt.customer?.full_name || rt.customer_name || rt.customer?.name;
    if (custName && !customerMap.has(custName)) {
      customerMap.set(custName, {
        name: custName,
        email: rt.customer?.email || rt.customer_email || "Khách hàng HelpDesk",
        initials: custName.split(/\s+/).map((w) => w[0]).slice(-2).join("").toUpperCase() || "KH",
        color: "mint",
      });
    }
  });
  const customers = [...customerMap.values()];
  const searchText = query.trim().toLocaleLowerCase("vi-VN");
  const ticketResults = realTickets
    .filter((rt) => {
      const code = rt.ticket_code || rt.id || "";
      const subj = rt.subject || "";
      const desc = rt.description || "";
      return `${code} ${subj} ${desc}`
        .toLocaleLowerCase("vi-VN")
        .includes(searchText);
    })
    .slice(0, searchText ? 6 : 4)
    .map((rt) => {
      const code = rt.ticket_code || rt.id || `#TK-${String(rt.id).slice(0, 4)}`;
      return {
        id: `ticket-${code}`,
        type: "ticket",
        title: rt.subject || "Yêu cầu hỗ trợ",
        detail: `${code} · ${rt.status === "CLOSED" ? "Đã giải quyết" : "Đang mở"}`,
        icon: FileText,
        destination: "Ticket List",
        search: code,
      };
    });
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
                {notificationSamples.length === 0 ? (
                  <div style={{ padding: "1.75rem 1rem", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
                    Không có thông báo mới.
                  </div>
                ) : (
                  notificationSamples.map((notification) => {
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
                  })
                )}
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
            <Avatar initials="NP" color="mint" small title="Võ Ngọc Phú" />
            <span className="topbar-user-copy">
              <strong>Võ Ngọc Phú</strong>
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
        {activity.length === 0 ? (
          <div style={{ padding: "2rem 1rem", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
            Chưa có hoạt động mới.
          </div>
        ) : (
          activity.map((item, index) => (
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
          ))
        )}
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
          <strong>{teamMembers.length} thành viên</strong> đang trực tuyến
        </span>
        <i className="online-indicator" />
      </div>
    </section>
  );
}

function TicketTable({ onViewAll }) {
  const [feedState, setFeedState] = useState("loading");
  const [recentTickets, setRecentTickets] = useState([]);

  useEffect(() => watchTickets(
    { limit: 5 },
    (items) => {
            const mapped = items.map((rt) => {
              const custName =
                rt.customer?.full_name ||
                rt.customer_name ||
                rt.customer?.name ||
                "Khách hàng";
              const rawInitials = custName
                ? custName
                    .trim()
                    .split(/\s+/)
                    .map((w) => w[0])
                    .slice(-2)
                    .join("")
                    .toUpperCase()
                : "KH";
              return {
                ...getTicketTriage(rt),
                id: rt.ticket_code || rt.id || `#TK-${String(rt.id).slice(0, 4)}`,
                subject: rt.subject || "Yêu cầu hỗ trợ",
                name: custName,
                initials: rawInitials || "KH",
                color: rt.is_urgent_bumped || rt.priority === "urgent" ? "peach" : "mint",
                channel:
                  rt.channel?.channel_type === "telegram" || rt.channel_type === "telegram"
                    ? "Telegram"
                    : rt.channel?.channel_type === "email" || rt.channel_type === "email"
                      ? "Email"
                      : "Web Form",
                status: getTicketStatus(rt.status),
                tone: rt.is_urgent_bumped || rt.priority === "urgent" ? "high" : rt.status === "CLOSED" ? "waiting" : "progress",
                created_at: rt.created_at,
                time: formatRelativeTime(rt.created_at),
                assignee: rt.assigned_agent?.full_name || rt.assignee?.name || rt.assignee_name || "Chưa phân công",
              };
            });
setRecentTickets(mapped);
setFeedState("ready");
}, () => setFeedState("error"),
), []);

  return (
    <section className="panel ticket-panel">
      <div className="panel-heading ticket-heading">
        <div>
          <div className="heading-title-row">
            <h2>Yêu cầu gần đây</h2>
            <span className="subtle-count">{recentTickets.length}</span>
          </div>
          <p>Các yêu cầu cần được chú ý</p>
        </div>
        <button className="text-action" onClick={onViewAll}>
          Xem tất cả <ArrowRight size={15} />
        </button>
      </div>
      <TicketFeedStatus state={feedState} />
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
            {recentTickets.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#6b7280" }}>
                  Chưa có yêu cầu hỗ trợ nào gần đây.
                </td>
              </tr>
            ) : (
              recentTickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <div className="ticket-cell">
                      <Avatar initials={ticket.initials} color={ticket.color} />
                      <div className="ticket-copy">
                        <strong>{ticket.subject}</strong>
                        <TriageBadge ticket={ticket} />
                        {ticket.isAiBumped && <span className="ai-bump-label">AI nâng ưu tiên · Khẩn cấp</span>}
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
              ))
            )}
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
  const [feedState, setFeedState] = useState("loading");
  const localRows = useRef(new Map());
  const removedRows = useRef(new Set());
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState("Tất cả");
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState({});

  useEffect(() => setSearch(initialSearch), [initialSearch]);

  useEffect(() => watchTickets(
    { limit: 50 },
    (items) => {
            const mapped = items.map((rt) => {
              const custName =
                rt.customer?.full_name ||
                rt.customer_name ||
                rt.customer?.name ||
                "Khách hàng";
              const rawInitials = custName
                ? custName
                    .trim()
                    .split(/\s+/)
                    .map((w) => w[0])
                    .slice(-2)
                    .join("")
                    .toUpperCase()
                : "KH";
              const firstMsg =
                rt.description ||
                rt.messages?.[0]?.content ||
                rt.messages?.[rt.messages.length - 1]?.content ||
                "";
              return {
                ...getTicketTriage(rt),
                id: rt.ticket_code || rt.id || `#TK-${String(rt.id).slice(0, 4)}`,
                subject: rt.subject || "Yêu cầu hỗ trợ",
                preview: firstMsg ? (firstMsg.slice(0, 75) + "...") : "Không có nội dung chi tiết",
                customer: custName,
                initials: rawInitials || "KH",
                color: rt.is_urgent_bumped || rt.priority === "urgent" ? "peach" : "mint",
                channel:
                  rt.channel?.channel_type === "telegram" || rt.channel_type === "telegram"
                    ? "Telegram"
                    : rt.channel?.channel_type === "email" || rt.channel_type === "email"
                      ? "Email"
                      : "Web Form",
                assignee: rt.assigned_agent?.full_name || rt.assignee?.name || rt.assignee_name || "Chưa phân công",
                priority: rt.is_urgent_bumped
                  ? "Khẩn cấp (AI Bump)"
                  : rt.priority === "urgent"
                    ? "Khẩn cấp"
                    : rt.priority === "high"
                      ? "Cao"
                      : "Trung bình",
                status: getTicketStatus(rt.status),
                created_at: rt.created_at,
                time: formatRelativeTime(rt.created_at),
              };
            });
setRows(mapped.filter(row => !removedRows.current.has(row.id)).map(row => {
 const changes = localRows.current.get(row.id);
 return changes ? { ...row, ...changes, priority: row.isAiBumped ? row.priority : changes.priority } : row;
}).concat([...localRows.current.values()].filter(row => row.id && !mapped.some(item => item.id === row.id) && !removedRows.current.has(row.id))));
setFeedState("ready");
}, () => setFeedState("error"),
), []);

  const selectedTicket = rows.find((ticket) => ticket.id === selectedId);
  const filteredRows = rows.filter((ticket) => {
    const matchesFilter = filter === "Tất cả" || ticket.status === filter;
    const searchableText = `${ticket.id} ${ticket.subject} ${ticket.preview} ${ticket.customer} ${ticket.priority} ${ticket.status} ${ticket.assignee}`;
    return (
      matchesFilter &&
      searchableText.toLowerCase().includes(search.toLowerCase())
    );
  });
  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / 10));
  const visibleStart = totalCount === 0 ? 0 : (page - 1) * 10 + 1;
  const visibleEnd = Math.min(page * 10, totalCount);
  const pageRows = filteredRows.slice((page - 1) * 10, page * 10);
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
    const changes = Object.fromEntries(
      ["subject", "preview", "customer", "initials", "color", "channel", "assignee", "priority", "status"].map(field => [field, ticket[field]])
    );
    localRows.current.set(ticket.id, editingId ? changes : ticket);
    setRows((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? ticket : item))
        : [ticket, ...current],
    );
    setPage(1);
    setDialog(null);
  };

  const removeTicket = () => {
    removedRows.current.add(selectedId);
    localRows.current.delete(selectedId);
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
            <span className="ticket-total-badge">{rows.length} yêu cầu</span>
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

      <TicketFeedStatus state={feedState} />
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
          {ticketStatuses.map((status) => {
            const count =
              status === "Tất cả"
                ? rows.length
                : rows.filter((r) => r.status === status).length;
            return (
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
                {status} <span>{count}</span>
              </button>
            );
          })}
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
                  ticket.isAiBumped || ticket.priority.startsWith("Khẩn cấp") ? "urgent" :
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
                        <TriageBadge ticket={ticket} />
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
                  <td className="ticket-empty-cell" colSpan={8} style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
                    Chưa có yêu cầu hỗ trợ nào trong hệ thống. Hãy tạo vé mới từ Web Portal hoặc gửi qua Email / Telegram.
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
                      placeholder="Ví dụ: Nguyễn Văn A"
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
                      placeholder="NA"
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
                <TriageDetails ticket={selectedTicket} />
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
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("helpdesk-theme") === "dark",
  );
  const [dashboardStats, setDashboardStats] = useState({
    total: 0,
    resolved: 0,
    pending: 0,
  });
  const pathname = location.pathname.replace(/\/+$/, "") || "/";

  useEffect(() => {
    let isMounted = true;
    const fetchStats = () => {
      if (typeof ticketService !== "undefined" && ticketService.getTickets) {
        ticketService
          .getTickets({ limit: 100 })
          .then((res) => {
            if (!isMounted) return;
            const items =
              res?.data?.data ||
              res?.data?.items ||
              res?.data ||
              res?.items ||
              [];
            if (Array.isArray(items)) {
              const total = items.length;
              const resolved = items.filter(
                (t) => (t.status || "").toLowerCase() === "closed" || (t.status || "").toLowerCase() === "resolved",
              ).length;
              const pending = total - resolved;
              setDashboardStats({ total, resolved, pending });
            }
          })
          .catch(() => {});
      }
    };

    fetchStats();
    const timer = setInterval(fetchStats, 3000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [active]);

  const dynamicMetrics = [
    {
      label: "Tổng số ticket",
      value: String(dashboardStats.total),
      change: dashboardStats.total > 0 ? "+100%" : "0%",
      icon: Inbox,
      tone: "green",
      sparkline: "0,33 18,29 36,31 54,20 72,24 90,15 108,18 126,8 144,10 160,2",
    },
    {
      label: "Ticket đã xong",
      value: String(dashboardStats.resolved),
      change: dashboardStats.resolved > 0 ? "đạt chuẩn" : "0",
      icon: Check,
      tone: "blue",
      sparkline: "0,29 18,33 36,24 54,26 72,17 90,22 108,12 126,14 144,5 160,8",
    },
    {
      label: "Ticket đang chờ",
      value: String(dashboardStats.pending),
      change: dashboardStats.pending > 0 ? `${dashboardStats.pending} cần xử lý` : "Đang trống",
      icon: Clock3,
      tone: "amber",
      down: dashboardStats.pending > 0,
      sparkline: "0,5 18,10 36,8 54,18 72,15 90,24 108,21 126,31 144,28 160,39",
    },
    {
      label: "Thời gian phản hồi TB (SLA)",
      value: "< 2 giờ",
      change: "đạt mục tiêu",
      footnote: "SLA chuẩn < 2 giờ",
      icon: Activity,
      tone: "coral",
      neutral: true,
      sparkline: "0,31 18,24 36,27 54,19 72,22 90,14 108,17 126,10 144,12 160,5",
    },
  ];

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
    return <AuthPage key="register" mode="register" onLogin={() => {}} />;
  }

  if (pathname === "/customer-portal" || pathname === "/portal") {
    return (
      <CustomerPortal
        onSubmitTicket={(payload) => ticketService.createTicket(payload)}
      />
    );
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
        stats={dashboardStats}
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
                  Chào buổi sáng, Võ Ngọc Phú <span className="wave">✳</span>
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
              {dynamicMetrics.map((metric) => (
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
