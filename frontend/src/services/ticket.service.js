import api from './api.js';

/**
 * Service xử lý các API liên quan đến Vé yêu cầu hỗ trợ (Tickets)
 * Phụ trách bởi: Võ Ngọc Phú (Task 2.5b - Frontend API Service & Validation)
 */

export const ticketService = {
    /**
     * Kiểm tra tính hợp lệ của dữ liệu trước khi gửi lên máy chủ (Client-side Validation)
     * @param {Object} formData
     * @returns {{ isValid: boolean, errors: Object }}
     */
    validateTicketForm(formData) {
        const errors = {};

        if (!formData.customer_name || formData.customer_name.trim().length < 2) {
            errors.customer_name = 'Họ và tên phải có ít nhất 2 ký tự';
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.customer_email || !emailRegex.test(formData.customer_email.trim())) {
            errors.customer_email = 'Email không đúng định dạng';
        }

        if (formData.customer_phone && formData.customer_phone.trim()) {
            const phoneRegex = /^[0-9+\s\-().]{8,15}$/;
            if (!phoneRegex.test(formData.customer_phone.trim())) {
                errors.customer_phone = 'Số điện thoại không hợp lệ (8 - 15 chữ số)';
            }
        }

        if (!formData.subject || formData.subject.trim().length < 5) {
            errors.subject = 'Tiêu đề yêu cầu phải có ít nhất 5 ký tự';
        }

        if (!formData.description || formData.description.trim().length < 10) {
            errors.description = 'Nội dung mô tả chi tiết phải có ít nhất 10 ký tự';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
        };
    },

    /**
     * Gửi yêu cầu hỗ trợ từ Web Form lên máy chủ (Task 2.1 & 2.5b)
     * Endpoint: POST /api/v1/tickets
     * @param {Object} ticketData
     */
    async createTicket(ticketData) {
        const validation = this.validateTicketForm(ticketData);
        if (!validation.isValid) {
            const firstError = Object.values(validation.errors)[0];
            throw new Error(firstError);
        }

        const payload = {
            customer_name: ticketData.customer_name.trim(),
            customer_email: ticketData.customer_email.trim(),
            customer_phone: ticketData.customer_phone?.trim() || undefined,
            subject: ticketData.subject.trim(),
            description: ticketData.description.trim(),
            channel_type: ticketData.channel_type || 'web',
            priority: ticketData.priority || 'medium',
            attachment_url: ticketData.attachment_url || undefined,
        };

        const response = await api.post('/tickets', payload);
        return response.data || response;
    },

    /**
     * Lấy danh sách vé hỗ trợ có phân trang và bộ lọc (Task 2.2 & 2.6)
     * Endpoint: GET /api/v1/tickets
     * @param {Object} params { page, limit, status, priority, channel_type, search, is_urgent_bumped }
     */
    async getTickets(params = {}, options = {}) {
        const response = await api.get('/tickets', { params, signal: options.signal });
        return response;
    },

    /**
     * Xem chi tiết 1 vé hỗ trợ và toàn bộ tin nhắn trao đổi (Task 2.2)
     * Endpoint: GET /api/v1/tickets/:id
     * @param {string} id Mã vé (TK-1082) hoặc UUID
     */
    async getTicketById(id) {
        if (!id) throw new Error('Mã vé không được để trống');
        const response = await api.get(`/tickets/${encodeURIComponent(id)}`);
        return response.data || response;
    },

    /**
     * Cập nhật trạng thái và/hoặc mức độ ưu tiên của vé hỗ trợ (Task 4.1 - Phú)
     * Endpoint: PATCH /api/v1/tickets/:id
     * @param {string} id Mã vé (TK-1082) hoặc UUID
     * @param {{ status?: string, priority?: string }} payload
     */
    async updateTicket(id, payload = {}) {
        if (!id) throw new Error('Mã vé không được để trống');
        const body = {};
        if (payload.status !== undefined) body.status = payload.status;
        if (payload.priority !== undefined) body.priority = payload.priority;
        const response = await api.patch(`/tickets/${encodeURIComponent(id)}`, body);
        return response.data || response;
    },

    /**
     * Phân công Ticket thủ công cho Agent (Task 4.2 / 4.7 - Lộc)
     * Endpoint: PATCH /api/v1/tickets/:id/assign
     * @param {string} ticketId Mã vé hoặc UUID
     * @param {string} agentId UUID của Agent
     */
    async assignTicket(ticketId, agentId) {
        if (!ticketId || !agentId) {
            throw new Error('Vui lòng chọn Ticket và Agent');
        }
        const response = await api.patch(
            `/tickets/${encodeURIComponent(ticketId)}/assign`,
            { agent_id: agentId },
        );
        return response.data || response;
    },

    /**
     * Lấy danh sách Agent đang hoạt động (Task 4.7 - Lộc)
     * Endpoint: GET /api/v1/tickets/agents
     */
    async assignTicketAuto(ticketId) {
        if (!ticketId) throw new Error('Vui lòng chọn Ticket');
        const response = await api.post(`/tickets/${encodeURIComponent(ticketId)}/assign-round-robin`, {});
        return response.data || response;
    },

    async getActiveAgents() {
        const response = await api.get('/tickets/agents');
        return response?.data?.data ?? response?.data ?? [];
    },
};

export default ticketService;

// AI analysis happens after ticket creation. Refresh the server's ordered list
// while the screen is mounted, keeping the last successful data on errors.
export function watchTickets(params, onUpdate, onError) {
    let disposed = false;
    let timer;
    const controller = new AbortController();
    const cleanParams = Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );
    const refresh = async () => {
        try {
            const response = await ticketService.getTickets(cleanParams, { signal: controller.signal });
            const items = response?.data?.data || response?.data?.items ||
                response?.data || response?.items;
            if (!Array.isArray(items)) throw new Error('INVALID_TICKET_RESPONSE');
            const meta = {
                total: Number(response?.total ?? response?.data?.total ?? items.length),
                page: Number(response?.page ?? response?.data?.page ?? cleanParams.page ?? 1),
                limit: Number(response?.limit ?? response?.data?.limit ?? cleanParams.limit ?? (items.length || 10)),
                totalPages: Number(response?.totalPages ?? response?.data?.totalPages ?? 1),
            };
            if (!disposed) onUpdate(items, meta);
        } catch {
            if (!disposed) onError?.();
        } finally {
            if (!disposed) timer = setTimeout(refresh, 5000);
        }
    };
    void refresh();
    return () => {
        disposed = true;
        clearTimeout(timer);
        controller.abort();
    };
}
