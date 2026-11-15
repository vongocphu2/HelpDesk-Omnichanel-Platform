import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  parseTriageResult,
  TRIAGE_SCHEMA,
  TriageError,
} from './triage-result.js';
import type { TriageResult } from './triage-result.js';

import { TRIAGE_INSTRUCTIONS } from './triage-instructions.js';

@Injectable()
export class OpenAiTriageService {
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
      this.config.get<string>('ai.provider') === 'openai' &&
      Boolean(key) &&
      !/^(your_|placeholder|THAY_BANG_)/i.test(key) &&
      /^[a-zA-Z0-9._-]{1,100}$/.test(this.model)
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
    if (!description.trim() || subject.length + description.length > 20000) {
      throw new TriageError('AI_INPUT_INVALID_OR_TOO_LONG', false);
    }
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.get<string>('ai.apiKey')!.trim()}`,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model: this.model,
          store: false,
          instructions: TRIAGE_INSTRUCTIONS,
          input: [
            {
              role: 'user',
              content: JSON.stringify({ subject, description }),
            },
          ],
          max_output_tokens: 2048,
          text: {
            format: {
              type: 'json_schema',
              name: 'ticket_triage',
              strict: true,
              schema: TRIAGE_SCHEMA,
            },
          },
        }),
      });
      if (!response.ok) {
        throw await this.httpFailure(response);
      }
      const payload = (await response.json()) as {
        status?: string;
        output?: {
          type?: string;
          role?: string;
          status?: string;
          content?: { type?: string; text?: string }[];
        }[];
      };
      if (payload.status !== 'completed')
        throw new TriageError('AI_INCOMPLETE_OR_BLOCKED');
      // REST responses expose output items, not the SDK's output_text shortcut.
      const messages = (payload.output || []).filter(
        (item) => item.type === 'message' && item.role === 'assistant',
      );
      if (messages.some((message) => message.status !== 'completed'))
        throw new TriageError('AI_INCOMPLETE_OR_BLOCKED');
      const content = messages.flatMap((message) => message.content || []);
      if (content.some((part) => part.type === 'refusal'))
        throw new TriageError('AI_REFUSED', false);
      const text = content
        .filter((part) => part.type === 'output_text')
        .map((part) => part.text || '')
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
      ) {
        throw new TriageError('AI_TIMEOUT');
      }
      throw new TriageError('AI_NETWORK_OR_RESPONSE_ERROR');
    }
  }

  private async httpFailure(response: Response): Promise<TriageError> {
    let code = `AI_HTTP_${response.status}`;
    let permanent = [400, 401, 403, 404].includes(response.status);
    try {
      const body = (await response.json()) as {
        error?: { code?: string; type?: string };
      };
      const quotaCodes = new Set([
        'insufficient_quota',
        'credit_balance_exhausted',
        'organization_spend_limit_exceeded',
        'project_spend_limit_exceeded',
        'organization_usage_limit_exceeded',
        'billing_hard_limit_reached',
      ]);
      // Only allowlisted codes escape this boundary; never provider messages/keys.
      if (response.status === 429) {
        const quota = quotaCodes.has(body.error?.code || '')
          ? body.error!.code!
          : body.error?.type === 'insufficient_quota'
            ? 'insufficient_quota'
            : null;
        if (quota) {
          code = `AI_${quota.toUpperCase()}`;
          permanent = true;
        }
      }
    } catch {
      // Preserve HTTP status even when a gateway returns HTML or malformed JSON.
    }
    if (permanent) {
      // Pause the entire worker until configuration/billing is fixed and restarted.
      this.blockedError = code;
      return new TriageError(code, false);
    }
    const retryable = response.status === 429 || response.status >= 500;
    const retryAfterMs = retryable ? this.readRetryDelay(response) : undefined;
    if (retryAfterMs) this.cooldownUntil = Date.now() + retryAfterMs;
    return new TriageError(code, retryable, retryAfterMs);
  }

  private readRetryDelay(response: Response): number {
    const delays: number[] = [];
    const add = (ms: number) => {
      if (Number.isFinite(ms) && ms >= 0 && ms <= 365 * 86400000)
        delays.push(Math.ceil(ms));
    };
    const header = response.headers.get('retry-after');
    if (header) {
      if (/^\d+(\.\d+)?$/.test(header)) add(Number(header) * 1000);
      else add(Date.parse(header) - Date.now());
    }
    if (response.status === 429) {
      for (const resource of ['requests', 'tokens', 'project-tokens']) {
        if (response.headers.get(`x-ratelimit-remaining-${resource}`) !== '0')
          continue;
        const reset =
          response.headers.get(`x-ratelimit-reset-${resource}`) || '';
        if (!/^(?:\d+(?:\.\d+)?(?:ms|s|m|h|d))+$/.test(reset)) continue;
        const units: Record<string, number> = {
          ms: 1,
          s: 1000,
          m: 60000,
          h: 3600000,
          d: 86400000,
        };
        let duration = 0;
        for (const match of reset.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h|d)/g))
          duration += Number(match[1]) * units[match[2]];
        add(duration);
      }
    }
    // Conservative local minimum, not a promise that the provider recovers in 60s.
    return Math.max(60000, ...delays);
  }
}
