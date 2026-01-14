import { describe, it, expect } from 'vitest'
import { searchDocuments, formatShortcut, DocumentChunk } from './search'

describe('searchDocuments', () => {
  const createTestChunks = (): Map<string, DocumentChunk[]> => {
    const chunks = new Map<string, DocumentChunk[]>()

    chunks.set('doc1', [
      {
        docId: 'doc1',
        docName: 'Error Handling SOP.pdf',
        chunkIndex: 0,
        text: 'When encountering a database connection error, first check the connection string in the .env file.'
      },
      {
        docId: 'doc1',
        docName: 'Error Handling SOP.pdf',
        chunkIndex: 1,
        text: 'For timeout errors, increase the connection timeout value to 30 seconds.'
      }
    ])

    chunks.set('doc2', [
      {
        docId: 'doc2',
        docName: 'Deployment Guide.pdf',
        chunkIndex: 0,
        text: 'To deploy the application, run npm run build and copy the dist folder to the server.'
      }
    ])

    return chunks
  }

  it('should return empty array for empty query', () => {
    const chunks = createTestChunks()
    expect(searchDocuments('', chunks)).toEqual([])
    expect(searchDocuments('   ', chunks)).toEqual([])
  })

  it('should return empty array for short words only', () => {
    const chunks = createTestChunks()
    expect(searchDocuments('a b c', chunks)).toEqual([])
  })

  it('should find documents matching keywords', () => {
    const chunks = createTestChunks()
    const results = searchDocuments('database connection error', chunks)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].docName).toBe('Error Handling SOP.pdf')
  })

  it('should rank results by score (more matches = higher score)', () => {
    const chunks = createTestChunks()
    const results = searchDocuments('error connection', chunks)

    // First result should have the highest score
    expect(results[0].score).toBeGreaterThanOrEqual(results[results.length - 1].score)
  })

  it('should limit results to topK', () => {
    const chunks = createTestChunks()
    const results = searchDocuments('error', chunks, 1)

    expect(results.length).toBeLessThanOrEqual(1)
  })

  it('should match word prefixes', () => {
    const chunks = createTestChunks()
    // "deploy" should match "deployment"
    const results = searchDocuments('deploy', chunks)

    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.docName === 'Deployment Guide.pdf')).toBe(true)
  })

  it('should return empty array when no matches found', () => {
    const chunks = createTestChunks()
    const results = searchDocuments('xyznonexistent', chunks)

    expect(results).toEqual([])
  })

  it('should handle empty chunks map', () => {
    const emptyChunks = new Map<string, DocumentChunk[]>()
    const results = searchDocuments('error', emptyChunks)

    expect(results).toEqual([])
  })
})

describe('formatShortcut', () => {
  it('should replace CommandOrControl with Ctrl', () => {
    const result = formatShortcut('CommandOrControl+Shift+S')
    expect(result).toEqual(['Ctrl', 'Shift', 'S'])
  })

  it('should split by + character', () => {
    const result = formatShortcut('Alt+Tab')
    expect(result).toEqual(['Alt', 'Tab'])
  })

  it('should handle single key', () => {
    const result = formatShortcut('F12')
    expect(result).toEqual(['F12'])
  })

  it('should preserve other modifiers', () => {
    const result = formatShortcut('CommandOrControl+Alt+Delete')
    expect(result).toEqual(['Ctrl', 'Alt', 'Delete'])
  })
})
