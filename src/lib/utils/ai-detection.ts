/**
 * AI mention detection and mode extraction utility
 */

export type AIMode = 'goldierill' | 'rag' | null

export interface AIMentionResult {
  hasMention: boolean
  mode: AIMode
  cleanedContent: string
}

/**
 * Detect AI mentions in content and extract mode
 */
export function detectAIMention(content: string): AIMentionResult {
  const hasGoldierillMention = /@goldierill/i.test(content)
  const hasRagMention = /@rag\b/i.test(content)

  // If both mentions present, prioritize @rag
  if (hasRagMention) {
    return {
      hasMention: true,
      mode: 'rag',
      cleanedContent: content.replace(/@rag\b/gi, '').trim()
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
  return /@goldierill|@rag\b/i.test(content)
}

/**
 * Get AI mode from content (returns null if no mention)
 */
export function getAIMode(content: string): AIMode {
  const result = detectAIMention(content)
  return result.mode
}
