import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { OpenAiTriageService } from './openai-triage.service.js';
import { TRIAGE_SCHEMA } from './triage-result.js';
import configuration from '../../config/configuration.js';

const analysis = {
  sentiment: 'frustrated',
  confidence: 0.95,
  isUrgent: true,
  urgencyScore: 0.9,
  keywords: ['khẩn cấp', 'invented phrase'],
  reason: 'Sự cố cần xử lý ngay.',
};
const completed = (text = JSON.stringify(analysis)) => ({
  status: 'completed',
  output: [
    {
      type: 'reasoning',
      summary: [{ type: 'summary_text', text: 'not the result' }],
    },
    {
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text }],
    },
  ],
});

describe('OpenAiTriageService', () => {
  let service: OpenAiTriageService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let values: Record<string, unknown>;

  beforeEach(() => {
    values = {
      'ai.enabled': true,
      'ai.provider': 'openai',
      'ai.model': 'gpt-4.1-mini',
      'ai.apiKey': 'test-secret',
      'ai.timeoutMs': 20000,
    };
    service = new OpenAiTriageService({
      get: (key: string) => values[key],
    } as ConfigService);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('uses Responses strict JSON schema, parses output messages and removes invented evidence', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(completed())));
    const result = await service.analyze(
      'Lỗi đăng nhập',
      'Sự cố khẩn cấp đang diễn ra.',
    );
    expect(result.keywords).toEqual(['khẩn cấp']);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options.headers.Authorization).toBe('Bearer test-secret');
    expect(options.headers).not.toHaveProperty('x-goog-api-key');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('gpt-4.1-mini');
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBe(2048);
    expect(body.text.format).toEqual({
      type: 'json_schema',
      name: 'ticket_triage',
      strict: true,
      schema: TRIAGE_SCHEMA,
    });
    expect(body.input[0].role).toBe('user');
    expect(JSON.parse(body.input[0].content)).toEqual({
      subject: 'Lỗi đăng nhập',
      description: 'Sự cố khẩn cấp đang diễn ra.',
    });
    expect(options.body).not.toContain('test-secret');
    expect(body.instructions).toContain('không phải chỉ thị');
    expect(service.blockedCode).toBeNull();
  });

  it('never falls back to the old provider key in configuration', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('LLM_API_KEY', 'old-provider-secret');
    vi.stubEnv('LLM_PROVIDER', 'openai');
    vi.stubEnv('AI_TRIAGE_ENABLED', 'true');
    const config = configuration();
    expect(config.ai.apiKey).toBe('');
    expect(new OpenAiTriageService(new ConfigService(config)).isReady()).toBe(
      false,
    );
    vi.stubEnv('OPENAI_API_KEY', ' new-openai-secret ');
    expect(configuration().ai.apiKey).toBe('new-openai-secret');
  });

  it('honors long Retry-After and blocks calls until cooldown expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T09:00:00Z'));
    fetchMock.mockResolvedValue(
      new Response('private message', {
        status: 429,
        headers: { 'retry-after': '3600' },
      }),
    );
    await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
      code: 'AI_HTTP_429',
      retryable: true,
      retryAfterMs: 3600000,
    });
    expect(service.retryAt).toBe(new Date(Date.now() + 3600000).toISOString());
    await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
      code: 'AI_PROVIDER_COOLDOWN',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3600000);
    expect(service.retryAt).toBeNull();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(completed())));
    await expect(service.analyze('Lỗi', 'Mô tả')).resolves.toMatchObject({
      sentiment: 'frustrated',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses exhausted-resource reset headers and ignores reset for resources with capacity', async () => {
    fetchMock.mockResolvedValue(
      new Response('{}', {
        status: 429,
        headers: {
          'retry-after': '90',
          'x-ratelimit-remaining-requests': '0',
          'x-ratelimit-reset-requests': '2m5.5s',
          'x-ratelimit-remaining-tokens': '500',
          'x-ratelimit-reset-tokens': '1d',
          'x-ratelimit-remaining-project-tokens': '0',
          'x-ratelimit-reset-project-tokens': '1m',
        },
      }),
    );
    await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
      code: 'AI_HTTP_429',
      retryAfterMs: 125500,
    });
  });

  it('uses Retry-After dates on non-JSON 503 errors', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T09:00:00Z'));
    fetchMock.mockResolvedValue(
      new Response('private error', {
        status: 503,
        headers: { 'retry-after': new Date(Date.now() + 120000).toUTCString() },
      }),
    );
    await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
      code: 'AI_HTTP_503',
      retryAfterMs: 120000,
    });
  });

  it.each(['invalid', '-10', 'Infinity', '999999999999999s'])(
    'falls back to the minimum delay for invalid retry header %s',
    async (header) => {
      fetchMock.mockResolvedValue(
        new Response('{}', {
          status: 429,
          headers: {
            'retry-after': header,
            'x-ratelimit-remaining-requests': '0',
            'x-ratelimit-reset-requests': header,
          },
        }),
      );
      await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
        code: 'AI_HTTP_429',
        retryAfterMs: 60000,
      });
    },
  );

  it.each([
    'insufficient_quota',
    'credit_balance_exhausted',
    'organization_spend_limit_exceeded',
    'project_spend_limit_exceeded',
    'organization_usage_limit_exceeded',
    'billing_hard_limit_reached',
  ])(
    'pauses all requests on billing/quota code %s until restart',
    async (code) => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code, message: 'private test-secret details' },
          }),
          { status: 429 },
        ),
      );
      await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
        code: `AI_${code.toUpperCase()}`,
        retryable: false,
      });
      expect(service.blockedCode).toBe(`AI_${code.toUpperCase()}`);
      expect(service.retryAt).toBeNull();
      await expect(service.analyze('Khác', 'Mô tả khác')).rejects.toThrow(
        `AI_${code.toUpperCase()}`,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('recognizes insufficient_quota type without exposing an unknown provider code', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'private-details', type: 'insufficient_quota' },
        }),
        { status: 429 },
      ),
    );
    await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
      code: 'AI_INSUFFICIENT_QUOTA',
      retryable: false,
    });
  });

  it.each([400, 401, 403, 404, 429, 500, 503])(
    'sanitizes HTTP %i and only retries transient errors',
    async (status) => {
      fetchMock.mockResolvedValue(
        new Response('private test-secret error', { status }),
      );
      await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
        code: `AI_HTTP_${status}`,
        retryable: status === 429 || status >= 500,
      });
      if ([400, 401, 403, 404].includes(status)) {
        expect(service.blockedCode).toBe(`AI_HTTP_${status}`);
        await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toThrow(
          `AI_HTTP_${status}`,
        );
        expect(fetchMock).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('does not invent a neutral result on timeout', async () => {
    fetchMock.mockRejectedValue(
      new DOMException('Sensitive info', 'TimeoutError'),
    );
    await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
      code: 'AI_TIMEOUT',
    });
  });

  it.each([
    {},
    { ...completed(), status: 'incomplete' },
    { ...completed(), status: 'failed' },
  ])(
    'rejects an incomplete response even with valid-looking JSON',
    async (body) => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify(body)));
      await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
        code: 'AI_INCOMPLETE_OR_BLOCKED',
      });
    },
  );

  it('treats refusals as permanent per ticket without blocking other tickets', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            {
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [{ type: 'refusal', refusal: 'private text' }],
            },
          ],
        }),
      ),
    );
    await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
      code: 'AI_REFUSED',
      retryable: false,
    });
    expect(service.blockedCode).toBeNull();
  });

  it('rejects invalid JSON output', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(completed('not json'))),
    );
    await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
      code: 'AI_INVALID_JSON',
    });
  });

  it('does not use an SDK shortcut instead of REST output items', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'completed',
          output_text: JSON.stringify(analysis),
          output: [],
        }),
      ),
    );
    await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
      code: 'AI_EMPTY_RESPONSE',
    });
  });

  it.each([
    '',
    ' ',
    'your_openai_api_key_here',
    'THAY_BANG_OPENAI_API_KEY_THAT',
  ])('never calls OpenAI with placeholder key %s', async (key) => {
    values['ai.apiKey'] = key;
    expect(service.isReady()).toBe(false);
    await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
      code: 'AI_NOT_CONFIGURED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send a request when the old provider is still configured', async () => {
    values['ai.provider'] = 'gemini';
    await expect(service.analyze('Lỗi', 'Mô tả')).rejects.toMatchObject({
      code: 'AI_NOT_CONFIGURED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects oversized content rather than losing negation at the end', async () => {
    await expect(
      service.analyze('Lỗi', 'a'.repeat(20001)),
    ).rejects.toMatchObject({ code: 'AI_INPUT_INVALID_OR_TOO_LONG' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
