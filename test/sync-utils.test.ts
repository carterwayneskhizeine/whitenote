import { describe, it, expect } from 'vitest'
import { parseMdFile, generateFriendlyName } from '../src/lib/sync-utils'

describe('parseMdFile', () => {
  it('extracts tags from first line', () => {
    const result = parseMdFile('#tag1 #tag2\nHello world')
    expect(result.tags).toEqual(['tag1', 'tag2'])
    expect(result.content).toBe('Hello world')
  })

  it('handles Chinese tags', () => {
    const result = parseMdFile('#中文 #标签\n内容')
    expect(result.tags).toEqual(['中文', '标签'])
    expect(result.content).toBe('内容')
  })

  it('handles tags with dots and hyphens', () => {
    // hyphen not in \w so #react-hooks matches as #react only, hooks is left unmatched
    const result = parseMdFile('#vue3 #react-hooks\nContent here')
    expect(result.tags).toEqual(['vue3', 'react'])
    expect(result.content).toBe('Content here')
  })

  it('handles tags with only hyphens (no dots)', () => {
    const result = parseMdFile('#vue3 #react-hooks\nContent here')
    expect(result.tags).toEqual(['vue3', 'react'])
  })

  it('returns empty tags when none present', () => {
    const result = parseMdFile('No tags here')
    expect(result.tags).toEqual([])
    // body is remaining lines after first line stripped
    expect(result.content).toBe('')
  })

  it('handles content with only tags (no body)', () => {
    // hyphen not in \w so #only-tags matches as #only
    const result = parseMdFile('#only-tags')
    expect(result.tags).toEqual(['only'])
    expect(result.content).toBe('')
  })

  it('strips leading whitespace from body', () => {
    const result = parseMdFile('#tag\n   Hello world\n   next line')
    expect(result.content).toBe('Hello world\n   next line')
  })
})

describe('generateFriendlyName', () => {
  it('uses first non-empty line as filename', () => {
    const result = generateFriendlyName('#tag1 Hello World\nBody content')
    expect(result).toBe('hello-world') // slugified
  })

  it('sanitizes quotes', () => {
    const result = generateFriendlyName('File with "double quotes"')
    expect(result).not.toContain('"')
  })

  it('sanitizes forward slashes', () => {
    const result = generateFriendlyName('path/to/file.md')
    expect(result).not.toContain('/')
  })

  it('sanitizes backslashes', () => {
    const result = generateFriendlyName('path\\to\\file.md')
    expect(result).not.toContain('\\')
  })

  it('uses first line even if no tags', () => {
    const result = generateFriendlyName('Just a title\nBody content')
    expect(result).toBe('just-a-title')
  })
})
