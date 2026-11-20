import { useEffect, useRef, useState } from "react";
import { ticketService } from "./services/ticket.service.js";

export default function AssignTicketModal({ ticket, onClose, onAssigned }) {
  const [agents, setAgents] = useState([]);
  const [mode, setMode] = useState("manual");
  const [agentId, setAgentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);

  useEffect(() => {
    let active = true;
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    ticketService
      .getActiveAgents()
      .then((items) => {
        if (active) setAgents(items);
      })
      .catch(() => {
        if (active)
          setError(
            "Không thể tải danh sách Agent. Vui lòng mở lại cửa sổ để thử lại.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      previousFocus?.focus();
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (saving || loading || (mode === "manual" && !agentId)) return;
    setSaving(true);
    setError("");
    try {
      const updated =
        mode === "auto"
          ? await ticketService.assignTicketAuto(ticket.id)
          : await ticketService.assignTicket(ticket.id, agentId);
      onAssigned(updated);
      onClose();
    } catch (failure) {
      const message =
        failure.response?.data?.message ||
        "Không thể phân công ticket. Vui lòng thử lại.";
      setError(Array.isArray(message) ? message.join(". ") : message);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape" && !saving) onClose();
    if (event.key !== "Tab") return;
    const fields = [
      ...dialogRef.current.querySelectorAll(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
      ),
    ];
    const first = fields[0];
    const last = fields.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === dialogRef.current)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className="ticket-dialog-backdrop">
      <section
        className="ticket-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-ticket-title"
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="ticket-dialog-header">
          <h2 id="assign-ticket-title">Phân công {ticket.id}</h2>
        </header>
        <form className="ticket-dialog-form" onSubmit={submit}>
        <fieldset className="assignment-modes" disabled={loading || saving}>
            <legend>Chế độ phân công</legend>
            <label>
              <input
                type="radio"
                name="assignmentMode"
                value="manual"
                checked={mode === "manual"}
                onChange={() => setMode("manual")}
              />{" "}
              Thủ công
            </label>
            <label>
              <input
                type="radio"
                name="assignmentMode"
                value="auto"
                checked={mode === "auto"}
                onChange={() => setMode("auto")}
              />{" "}
              Tự động (Round-robin)
            </label>
          </fieldset>
          {mode === "manual" && (
            <label>
              Agent phụ trách
              <select
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                disabled={loading || saving}
              >
                <option value="">-- Chọn Agent --</option>
                {agents.map((agent) => (
                  <option key={agent.user_id} value={agent.user_id}>
                    {agent.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {loading && <p role="status">Đang tải Agent…</p>}
          {!loading && agents.length === 0 && !error && (
            <p>Không có Agent đang hoạt động.</p>
          )}
          {mode === "auto" && (
            <p>
              Round-robin chọn Agent tiếp theo cho ticket chưa được phân công.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <footer className="ticket-dialog-footer">
            <button
              type="button"
              className="secondary-button"
              disabled={saving}
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={loading || saving || (mode === "manual" && !agentId)}
            >
              {saving ? "Đang phân công…" : "Xác nhận phân công"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
