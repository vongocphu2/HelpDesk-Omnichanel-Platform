export const SENTIMENT_LABELS = ['positive', 'neutral', 'frustrated'] as const;
export type SentimentLabel = (typeof SENTIMENT_LABELS)[number];

export interface TriageResult {
  sentiment: SentimentLabel;
  confidence: number;
  isUrgent: boolean;
  urgencyScore: number;
  keywords: string[];
  reason: string;
}

export class TriageError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = true,
    public readonly retryAfterMs?: number,
  ) {
    super(code);
  }
}

export const TRIAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sentiment: { type: 'string', enum: [...SENTIMENT_LABELS] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    isUrgent: { type: 'boolean' },
    urgencyScore: { type: 'number', minimum: 0, maximum: 1 },
    keywords: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    reason: { type: 'string' },
  },
  required: [
    'sentiment',
    'confidence',
    'isUrgent',
    'urgencyScore',
    'keywords',
    'reason',
  ],
};

export function parseTriageResult(text: string): TriageResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new TriageError('AI_INVALID_JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TriageError('AI_INVALID_RESULT');
  }
  const r = value as Record<string, unknown>;
  const score = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  if (
    !SENTIMENT_LABELS.includes(r.sentiment as SentimentLabel) ||
    !score(r.confidence) ||
    !score(r.urgencyScore) ||
    typeof r.isUrgent !== 'boolean' ||
    !Array.isArray(r.keywords) ||
    r.keywords.length > 10 ||
    r.keywords.some(
      (k) => typeof k !== 'string' || k.length === 0 || k.length > 120,
    ) ||
    typeof r.reason !== 'string' ||
    !r.reason.trim() ||
    r.reason.length > 1000 ||
    Object.keys(r).some((key) => !TRIAGE_SCHEMA.required.includes(key))
  )
    throw new TriageError('AI_INVALID_RESULT');
  return r as unknown as TriageResult;
}

// Anger alone is not urgency. A positive/neutral message can still be urgent.
export function shouldBumpPriority(
  result: TriageResult,
  threshold = 0.8,
): boolean {
  return result.isUrgent && result.urgencyScore >= threshold;
}
