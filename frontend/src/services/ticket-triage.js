const sentimentLabels = {
  positive: 'Hài lòng',
  neutral: 'Trung tính',
  frustrated: 'Bực bội',
};

const analysisStates = {
  pending: 'Chờ AI phân tích',
  processing: 'AI đang phân tích',
  failed: 'AI phân tích lỗi',
  skipped: 'Chưa phân tích AI',
};

function percentage(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1
    ? `${Math.round(number * 100)}%`
    : null;
}

export function getTicketTriage(ticket) {
  const sentiment = String(ticket.sentiment_label || '').toLowerCase();
  // Legacy tickets may carry a label without the newer worker status.
  const completed = ticket.ai_status === 'completed' ||
    (!ticket.ai_status && Boolean(sentimentLabels[sentiment]));
  const hasSentiment = completed && Boolean(sentimentLabels[sentiment]);
  return {
    aiStatus: ticket.ai_status || (completed ? 'completed' : 'skipped'),
    sentiment: hasSentiment ? sentiment : '',
    sentimentLabel: hasSentiment ? sentimentLabels[sentiment] :
      analysisStates[ticket.ai_status] || 'Chưa phân tích AI',
    sentimentScore: hasSentiment ? percentage(ticket.sentiment_score) : null,
    urgencyScore: completed ? percentage(ticket.urgency_score) : null,
    aiReason: completed ? ticket.ai_reason || '' : '',
    aiModel: completed ? ticket.ai_model || '' : '',
    aiKeywords: completed && Array.isArray(ticket.ai_detected_keywords)
      ? ticket.ai_detected_keywords.filter(item => typeof item === 'string') : [],
    isAiBumped: ticket.is_urgent_bumped === true,
  };
}

export function getTicketStatus(status) {
  return ({ new: 'Đang mở', open: 'Đang mở', in_progress: 'Đang xử lý',
    pending: 'Đang chờ', resolved: 'Đã giải quyết', closed: 'Đã giải quyết',
  })[String(status || '').toLowerCase()] || 'Đang mở';
}
