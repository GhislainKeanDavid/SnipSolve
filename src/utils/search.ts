// Document search utilities - extracted for testability

export interface DocumentChunk {
  docId: string
  docName: string
  chunkIndex: number
  text: string
}

export interface SearchResult {
  docName: string
  text: string
  score: number
}

/**
 * Simple keyword-based search through document chunks
 * Matches words with prefix matching (e.g., "error" matches "errors")
 */
export function searchDocuments(
  query: string,
  documentChunks: Map<string, DocumentChunk[]>,
  topK: number = 3
): SearchResult[] {
  if (!query || query.trim().length === 0) {
    return []
  }

  // Filter words with length > 2 to avoid matching common short words
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  if (queryWords.length === 0) {
    return []
  }

  const results: SearchResult[] = []

  // Search through all chunks
  for (const chunks of documentChunks.values()) {
    for (const chunk of chunks) {
      const chunkText = chunk.text.toLowerCase()

      // Count matching keywords
      let score = 0
      for (const word of queryWords) {
        const regex = new RegExp(`\\b${word}\\w*`, 'gi')
        const matches = chunkText.match(regex)
        if (matches) {
          score += matches.length
        }
      }

      if (score > 0) {
        results.push({
          docName: chunk.docName,
          text: chunk.text,
          score
        })
      }
    }
  }

  // Sort by score descending and return top K
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/**
 * Format keyboard shortcut for display
 * Converts "CommandOrControl+Shift+S" to ["Ctrl", "Shift", "S"]
 */
export function formatShortcut(shortcut: string): string[] {
  return shortcut
    .replace('CommandOrControl', 'Ctrl')
    .split('+')
}
