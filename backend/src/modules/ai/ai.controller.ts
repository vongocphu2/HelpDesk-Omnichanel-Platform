import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TriageProviderService } from './triage-provider.service.js';
import { SENTIMENT_LABELS } from './triage-result.js';

@Controller('ai/triage')
export class AiController {
  constructor(
    private readonly provider: TriageProviderService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  status() {
    // Deliberately expose no API key, credentials or customer content.
    return {
      enabled: this.config.get<boolean>('ai.enabled') === true,
      ready: this.provider.isReady(),
      provider: this.config.get<string>('ai.provider'),
      model: this.provider.model,
      timeout_ms: this.provider.timeoutMs,
      provider_retry_at: this.provider.retryAt,
      provider_blocked_code: this.provider.blockedCode,
      sentiment_labels: SENTIMENT_LABELS,
      urgency_threshold: this.config.get<number>('ai.urgencyThreshold') ?? 0.8,
    };
  }
}
