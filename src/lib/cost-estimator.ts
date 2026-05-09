// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Model Cost Estimator (v1.1)
// ---------------------------------------------------------------------------

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheReadPerMillion: number;
  cacheWritePerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6': {
    inputPerMillion: 15,
    outputPerMillion: 75,
    cacheReadPerMillion: 1.5,
    cacheWritePerMillion: 18.75,
  },
  'claude-sonnet-4-6': {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheWritePerMillion: 3.75,
  },
  'claude-haiku-4-5': {
    inputPerMillion: 0.80,
    outputPerMillion: 4,
    cacheReadPerMillion: 0.08,
    cacheWritePerMillion: 1,
  },
};

/**
 * Find pricing for a model by exact match or prefix match.
 * Falls back to claude-sonnet-4-6 pricing if no match.
 */
export function findPricing(model: string): ModelPricing {
  if (!model) return MODEL_PRICING['claude-sonnet-4-6'];

  // Exact match
  const exact = MODEL_PRICING[model];
  if (exact) return exact;

  // Prefix match: compare first two segments (e.g. "claude-opus")
  const prefix = Object.keys(MODEL_PRICING).find((k) => {
    const keyPrefix = k.split('-').slice(0, 2).join('-');
    return model.startsWith(keyPrefix);
  });

  return prefix ? MODEL_PRICING[prefix] : MODEL_PRICING['claude-sonnet-4-6'];
}

/**
 * Estimate USD cost for a single turn based on token usage and model.
 */
export function estimateCost(turn: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}): number {
  const p = findPricing(turn.model);
  return (
    (turn.inputTokens / 1_000_000) * p.inputPerMillion +
    (turn.outputTokens / 1_000_000) * p.outputPerMillion +
    (turn.cacheReadTokens / 1_000_000) * p.cacheReadPerMillion +
    (turn.cacheCreationTokens / 1_000_000) * p.cacheWritePerMillion
  );
}
