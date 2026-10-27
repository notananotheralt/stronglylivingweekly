import type { PrivacyMode } from './models'

export interface StripMessage {
  label: 'This week' | 'Remember'
  text: string
}

// Curated for a quiet, action-oriented rotation from the open Quotable data
// repository snapshot downloaded on 2026-08-15. Keeping this subset offline
// makes the footer dependable even when the public API or Wi-Fi is unavailable.
// Source: https://github.com/quotable-io/data/blob/master/data/quotes.json
export const DEFAULT_QUOTES = [
  'In the depth of winter, I finally learned that there was within me an invincible summer. — Albert Camus',
  'Nothing great was ever achieved without enthusiasm. — Ralph Waldo Emerson',
  'Waste no more time arguing about what a good man should be. Be one. — Marcus Aurelius',
  'Make the most of yourself, for that is all there is of you. — Ralph Waldo Emerson',
  'Difficulties are things that show a person what they are. — Epictetus',
  'Nothing in life is to be feared. It is only to be understood. — Marie Curie',
  'If it is not right do not do it; if it is not true do not say it. — Marcus Aurelius',
  'Excellence is to do a common thing in an uncommon way. — Booker T. Washington',
  'When we are no longer able to change a situation, we are challenged to change ourselves. — Viktor Frankl',
  'How wonderful it is that nobody need wait a single moment before starting to improve the world. — Anne Frank',
  'Make the best use of what is in your power and take the rest as it happens. — Epictetus',
  'I cannot make my days longer, so I strive to make them better. — Henry David Thoreau',
  'We may encounter many defeats, but we must not be defeated. — Maya Angelou',
  'First say to yourself what you would be; and then do what you have to do. — Epictetus',
  'Begin at once to live and count each separate day as a separate life. — Seneca the Younger',
  'The years teach much which the days never know. — Ralph Waldo Emerson',
  'Life is a progress, and not a station. — Ralph Waldo Emerson',
  'Optimism is the faith that leads to achievement. Nothing can be done without hope and confidence. — Helen Keller',
  'You cannot escape the responsibility of tomorrow by evading it today. — Abraham Lincoln',
]

export function parseQuoteRotation(source: string): string[] {
  return Array.from(
    new Set(
      source
        .split(/\r?\n/)
        .map((quote) => quote.trim())
        .filter(Boolean),
    ),
  )
}

export function createStripMessages(
  privacyMode: PrivacyMode,
  currentCommitment: string,
  quoteSource: string,
): StripMessage[] {
  const customQuotes = parseQuoteRotation(quoteSource)
  const quotes = customQuotes.length > 0 ? customQuotes : DEFAULT_QUOTES
  const messages: StripMessage[] = quotes.map((text) => ({
    label: 'Remember',
    text,
  }))

  if (privacyMode === 'personal' && currentCommitment.trim()) {
    messages.unshift({
      label: 'This week',
      text: currentCommitment.trim(),
    })
  }

  return messages
}
