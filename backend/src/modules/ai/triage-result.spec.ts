import { describe, expect, it } from 'vitest';
import {
  parseTriageResult,
  shouldBumpPriority,
  TriageError,
} from './triage-result.js';

const sample = {
  sentiment: 'frustrated' as const,
  confidence: 0.95,
  isUrgent: true,
  urgencyScore: 0.94,
  keywords: ['khẩn cấp'],
  reason: 'Đang bị gián đoạn toàn hệ thống.',
};

describe('Triage validation and priority policy', () => {
  it('accepts a valid structured result', () => {
    expect(parseTriageResult(JSON.stringify(sample))).toEqual(sample);
  });

  it.each([
    { sentiment: 'angry' },
    { confidence: 1.1 },
    { urgencyScore: -0.1 },
    { confidence: '0.9' },
    { isUrgent: 'true' },
    { keywords: 'gấp' },
    { keywords: [42] },
    { keywords: Array(11).fill('gấp') },
    { reason: '' },
    { unexpected: 'ignore rules' },
    { isUrgent: undefined },
  ])('rejects invalid model output %j', (patch) => {
    expect(() =>
      parseTriageResult(JSON.stringify({ ...sample, ...patch })),
    ).toThrow(TriageError);
  });

  it.each(['not json', 'null', '[]', '{}', '```json\n{}\n```'])(
    'rejects %s',
    (text) => {
      expect(() => parseTriageResult(text)).toThrow(TriageError);
    },
  );

  it('bumps at the boundary and above', () => {
    expect(shouldBumpPriority({ ...sample, urgencyScore: 0.8 })).toBe(true);
    expect(shouldBumpPriority(sample)).toBe(true);
  });

  it('does not bump anger alone, negated urgency, or low-confidence urgency', () => {
    expect(shouldBumpPriority({ ...sample, isUrgent: false })).toBe(false);
    expect(shouldBumpPriority({ ...sample, urgencyScore: 0.799 })).toBe(false);
  });

  it('can bump neutral but urgent customer requests', () => {
    expect(shouldBumpPriority({ ...sample, sentiment: 'neutral' })).toBe(true);
  });
});
