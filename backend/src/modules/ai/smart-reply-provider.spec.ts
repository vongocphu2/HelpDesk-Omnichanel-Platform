import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartReplyService } from './smart-reply.service.js';
import { TriageProviderService } from './triage-provider.service.js';
import { ConfigService } from '@nestjs/config';

afterEach(() => vi.unstubAllGlobals());

function service(provider: string) {
  const config = new ConfigService({
    ai: {
      enabled: true,
      provider,
      apiKey: 'test-key',
      model: provider === 'gemini' ? 'gemini-test' : 'gpt-4.1-mini',
      timeoutMs: 1000,
    },
  });
  return new SmartReplyService(
    {
      findOne: async () => ({
        ticket_id: 'id',
        ticket_code: 'TK-1001',
        subject: 'Support',
        channel: { channel_type: 'web' },
      }),
      query: async () => [],
    } as never,
    {
      find: async () => [{ sender_type: 'customer', content: 'Please help' }],
    } as never,
    new TriageProviderService(config),
    config,
  );
}

describe('Smart Reply provider integration', () => {
  it('uses OpenAI configuration and reads Responses API text', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: 'Xin chào' }],
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await service('openai').generateDraft('TK-1001')).draft).toBe(
      'Xin chào',
    );
    const [url, request] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(JSON.parse(request.body as string)).toMatchObject({
      model: 'gpt-4.1-mini',
      store: false,
    });
  });
  it('continues supporting Gemini', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: 'Xin chào' }] },
            },
          ],
        }),
      })),
    );
    expect((await service('gemini').generateDraft('TK-1001')).draft).toBe(
      'Xin chào',
    );
  });
  it.each(['openai', 'gemini'])(
    'rejects incomplete output from %s',
    async (provider) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            status: 'incomplete',
            candidates: [
              {
                finishReason: 'MAX_TOKENS',
                content: { parts: [{ text: 'partial' }] },
              },
            ],
          }),
        })),
      );
      await expect(service(provider).generateDraft('TK-1001')).rejects.toThrow(
        'AI_INCOMPLETE_OR_BLOCKED',
      );
    },
  );
});
