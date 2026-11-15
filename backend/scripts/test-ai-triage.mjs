// Live acceptance smoke test: creates eight synthetic tickets and calls real AI
// through the running backend. It does not read or print the Provider AI API key.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = (
  process.env.HELPDESK_API_URL || 'http://localhost:3000/api/v1'
).replace(/\/$/, '');
const reportId = `AI33-${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}`;
let runId = reportId;
const resumeIndex = process.argv.indexOf('--resume');
const cases = JSON.parse(
  await readFile(
    new URL('../test/fixtures/triage-cases.json', import.meta.url),
    'utf8',
  ),
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = {
  runId,
  startedAt: new Date().toISOString(),
  checks: {},
  results: [],
};

async function request(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(process.env.HELPDESK_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.HELPDESK_ACCESS_TOKEN}` }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`HTTP ${response.status} khi gọi ${path.split('?')[0]}`);
  return response.json();
}

try {
  if (resumeIndex >= 0) {
    const source = process.argv[resumeIndex + 1];
    if (!source)
      throw new Error('--resume cần đường dẫn báo cáo JSON trước đó.');
    const previous = JSON.parse(await readFile(source, 'utf8'));
    if (
      !/^AI33-\d{17}$/.test(previous.runId || '') ||
      !Array.isArray(previous.results) ||
      previous.results.length !== cases.length ||
      new Set(previous.results.map((r) => r.id)).size !== cases.length ||
      new Set(previous.results.map((r) => r.ticket_code)).size !==
      cases.length ||
      previous.results.some(
        (r) =>
          !cases.some((c) => c.id === r.id) ||
          !/^TK-\d{4}$/.test(r.ticket_code || ''),
      )
    )
      throw new Error('Báo cáo phải chứa đủ 8 case và 8 mã ticket riêng biệt.');
    runId = previous.runId;
    report.runId = runId;
    report.recheck = true;
    for (const entry of cases)
      report.results.push({
        id: entry.id,
        ticket_code: previous.results.find((r) => r.id === entry.id)
          .ticket_code,
        expected: entry, // Always use the current acceptance criteria, not edited report expectations.
      });
    console.log(
      'Kiểm tra lại 8 ticket đã có; không tạo ticket hay tự đưa ticket vào thử lại.',
    );
  }
  console.log(
    `Run: ${runId}\nMong đợi: 8 ticket, AI hoàn tất, đúng nhãn/ưu tiên và đúng thứ tự.`,
  );
  const health = await request('/health');
  if (health.database?.status !== 'connected')
    throw new Error('PostgreSQL chưa kết nối.');
  const readiness = await request('/ai/triage/status');
  if (!readiness.ready)
    throw new Error(
      'AI chưa sẵn sàng. Kiểm tra backend/.env rồi khởi động lại backend.',
    );
  console.log(`Provider: ${readiness.provider}; model: ${readiness.model}`);
  if (readiness.provider_blocked_code)
    throw new Error(
      `Provider AI bị chặn: ${readiness.provider_blocked_code}. Sửa cấu hình/billing rồi restart backend trước khi test.`,
    );
  if (resumeIndex < 0 && Date.parse(readiness.provider_retry_at) > Date.now())
    throw new Error(
      `Provider AI đang yêu cầu chờ đến ${readiness.provider_retry_at}. Chưa tạo ticket.`,
    );
  await request('/tickets?limit=1'); // Fail before creating data if migration is missing.

  for (const entry of resumeIndex >= 0 ? [] : cases) {
    const response = await request('/tickets', {
      customer_name: 'Sprint Three AI Test',
      customer_email: 'sprint3-ai@example.com',
      subject: `${runId} ${entry.id}: ${entry.subject}`,
      description: entry.description,
      channel_type: 'web',
      priority: entry.priority,
    });
    const ticket = response.data;
    if (!ticket?.ticket_code)
      throw new Error(`API chưa trả mã ticket cho ${entry.id}.`);
    report.results.push({
      id: entry.id,
      ticket_code: ticket.ticket_code,
      expected: entry,
    });
    console.log(
      `CREATED ${entry.id}: ${ticket.ticket_code}; ai_status=${ticket.ai_status}`,
    );
    await sleep(50); // Ensure a later normal ticket tests priority ordering, not just recency.
  }

  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    for (const row of report.results) {
      if (['completed', 'failed'].includes(row.actual?.ai_status)) continue;
      const response = await request(
        `/tickets/${encodeURIComponent(row.ticket_code)}`,
      );
      const t = response.data;
      if (!t?.subject?.startsWith(`${runId} ${row.id}:`))
        throw new Error(
          `Ticket ${row.ticket_code} không khớp bộ kiểm thử; dừng để tránh nhầm dữ liệu.`,
        );
      row.actual = {
        ai_status: t.ai_status,
        ai_attempts: t.ai_attempts,
        ai_error: t.ai_error,
        ai_next_attempt_at: t.ai_next_attempt_at,
        sentiment_label: t.sentiment_label,
        sentiment_score: t.sentiment_score,
        urgency_score: t.urgency_score,
        priority: t.priority,
        is_urgent_bumped: t.is_urgent_bumped,
        ai_model: t.ai_model,
        ai_reason: t.ai_reason,
        ai_detected_keywords: t.ai_detected_keywords,
        ai_analyzed_at: t.ai_analyzed_at,
      };
    }
    const done = report.results.filter((r) =>
      ['completed', 'failed'].includes(r.actual?.ai_status),
    ).length;
    console.log(`Đã kết thúc phân tích: ${done}/${cases.length}`);
    if (done === cases.length) break;
    const provider = await request('/ai/triage/status');
    if (provider.provider_blocked_code) {
      report.error = `Provider AI bị chặn: ${provider.provider_blocked_code}. Ticket được giữ lại; sửa cấu hình/billing, restart backend và kiểm tra lại.`;
      console.error(report.error);
      break;
    }
    if (Date.parse(provider.provider_retry_at) > deadline) {
      report.error = `Provider AI yêu cầu chờ đến ${provider.provider_retry_at}, vượt thời gian bài test. Ticket vẫn được giữ để kiểm tra lại.`;
      console.error(report.error);
      break;
    }
    await sleep(5000);
  }

  for (const row of report.results) {
    const a = row.actual || {};
    const e = row.expected;
    const confidence = Number(a.sentiment_score);
    const urgency = Number(a.urgency_score);
    row.passed =
      a.ai_status === 'completed' &&
      Boolean(a.ai_analyzed_at) &&
      a.sentiment_label === e.sentiment &&
      a.is_urgent_bumped === e.urgent &&
      a.priority === (e.urgent ? 'urgent' : e.priority) &&
      a.sentiment_score != null &&
      confidence >= 0 &&
      confidence <= 1 &&
      a.urgency_score != null &&
      urgency >= 0 &&
      urgency <= 1;
  }
  const list = await request(
    `/tickets?search=${encodeURIComponent(runId)}&limit=100`,
  );
  const expectedUrgent = new Set(
    report.results.filter((r) => r.expected.urgent).map((r) => r.ticket_code),
  );
  const urgentFirst =
    list.data?.length === cases.length &&
    list.data
      .slice(0, expectedUrgent.size)
      .every(
        (t) =>
          expectedUrgent.has(t.ticket_code) &&
          t.is_urgent_bumped &&
          t.priority === 'urgent',
      );
  const filtered = await request(
    `/tickets?search=${encodeURIComponent(runId)}&is_urgent_bumped=true&limit=100`,
  );
  const sentimentFiltered = await request(
    `/tickets?search=${encodeURIComponent(runId)}&sentiment_label=frustrated&limit=100`,
  );
  const expectedFrustrated = new Set(
    report.results
      .filter((r) => r.expected.sentiment === 'frustrated')
      .map((r) => r.ticket_code),
  );
  report.checks = {
    AllTicketsCreated: list.total === cases.length,
    AllAiCompleted: report.results.every(
      (r) => r.actual?.ai_status === 'completed',
    ),
    AllCasesMatched: report.results.every((r) => r.passed),
    UrgentTicketsFirst: urgentFirst === true,
    UrgentFilterCorrect:
      filtered.total === expectedUrgent.size &&
      filtered.data.every((t) => expectedUrgent.has(t.ticket_code)),
    SentimentFilterCorrect:
      sentimentFiltered.total === expectedFrustrated.size &&
      sentimentFiltered.data.every((t) =>
        expectedFrustrated.has(t.ticket_code),
      ),
    ModelRecorded: report.results.every(
      (r) => r.actual?.ai_model === readiness.model,
    ),
  };
  console.table(
    report.results.map((r) => ({
      Case: r.id,
      Ticket: r.ticket_code,
      Status: r.actual?.ai_status,
      Error: r.actual?.ai_error,
      ExpectedSentiment: r.expected.sentiment,
      ActualSentiment: r.actual?.sentiment_label,
      ExpectedUrgent: r.expected.urgent,
      ActualUrgent: r.actual?.is_urgent_bumped,
      Passed: r.passed,
    })),
  );
  console.table(report.checks);
  if (!Object.values(report.checks).every(Boolean)) process.exitCode = 1;
} catch (error) {
  report.error = error instanceof Error ? error.message : 'Lỗi chưa xác định';
  console.error(report.error);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  const directory = new URL('../artifacts/ai-triage/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const file = new URL(`${reportId}.json`, directory);
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Bằng chứng: ${fileURLToPath(file)}`);
  console.log(
    'Đây là smoke test, không phải phép đo độ chính xác AI trên tập dữ liệu lớn.',
  );
}
