import { describe, expect, it } from 'vitest'

import {
  createStripMessages,
  DEFAULT_QUOTES,
  parseQuoteRotation,
} from './quoteRotation'

describe('motivational strip rotation', () => {
  it('parses one editable quote per line and removes duplicates', () => {
    expect(parseQuoteRotation('First\n\nSecond\nFirst')).toEqual([
      'First',
      'Second',
    ])
  })

  it('rotates a current commitment with quotes only in Personal mode', () => {
    expect(createStripMessages('personal', 'Keep going', 'A quote')[0]).toEqual({
      label: 'This week',
      text: 'Keep going',
    })
    expect(createStripMessages('privacy', 'Private text', 'A quote')).toEqual([
      { label: 'Remember', text: 'A quote' },
    ])
  })

  it('uses quiet built-in prompts when no custom quotes are saved', () => {
    expect(createStripMessages('privacy', '', '')).toHaveLength(
      DEFAULT_QUOTES.length,
    )
    expect(DEFAULT_QUOTES).toHaveLength(19)
    expect(DEFAULT_QUOTES.every((quote) => quote.includes(' — '))).toBe(true)
    expect(DEFAULT_QUOTES).not.toContain(
      'A strong life is built one deliberate week at a time.',
    )
  })
})
