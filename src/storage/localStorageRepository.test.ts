import { describe, expect, it } from 'vitest'

import { parseBackup, parseTimelineSeed } from './localStorageRepository'

const settings = {
  birthDate: '2000-01-01',
  weekStartsOn: 1,
  privacyMode: 'privacy',
  quote: '',
  showDate: true,
  showYearProgress: true,
  showWeekRemaining: true,
}

describe('backup validation', () => {
  it('accepts a valid version two backup', () => {
    const backup = parseBackup(
      JSON.stringify({
        version: 2,
        exportedAt: '2026-07-19T00:00:00.000Z',
        settings,
        entries: {
          '2026-07-13': {
            weekStart: '2026-07-13',
            whatHappened: 'A good week.',
            rating: 4,
            nextCommitment: 'Keep going.',
            reviewKind: 'on-time',
            sealedAt: '2026-07-20T08:00:00.000Z',
            updatedAt: '2026-07-20T08:00:00.000Z',
          },
        },
        dailyNotes: {
          '2026-07-15': {
            date: '2026-07-15',
            text: 'Made progress.',
            capturedAt: '2026-07-15T08:00:00.000Z',
            retrospective: false,
          },
        },
      }),
    )

    expect(backup.version).toBe(2)
    expect(backup.settings.privacyMode).toBe('privacy')
    expect(backup.settings.appearance.themeId).toBe('desktop')
    expect(backup.settings.lifeChapters).toEqual([])
    expect(backup.entries['2026-07-13']?.rating).toBe(4)
    expect(backup.dailyNotes['2026-07-15']?.text).toBe('Made progress.')
  })

  it('migrates a version one backup without losing reflection text', () => {
    const backup = parseBackup(
      JSON.stringify({
        version: 1,
        exportedAt: '2026-07-19T00:00:00.000Z',
        settings: {
          birthDate: '2000-01-01',
          targetAge: 90,
          weekStartsOn: 1,
        },
        entries: {
          '2026-07-13': {
            weekStart: '2026-07-13',
            summary: 'A good week.',
            feelings: 'Calm.',
            wentWell: '',
            improvement: '',
            nextIntention: 'Keep going.',
            mood: 4,
            progress: 4,
            updatedAt: '2026-07-19T00:00:00.000Z',
          },
        },
      }),
    )

    expect(backup.version).toBe(2)
    expect(backup.settings).not.toHaveProperty('targetAge')
    expect(backup.entries['2026-07-13']).toMatchObject({
      rating: 4,
      nextCommitment: 'Keep going.',
      reviewKind: 'retrospective',
    })
    expect(backup.entries['2026-07-13']?.whatHappened).toContain('Calm.')
  })

  it('rejects unsupported or malformed backups', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          version: 3,
          settings: {},
          entries: [],
        }),
      ),
    ).toThrow('not a valid Strongly Living Weekly backup')
  })

  it('preserves validated life chapters and milestones', () => {
    const backup = parseBackup(
      JSON.stringify({
        version: 2,
        exportedAt: '2026-08-15T00:00:00.000Z',
        settings: {
          ...settings,
          lifeChapters: [
            {
              id: 'school',
              title: 'School',
              startDate: '2022-08-08',
              endDate: '2026-05-22',
              color: '#789ABC',
              kind: 'chapter',
              confidence: 'approximate',
              note: 'Editable context.',
            },
          ],
        },
        entries: {},
        dailyNotes: {},
      }),
    )

    expect(backup.settings.lifeChapters[0]).toMatchObject({
      id: 'school',
      color: '#789abc',
    })
  })

  it('rejects entries whose key and week start do not match', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          version: 2,
          exportedAt: '2026-07-19T00:00:00.000Z',
          settings,
          entries: {
            '2026-07-13': {
              weekStart: '2026-07-14',
              whatHappened: 'Mismatch.',
              rating: 3,
              nextCommitment: '',
              reviewKind: 'retrospective',
              sealedAt: '2026-07-19T00:00:00.000Z',
              updatedAt: '2026-07-19T00:00:00.000Z',
            },
          },
          dailyNotes: {},
        }),
      ),
    ).toThrow('not a valid Strongly Living Weekly backup')
  })

  it('rejects an invalid calendar date in settings', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          version: 2,
          exportedAt: '2026-07-19T00:00:00.000Z',
          settings: { ...settings, birthDate: '2000-02-31' },
          entries: {},
          dailyNotes: {},
        }),
      ),
    ).toThrow('not a valid Strongly Living Weekly backup')
  })
})

describe('one-time timeline seeds', () => {
  it('validates a bounded list of life chapters', () => {
    const seed = parseTimelineSeed(
      JSON.stringify({
        seedId: 'initial-personal-timeline',
        chapters: [
          {
            id: 'graduation',
            title: 'Graduation',
            startDate: '2026-05-22',
            endDate: '2026-05-22',
            color: '#e3bd5f',
            kind: 'milestone',
            confidence: 'exact',
            note: '',
          },
        ],
      }),
    )

    expect(seed.seedId).toBe('initial-personal-timeline')
    expect(seed.chapters[0]?.kind).toBe('milestone')
  })

  it('rejects malformed seeds', () => {
    expect(() => parseTimelineSeed('{')).toThrow('not valid JSON')
    expect(() =>
      parseTimelineSeed(JSON.stringify({ seedId: '', chapters: [] })),
    ).toThrow('seed is invalid')
  })
})
