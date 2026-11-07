import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TRIAGE_INSTRUCTIONS } from './triage-instructions.js';
import {
  parseTriageResult,
  TRIAGE_SCHEMA,
  TriageError,
} from './triage-result.js';
import type { TriageResult } from './triage-result.js';

@Injectable()
export class GeminiTriageService {
  private cooldownUntil = 0;
  private blockedError: string | null = null;

  constructor(private readonly config: ConfigService) {}

  get model(): string {
    return this.config.get<string>('ai.model') || '';
  }
  get timeoutMs(): number {
    return this.config.get<number>('ai.timeoutMs') || 60000;
  }
  get retryAt(): string | null {
    return this.cooldownUntil > Date.now()
      ? new Date(this.cooldownUntil).toISOString()
      : null;
  }
  get blockedCode(): string | null {
    return this.blockedError;
  }

  isReady(): boolean {
    const key = (this.config.get<string>('ai.apiKey') || '').trim();
    return (
      this.config.get<boolean>('ai.enabled') === true &&
      this.config.get<string>('ai.provider') === 'gemini' &&
      Boolean(key) &&
      !/^(your_|placeholder|THAY_BANG_)/i.test(key) &&
      /^gemini-[a-zA-Z0-9._-]{1,100}$/.test(this.model)
    );
  }

  async analyze(subject: string, description: string): Promise<TriageResult> {
    if (!this.isReady()) throw new TriageError('AI_NOT_CONFIGURED', false);
    if (this.blockedError) throw new TriageError(this.blockedError, false);
    if (this.cooldownUntil > Date.now())
      throw new TriageError(
        'AI_PROVIDER_COOLDOWN',
        true,
        this.cooldownUntil - Date.now(),
      );
    if (!description.trim() || subject.length + description.length > 20000)
      throw new TriageError('AI_INPUT_INVALID_OR_TOO_LONG', false);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.config.get<string>('ai.apiKey')!.trim(),
          },
          signal: AbortSignal.timeout(this.timeoutMs),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: TRIAGE_INSTRUCTIONS }] },
            contents: [
              {
                role: 'user',
                parts: [{ text: JSON.stringify({ subject, description }) }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema: TRIAGE_SCHEMA,
              maxOutputTokens: 2048,
            },
          }),
        },
      );
      if (!response.ok) throw await this.httpFailure(response);
      const payload = (await response.json()) as {
        promptFeedback?: { blockReason?: string };
        candidates?: {
          finishReason?: string;
          content?: { parts?: { text?: string; thought?: boolean }[] };
        }[];
      };
      if (payload.promptFeedback?.blockReason)
        throw new TriageError('AI_REFUSED', false);
      const candidate = payload.candidates?.[0];
      if (!candidate || candidate.finishReason !== 'STOP')
        throw new TriageError('AI_INCOMPLETE_OR_BLOCKED');
      const text = (candidate.content?.parts || [])
        .filter((p) => !p.thought)
        .map((p) => p.text || '')
        .join('');
      if (!text) throw new TriageError('AI_EMPTY_RESPONSE');
      const result = parseTriageResult(text);
      const source = `${subject}\n${description}`.toLocaleLowerCase();
      result.keywords = result.keywords.filter((k) =>
        source.includes(k.toLocaleLowerCase()),
      );
      return result;
    } catch (error) {
      if (error instanceof TriageError) throw error;
      if (
        error instanceof Error &&
        ['TimeoutError', 'AbortError'].includes(error.name)
      )
        throw new TriageError('AI_TIMEOUT');
      throw new TriageError('AI_NETWORK_OR_RESPONSE_ERROR');
    }
  }

  private async httpFailure(response: Response): Promise<TriageError> {
    const code = `AI_HTTP_${response.status}`;
    if ([400, 401, 403, 404].includes(response.status)) {
      this.blockedError = code;
      return new TriageError(code, false);
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable) return new TriageError(code, false);
    const delays = [60000];
    const header = response.headers.get('retry-after');
    if (header) {
      const delay = /^\d+(\.\d+)?$/.test(header)
        ? Number(header) * 1000
        : Date.parse(header) - Date.now();
      if (Number.isFinite(delay) && delay >= 0) delays.push(delay);
    }
    try {
      const body = (await response.json()) as {
        error?: { details?: { '@type'?: string; retryDelay?: string }[] };
      };
      for (const detail of body.error?.details || []) {
        if (
          detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' &&
          /^\d+(\.\d+)?s$/.test(detail.retryDelay || '')
        )
          delays.push(Number(detail.retryDelay!.slice(0, -1)) * 1000);
      }
    } catch {
      // HTTP status remains usable when a gateway returns a non-JSON response.
    }
    const delay = Math.ceil(Math.max(...delays));
    this.cooldownUntil = Date.now() + delay;
    return new TriageError(code, true, delay);
  }
}
