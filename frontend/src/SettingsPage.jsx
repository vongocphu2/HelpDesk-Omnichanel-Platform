import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Building2,
  Camera,
  Check,
  ChevronRight,
  Globe2,
  KeyRound,
  Mail,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

const settingsTabs = [
  {
    id: "profile",
    label: "Hồ sơ cá nhân",
    description: "Tài khoản và bảo mật",
    icon: UserRound,
  },
  {
    id: "team",
    label: "Thành viên & Phân quyền",
    description: "Quản lý nhóm hỗ trợ",
    icon: Users,
  },
  {
    id: "channels",
    label: "Kênh hỗ trợ",
    description: "Kết nối các kênh tiếp nhận",
    icon: MessageCircle,
  },
  {
    id: "notifications",
    label: "Thông báo",
    description: "Tùy chỉnh cách nhận tin",
    icon: Bell,
  },
  {
    id: "workspace",
    label: "Tổ chức / Workspace",
    description: "Thông tin không gian làm việc",
    icon: Building2,
  },
];

const initialMembers = [
  {
    id: "np",
    name: "Võ Ngọc Phú",
    email: "vongocphu136@gmail.com",
    initials: "NP",
    role: "Quản trị viên",
    status: "Đang hoạt động",
    color: "mint",
  },
  {
    id: "hp",
    name: "Võ Hồng Phúc",
    email: "hongphuc@helpdesk.com",
    initials: "HP",
    role: "Nhân viên CSKH",
    status: "Đang hoạt động",
    color: "lilac",
  },
  {
    id: "tl",
    name: "Võ Thị Thu Lộc",
    email: "votthuloc@dtu.edu.vn",
    initials: "TL",
    role: "Nhân viên CSKH",
    status: "Đang hoạt động",
    color: "peach",
  },
  {
    id: "td",
    name: "Trương Đình Thảo Đoan",
    email: "thaodoan29082005@gmail.com",
    initials: "TĐ",
    role: "Nhân viên CSKH",
    status: "Đang hoạt động",
    color: "blue",
  },
];

const initialChannels = [
  {
    id: "email",
    name: "Email Support",
    detail: "support@helpdesk.com",
    icon: Mail,
    connected: true,
    enabled: true,
  },
  {
    id: "livechat",
    name: "Live Chat Website",
    detail: "Widget trên website HelpDesk",
    icon: MessageCircle,
    connected: true,
    enabled: true,
  },
  {
    id: "webform",
    name: "Web Form",
    detail: "Biểu mẫu yêu cầu hỗ trợ",
    icon: Globe2,
    connected: true,
    enabled: true,
  },
  {
    id: "telegram",
    name: "Telegram Bot",
    detail: "Chưa liên kết bot Telegram",
    icon: Send,
    connected: false,
    enabled: false,
  },
  {
    id: "zalo",
    name: "Zalo OA",
    detail: "Chưa liên kết Official Account",
    icon: Smartphone,
    connected: false,
    enabled: false,
  },
];

const initialNotifications = [
  {
    id: "new-ticket-email",
    title: "Ticket mới qua email",
    detail: "Nhận email khi khách hàng gửi yêu cầu mới.",
    enabled: true,
  },
  {
    id: "in-app",
    title: "Chuông báo ứng dụng",
    detail: "Hiển thị thông báo trong HelpDesk.",
    enabled: true,
  },
  {
    id: "assignment",
    title: "Được phân công công việc",
    detail: "Thông báo khi ticket được giao cho bạn.",
    enabled: true,
  },
];

function makeInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("vi-VN");
}

function SettingsPage({ defaultTab = "profile", focusPassword = false }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const currentPasswordRef = useRef(null);
  const [profile, setProfile] = useState({
    name: "Võ Ngọc Phú",
    email: "vongocphu136@gmail.com",
    role: "Quản trị viên",
  });
  const [avatar, setAvatar] = useState("");
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [members, setMembers] = useState(initialMembers);
  const [channels, setChannels] = useState(initialChannels);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [workspace, setWorkspace] = useState({
    name: "HelpDesk",
    company: "HelpDesk Support",
    timezone: "Asia/Ho_Chi_Minh",
    language: "vi",
  });
  const [savedMessage, setSavedMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState("success");
  const [memberModal, setMemberModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    role: "Nhân viên CSKH",
  });

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!focusPassword || activeTab !== "profile") return undefined;
    const focusTimer = window.setTimeout(
      () => currentPasswordRef.current?.focus(),
      0,
    );
    return () => window.clearTimeout(focusTimer);
  }, [activeTab, focusPassword]);

  const showSaved = (message, type = "success") => {
    setSavedMessage(message);
    setFeedbackType(type);
    window.setTimeout(() => setSavedMessage(""), 3200);
  };

  const saveProfile = (event) => {
    event.preventDefault();
    const hasPasswordInput = Object.values(passwords).some(Boolean);
    if (
      hasPasswordInput &&
      (!passwords.current || !passwords.next || !passwords.confirm)
    ) {
      showSaved(
        "Vui lòng điền đủ ba trường mật khẩu để đổi mật khẩu.",
        "error",
      );
      return;
    }
    if (hasPasswordInput && passwords.next !== passwords.confirm) {
      showSaved("Mật khẩu mới và xác nhận chưa khớp.", "error");
      return;
    }
    setPasswords({ current: "", next: "", confirm: "" });
    showSaved("Thông tin hồ sơ đã được lưu.");
  };

  const updateAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };

  const addMember = (event) => {
    event.preventDefault();
    setMembers((current) => [
      ...current,
      {
        id: `member-${Date.now()}`,
        ...newMember,
        initials: makeInitials(newMember.name),
        status: "Đang hoạt động",
        color: "mint",
      },
    ]);
    setNewMember({ name: "", email: "", role: "Nhân viên CSKH" });
    setMemberModal(false);
    showSaved("Đã thêm thành viên vào workspace.");
  };

  const removeMember = () => {
    setMembers((current) =>
      current.filter((member) => member.id !== memberToDelete),
    );
    setMemberToDelete(null);
    showSaved("Thành viên đã được xóa khỏi workspace.");
  };

  const toggleChannel = (channelId) => {
    setChannels((current) =>
      current.map((channel) =>
        channel.id === channelId
          ? { ...channel, enabled: !channel.enabled }
          : channel,
      ),
    );
  };

  const toggleNotification = (notificationId) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, enabled: !notification.enabled }
          : notification,
      ),
    );
  };

  const activeTabDetails = settingsTabs.find((tab) => tab.id === activeTab);

  return (
    <div className="settings-page">
      <header className="settings-page-heading">
        <div>
          <span className="settings-eyebrow">KHÔNG GIAN LÀM VIỆC</span>
          <h1>Cài đặt</h1>
        </div>
        <span className="settings-workspace-badge">
          <Building2 size={14} /> HelpDesk
        </span>
      </header>

      <div className="settings-layout">
        <nav
          className="settings-tabs"
          role="tablist"
          aria-label="Danh mục cài đặt"
        >
          {settingsTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={
                activeTab === id
                  ? "settings-tab settings-tab-active"
                  : "settings-tab"
              }
              onClick={() => {
                setActiveTab(id);
                setSavedMessage("");
              }}
            >
              <span className="settings-tab-icon">
                <Icon size={17} />
              </span>
              <span className="settings-tab-copy">
                <strong>{label}</strong>
              </span>
              <ChevronRight className="settings-tab-arrow" size={15} />
            </button>
          ))}
        </nav>

        <main
          className="settings-content"
          role="tabpanel"
          aria-label={activeTabDetails?.label}
        >
          <header className="settings-section-heading">
            <div>
              <h2>{activeTabDetails?.label}</h2>
            </div>
            {savedMessage && (
              <span
                className={`settings-saved-message ${feedbackType === "error" ? "settings-saved-error" : ""}`}
                role={feedbackType === "error" ? "alert" : "status"}
              >
                {feedbackType === "error" ? (
                  <X size={14} />
                ) : (
                  <Check size={14} />
                )}
                {savedMessage}
              </span>
            )}
          </header>

          {activeTab === "profile" && (
            <div className="settings-section-stack">
              <form
                className="settings-card settings-profile-card"
                onSubmit={saveProfile}
              >
                <div className="settings-card-heading">
                  <div>
                    <h3>Thông tin cá nhân</h3>
                  </div>
                </div>
                <div className="settings-profile-main">
                  <div className="settings-avatar-column">
                    <span className="settings-avatar-preview">
                      {avatar ? (
                        <img src={avatar} alt="Avatar hồ sơ" />
                      ) : profile.name === "Võ Ngọc Phú" ? (
                        "NP"
                      ) : profile.name === "Võ Hồng Phúc" ? (
                        "HP"
                      ) : (
                        makeInitials(profile.name)
                      )}
                    </span>
                    <label className="settings-avatar-upload">
                      <Camera size={14} /> Đổi avatar
                      <input
                        type="file"
                        accept="image/*"
                        onChange={updateAvatar}
                      />
                    </label>
                  </div>
                  <div className="settings-profile-fields">
                    <label className="settings-field">
                      <span>Họ và tên</span>
                      <input
                        required
                        value={profile.name}
                        onChange={(event) =>
                          setProfile({ ...profile, name: event.target.value })
                        }
                      />
                    </label>
                    <label className="settings-field">
                      <span>Email</span>
                      <input
                        required
                        type="email"
                        value={profile.email}
                        onChange={(event) =>
                          setProfile({ ...profile, email: event.target.value })
                        }
                      />
                    </label>
                    <label className="settings-field">
                      <span>Vai trò</span>
                      <span className="settings-role-field">
                        <ShieldCheck size={15} />
                        <input value={profile.role} readOnly />
                      </span>
                    </label>
                  </div>
                </div>

                <div className="settings-card-divider" />
                <div className="settings-card-heading settings-password-heading">
                  <div>
                    <h3>Mật khẩu</h3>
                  </div>
                  <KeyRound size={17} />
                </div>
                <div className="settings-password-grid">
                  <label className="settings-field">
                    <span>Mật khẩu hiện tại</span>
                    <input
                      ref={currentPasswordRef}
                      type="password"
                      autoComplete="current-password"
                      value={passwords.current}
                      onChange={(event) =>
                        setPasswords({
                          ...passwords,
                          current: event.target.value,
                        })
                      }
                      placeholder="Nhập mật khẩu hiện tại"
                    />
                  </label>
                  <label className="settings-field">
                    <span>Mật khẩu mới</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={passwords.next}
                      onChange={(event) =>
                        setPasswords({ ...passwords, next: event.target.value })
                      }
                      placeholder="Tối thiểu 8 ký tự"
                    />
                  </label>
                  <label className="settings-field">
                    <span>Xác nhận mật khẩu mới</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={passwords.confirm}
                      onChange={(event) =>
                        setPasswords({
                          ...passwords,
                          confirm: event.target.value,
                        })
                      }
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </label>
                </div>
                <footer className="settings-card-footer">
                  <span />
                  <button className="settings-save-button" type="submit">
                    <Check size={15} /> Lưu thay đổi
                  </button>
                </footer>
              </form>
            </div>
          )}

          {activeTab === "team" && (
            <section className="settings-card settings-team-card">
              <div className="settings-card-heading settings-team-heading">
                <div>
                  <h3>Thành viên workspace</h3>
                </div>
                <button
                  className="settings-primary-button"
                  onClick={() => setMemberModal(true)}
                >
                  <Plus size={15} /> Thêm thành viên mới
                </button>
              </div>
              <div className="settings-team-table-wrap">
                <table className="settings-team-table">
                  <thead>
                    <tr>
                      <th>THÀNH VIÊN</th>
                      <th>VAI TRÒ</th>
                      <th>TRẠNG THÁI</th>
                      <th>
                        <span className="settings-actions-heading">
                          THAO TÁC
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div className="settings-member-cell">
                            <span className={`avatar avatar-${member.color}`}>
                              {member.initials}
                            </span>
                            <span>
                              <strong>{member.name}</strong>
                              <small>{member.email}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <label className="settings-role-select-wrap">
                            <select
                              aria-label={`Vai trò ${member.name}`}
                              value={member.role}
                              onChange={(event) =>
                                setMembers((current) =>
                                  current.map((item) =>
                                    item.id === member.id
                                      ? { ...item, role: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            >
                              <option>Quản trị viên</option>
                              <option>Nhân viên CSKH</option>
                            </select>
                            <ChevronRight size={13} />
                          </label>
                        </td>
                        <td>
                          <span
                            className={
                              member.status === "Đang hoạt động"
                                ? "settings-member-status settings-member-online"
                                : "settings-member-status settings-member-offline"
                            }
                          >
                            <i />
                            {member.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="settings-icon-button settings-remove-member"
                            aria-label={`Xóa ${member.name}`}
                            onClick={() => setMemberToDelete(member.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "channels" && (
            <div className="settings-section-stack">
              <section className="settings-card settings-list-card">
                <div className="settings-card-heading">
                  <div>
                    <h3>Kênh tiếp nhận</h3>
                  </div>
                </div>
                <div className="settings-option-list">
                  {channels.map((channel) => {
                    const Icon = channel.icon;
                    return (
                      <div className="settings-channel-row" key={channel.id}>
                        <span
                          className={`settings-channel-icon settings-channel-${channel.id}`}
                        >
                          <Icon size={18} />
                        </span>
                        <span className="settings-option-copy">
                          <strong>{channel.name}</strong>
                        </span>
                        <span
                          className={
                            channel.connected
                              ? "settings-connection-status settings-connected"
                              : "settings-connection-status settings-not-connected"
                          }
                        >
                          <i />
                          {channel.connected ? "Đã kết nối" : "Chưa kết nối"}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={channel.enabled}
                          aria-label={`${channel.enabled ? "Tắt" : "Bật"} ${channel.name}`}
                          className={
                            channel.enabled
                              ? "settings-toggle settings-toggle-on"
                              : "settings-toggle"
                          }
                          onClick={() => toggleChannel(channel.id)}
                        >
                          <span />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {activeTab === "notifications" && (
            <section className="settings-card settings-list-card">
              <div className="settings-card-heading">
                <div>
                  <h3>Tùy chọn thông báo</h3>
                </div>
              </div>
              <div className="settings-option-list">
                {notifications.map((notification) => (
                  <div
                    className="settings-notification-row"
                    key={notification.id}
                  >
                    <span className="settings-notification-icon">
                      <Bell size={17} />
                    </span>
                    <span className="settings-option-copy">
                      <strong>{notification.title}</strong>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notification.enabled}
                      aria-label={`${notification.enabled ? "Tắt" : "Bật"} ${notification.title}`}
                      className={
                        notification.enabled
                          ? "settings-toggle settings-toggle-on"
                          : "settings-toggle"
                      }
                      onClick={() => toggleNotification(notification.id)}
                    >
                      <span />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "workspace" && (
            <form
              className="settings-card settings-workspace-card"
              onSubmit={(event) => {
                event.preventDefault();
                showSaved("Thông tin workspace đã được lưu.");
              }}
            >
              <div className="settings-card-heading">
                <div>
                  <h3>Thông tin workspace</h3>
                </div>
              </div>
              <div className="settings-workspace-fields">
                <label className="settings-field">
                  <span>Tên workspace</span>
                  <input
                    required
                    value={workspace.name}
                    onChange={(event) =>
                      setWorkspace({ ...workspace, name: event.target.value })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span>Tổ chức</span>
                  <input
                    required
                    value={workspace.company}
                    onChange={(event) =>
                      setWorkspace({
                        ...workspace,
                        company: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span>Múi giờ</span>
                  <select
                    value={workspace.timezone}
                    onChange={(event) =>
                      setWorkspace({
                        ...workspace,
                        timezone: event.target.value,
                      })
                    }
                  >
                    <option value="Asia/Ho_Chi_Minh">
                      (GMT+07:00) Hồ Chí Minh
                    </option>
                    <option value="Asia/Singapore">
                      (GMT+08:00) Singapore
                    </option>
                    <option value="UTC">(GMT+00:00) UTC</option>
                  </select>
                </label>
                <label className="settings-field">
                  <span>Ngôn ngữ</span>
                  <select
                    value={workspace.language}
                    onChange={(event) =>
                      setWorkspace({
                        ...workspace,
                        language: event.target.value,
                      })
                    }
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </div>
              <div className="settings-workspace-url">
                <Globe2 size={16} />
                <span>
                  <small>Địa chỉ workspace</small>
                  <strong>
                    helpdesk.com/
                    {workspace.name.toLowerCase().replace(/\s+/g, "-")}
                  </strong>
                </span>
              </div>
              <footer className="settings-card-footer">
                <span>
                  Tên workspace hiển thị trong menu và email thông báo.
                </span>
                <button className="settings-save-button" type="submit">
                  <Check size={15} /> Lưu thay đổi
                </button>
              </footer>
            </form>
          )}
        </main>
      </div>

      {(memberModal || memberToDelete) && (
        <div
          className="settings-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMemberModal(false);
              setMemberToDelete(null);
            }
          }}
        >
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
          >
            <header className="settings-modal-header">
              <div>
                <span>HELPDESK WORKSPACE</span>
                <h2 id="settings-modal-title">
                  {memberModal ? "Thêm thành viên mới" : "Xóa thành viên?"}
                </h2>
              </div>
              <button
                className="settings-icon-button"
                aria-label="Đóng"
                onClick={() => {
                  setMemberModal(false);
                  setMemberToDelete(null);
                }}
              >
                <X size={17} />
              </button>
            </header>
            {memberModal ? (
              <form className="settings-modal-form" onSubmit={addMember}>
                <label className="settings-field">
                  <span>Họ và tên</span>
                  <input
                    required
                    value={newMember.name}
                    onChange={(event) =>
                      setNewMember({ ...newMember, name: event.target.value })
                    }
                    placeholder="Nhập tên thành viên"
                  />
                </label>
                <label className="settings-field">
                  <span>Email</span>
                  <input
                    required
                    type="email"
                    value={newMember.email}
                    onChange={(event) =>
                      setNewMember({ ...newMember, email: event.target.value })
                    }
                    placeholder="name@company.com"
                  />
                </label>
                <label className="settings-field">
                  <span>Vai trò</span>
                  <select
                    value={newMember.role}
                    onChange={(event) =>
                      setNewMember({ ...newMember, role: event.target.value })
                    }
                  >
                    <option>Nhân viên CSKH</option>
                    <option>Quản trị viên</option>
                  </select>
                </label>
                <footer className="settings-modal-actions">
                  <button
                    type="button"
                    className="settings-secondary-button"
                    onClick={() => setMemberModal(false)}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="settings-save-button">
                    <Plus size={15} /> Thêm thành viên
                  </button>
                </footer>
              </form>
            ) : (
              <div className="settings-delete-content">
                <p>
                  Thành viên này sẽ mất quyền truy cập workspace. Thao tác chỉ
                  áp dụng cho dữ liệu giao diện hiện tại.
                </p>
                <footer className="settings-modal-actions">
                  <button
                    className="settings-secondary-button"
                    onClick={() => setMemberToDelete(null)}
                  >
                    Hủy
                  </button>
                  <button
                    className="settings-delete-button"
                    onClick={removeMember}
                  >
                    <Trash2 size={15} /> Xóa thành viên
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

export default SettingsPage;
