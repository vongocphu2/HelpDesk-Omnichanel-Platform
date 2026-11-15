import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import configuration from '../../config/configuration.js';
import { GeminiTriageService } from './gemini-triage.service.js';
import { TriageProviderService } from './triage-provider.service.js';

const analysis = {
  sentiment: 'neutral',
  confidence: 0.9,
  isUrgent: true,
  urgencyScore: 0.95,
  keywords: ['khẩn cấp', 'invented'],
  reason: 'Sự cố đang diễn ra.',
};

describe('Gemini triage integration', () => {
  let service: GeminiTriageService;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubEnv('AI_TRIAGE_ENABLED', 'true');
    vi.stubEnv('LLM_PROVIDER', 'gemini');
    vi.stubEnv('LLM_MODEL', 'gemini-3.5-flash-lite');
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-secret');
    vi.stubEnv('OPENAI_API_KEY', 'different-openai-secret');
    service = new GeminiTriageService(new ConfigService(configuration()));
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('routes the configured provider through native Gemini with structured output and real evidence', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  { thought: true, text: 'internal thought' },
                  { text: JSON.stringify(analysis) },
                ],
              },
            },
          ],
        }),
      ),
    );
    const provider = new TriageProviderService(
      new ConfigService(configuration()),
    );
    expect(provider.isReady()).toBe(true);
    const result = await provider.analyze(
      'Yêu cầu',
      'Sự cố khẩn cấp đang diễn ra.',
    );
    expect(result.keywords).toEqual(['khẩn cấp']);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    );
    expect(options.headers['x-goog-api-key']).toBe('test-gemini-secret');
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(options.body).not.toContain('secret');
    const body = JSON.parse(options.body);
    expect(body.generationConfig.responseJsonSchema.required).toContain(
      'urgencyScore',
    );
    expect(JSON.parse(body.contents[0].parts[0].text).description).toBe(
      'Sự cố khẩn cấp đang diễn ra.',
    );
  });

  it('requires a Gemini key even when an OpenAI key is present', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(configuration().ai.apiKey).toBe('');
    expect(
      new TriageProviderService(new ConfigService(configuration())).isReady(),
    ).toBe(false);
  });

  it.each([400, 401, 403, 404])(
    'blocks further requests after HTTP %i without exposing provider details',
    async (status) => {
      fetchMock.mockResolvedValue(
        new Response('test-gemini-secret private provider error', { status }),
      );
      await expect(
        service.analyze('Yêu cầu', 'Nội dung yêu cầu'),
      ).rejects.toMatchObject({ code: `AI_HTTP_${status}`, retryable: false });
      await expect(
        service.analyze('Yêu cầu', 'Nội dung yêu cầu'),
      ).rejects.toMatchObject({ code: `AI_HTTP_${status}` });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([429, 503])(
    'respects Google retry delay after HTTP %i',
    async (status) => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              details: [
                {
                  '@type': 'type.googleapis.com/google.rpc.RetryInfo',
                  retryDelay: '120s',
                },
              ],
            },
          }),
          { status },
        ),
      );
      await expect(
        service.analyze('Yêu cầu', 'Nội dung yêu cầu'),
      ).rejects.toMatchObject({
        code: `AI_HTTP_${status}`,
        retryAfterMs: 120000,
      });
      expect(service.retryAt).not.toBeNull();
      await expect(
        service.analyze('Yêu cầu', 'Nội dung yêu cầu'),
      ).rejects.toMatchObject({ code: 'AI_PROVIDER_COOLDOWN' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['MAX_TOKENS', 'SAFETY'])(
    'does not save incomplete or blocked %s output as an analysis',
    async (finishReason) => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason,
                content: { parts: [{ text: JSON.stringify(analysis) }] },
              },
            ],
          }),
        ),
      );
      await expect(
        service.analyze('Yêu cầu', 'Nội dung yêu cầu'),
      ).rejects.toMatchObject({ code: 'AI_INCOMPLETE_OR_BLOCKED' });
    },
  );
});
