// One synthetic request using the same adapter/config as the backend. No DB writes.
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { ConfigModule, ConfigService } from '@nestjs/config';

try {
  if (
    !existsSync(
      new URL('../dist/modules/ai/triage-provider.service.js', import.meta.url),
    )
  )
    throw new Error('BUILD_REQUIRED');
  await ConfigModule.forRoot({ envFilePath: ['.env', '../.env'] });
  const providerIndex = process.argv.indexOf('--provider');
  if (providerIndex >= 0) {
    const provider = process.argv[providerIndex + 1];
    if (!['gemini', 'openai'].includes(provider))
      throw new Error('INVALID_PROVIDER');
    process.env.LLM_PROVIDER = provider;
    process.env.LLM_MODEL =
      provider === 'gemini' ? 'gemini-3.5-flash-lite' : 'gpt-4.1-mini';
  }
  const modelIndex = process.argv.indexOf('--model');
  if (modelIndex >= 0) {
    const model = process.argv[modelIndex + 1];
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model || ''))
      throw new Error('INVALID_MODEL');
    process.env.LLM_MODEL = model;
  }
  const { default: configuration } =
    await import('../dist/config/configuration.js');
  const { TriageProviderService } =
    await import('../dist/modules/ai/triage-provider.service.js');
  const service = new TriageProviderService(new ConfigService(configuration()));
  if (!service.isReady()) throw new Error('AI_NOT_CONFIGURED');
  console.log(
    `Gọi provider AI đúng một lần; model=${service.model}; không tạo ticket.`,
  );
  const started = Date.now();
  try {
    const result = await service.analyze(
      'Hướng dẫn tải hóa đơn',
      'Tôi muốn biết cách tải hóa đơn. Mọi chức năng đang hoạt động bình thường, yêu cầu này không gấp.',
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          model: service.model,
          elapsedMs: Date.now() - started,
          result,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const code = /^AI_[A-Z0-9_]+$/.test(error?.code || '')
      ? error.code
      : 'AI_CHECK_FAILED';
    const delay = error?.retryAfterMs;
    console.log(
      JSON.stringify(
        {
          ok: false,
          model: service.model,
          code,
          elapsedMs: Date.now() - started,
          retryAfterSeconds: Number.isFinite(delay)
            ? Math.ceil(delay / 1000)
            : null,
          retryAt: service.retryAt,
          blockedCode: service.blockedCode,
        },
        null,
        2,
      ),
    );
    if (code === 'AI_HTTP_429')
      console.log(
        'Provider giới hạn tốc độ. Kiểm tra Limits của project và chờ đến retryAt trước khi thử lại.',
      );
    if (code === 'AI_HTTP_503')
      console.log(
        'Dịch vụ AI tạm thời không đáp ứng. Chờ thời gian retryAt rồi thử lại.',
      );
    if (
      /^AI_(INSUFFICIENT_QUOTA|CREDIT_BALANCE_EXHAUSTED|.*(?:SPEND|USAGE)_LIMIT_EXCEEDED|BILLING_HARD_LIMIT_REACHED)$/.test(
        code,
      )
    )
      console.log(
        'Kiểm tra Billing/credit và Limits của OpenAI project. Thử lại hoặc tạo key mới không tự khắc phục thiếu credit/hạn mức chi tiêu.',
      );
    if (['AI_HTTP_401', 'AI_HTTP_403'].includes(code))
      console.log(
        'Kiểm tra key riêng của provider đang chọn và quyền gọi API của project; không gửi key vào chat.',
      );
    if (code === 'AI_HTTP_404')
      console.log(
        'Kiểm tra LLM_MODEL và quyền truy cập model trong đúng project của provider.',
      );
    if (code === 'AI_HTTP_400')
      console.log(
        'Provider không chấp nhận request/model hiện tại. Cần kiểm tra adapter và cấu hình trước khi chạy lại.',
      );
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    error?.message === 'AI_NOT_CONFIGURED'
      ? 'AI chưa đủ cấu hình. Kiểm tra AI_TRIAGE_ENABLED=true, LLM_PROVIDER, LLM_MODEL và key tương ứng GEMINI_API_KEY/OPENAI_API_KEY trong backend/.env.'
      : 'Chưa nạp được adapter AI. Chạy npm run build trong thư mục backend trước.',
  );
  process.exitCode = 1;
}
