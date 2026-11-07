import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller.js';
import { TriageProviderService } from './triage-provider.service.js';

describe('AI readiness endpoint', () => {
  it('reports configuration without disclosing the key or calling OpenAI', () => {
    const config = new ConfigService({
      ai: {
        enabled: true,
        provider: 'openai',
        apiKey: 'private-test-key',
        model: 'gpt-4.1-mini',
        urgencyThreshold: 0.8,
      },
    });
    const controller = new AiController(
      new TriageProviderService(config),
      config,
    );
    const status = controller.status();
    expect(status.ready).toBe(true);
    expect(status.sentiment_labels).toEqual([
      'positive',
      'neutral',
      'frustrated',
    ]);
    expect(JSON.stringify(status)).not.toContain('private-test-key');
  });
});
