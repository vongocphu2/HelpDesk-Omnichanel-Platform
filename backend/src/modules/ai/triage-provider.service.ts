import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiTriageService } from './gemini-triage.service.js';
import { OpenAiTriageService } from './openai-triage.service.js';

@Injectable()
export class TriageProviderService {
  private readonly provider: GeminiTriageService | OpenAiTriageService;

  constructor(config: ConfigService) {
    this.provider =
      config.get<string>('ai.provider') === 'gemini'
        ? new GeminiTriageService(config)
        : new OpenAiTriageService(config);
  }

  get model() {
    return this.provider.model;
  }
  get timeoutMs() {
    return this.provider.timeoutMs;
  }
  get retryAt() {
    return this.provider.retryAt;
  }
  get blockedCode() {
    return this.provider.blockedCode;
  }
  isReady() {
    return this.provider.isReady();
  }
  analyze(subject: string, description: string) {
    return this.provider.analyze(subject, description);
  }
}
