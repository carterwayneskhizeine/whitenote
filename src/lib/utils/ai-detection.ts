/**
 * AI mention detection and mode extraction utility
 */

export type AIMode = 'goldierill' | 'ragflow' | null

export interface AIMentionResult {
  hasMention: boolean
  mode: AIMode
  cleanedContent: string
}

/**
 * Detect AI mentions in content and extract mode
 * @param content - Text content to check for AI mentions
 * @returns Object with mention detection result and cleaned content
 */
export function detectAIMention(content: string): AIMentionResult {
  const hasGoldierillMention = /@goldierill/i.test(content)
  const hasRagflowMention = /@ragflow/i.test(content)

  // If both mentions present, prioritize @ragflow
  if (hasRagflowMention) {
    return {
      hasMention: true,
      mode: 'ragflow',
      cleanedContent: content.replace(/@ragflow/gi, '').trim()
    }
  }

  if (hasGoldierillMention) {
    return {
      hasMention: true,
      mode: 'goldierill',
      cleanedContent: content.replace(/@goldierill/gi, '').trim()
    }
  }

  return {
    hasMention: false,
    mode: null,
    cleanedContent: content
  }
}

/**
 * Check if content contains any AI mention (for UI hints)
 */
export function hasAIMention(content: string): boolean {
  return /@goldierill|@ragflow/i.test(content)
}

/**
 * Get AI mode from content (returns null if no mention)
 */
export function getAIMode(content: string): AIMode {
  const result = detectAIMention(content)
  return result.mode
}
