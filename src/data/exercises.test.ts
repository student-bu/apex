import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import data from './exercises.json'
import { EXERCISE_TYPES, LIBRARIES, MUSCLE_GROUPS, validateCatalog } from '../types/exercise.ts'

const HAN_PATTERN = /\p{Script=Han}/u
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Stations in race order, plus the 1 km run that separates them. */
const HYROX_STATION_IDS = [
  'hyrox-run',
  'hyrox-ski-erg',
  'hyrox-sled-push',
  'hyrox-sled-pull',
  'hyrox-burpee-broad-jump',
  'hyrox-row',
  'hyrox-farmers-carry',
  'hyrox-sandbag-lunge',
  'hyrox-wall-ball',
]

/** Open WOD movements merged into HIIT. Ones already in the library stay as the original ids. */
const HIIT_MERGED_IDS = [
  'hiit-burpee',
  'hiit-box-jump',
  'hiit-kettlebell-swing',
  'hiit-thruster',
  'hiit-double-under',
  'hiit-wall-ball',
  'hiit-air-squat',
  'hiit-push-up',
  'hiit-sit-up',
  'hiit-mountain-climber',
  'hiit-hand-release-push-up',
  'hiit-ball-slam',
  'hiit-toes-to-bar',
  'hiit-v-up',
  'hiit-push-press',
  'hiit-sumo-deadlift-high-pull',
  'hiit-goblet-squat',
  'hiit-jumping-lunge',
  'hiit-box-step-up',
  'hiit-bear-crawl',
]

describe('exercise catalog', () => {
  it('validates every entry against the schema', () => {
    expect(validateCatalog(data)).toEqual([])
  })

  it('gives every exercise a unique id, a Chinese name, and a legal enum', () => {
    const ids = data.map((exercise) => exercise.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const exercise of data) {
      expect(exercise.id, exercise.id).toMatch(ID_PATTERN)
      expect(exercise.name.trim(), exercise.id).not.toBe('')
      expect(exercise.name, exercise.id).toMatch(HAN_PATTERN)
      expect(LIBRARIES, exercise.id).toContain(exercise.library)
      expect(MUSCLE_GROUPS, exercise.id).toContain(exercise.muscleGroup)
      expect(EXERCISE_TYPES, exercise.id).toContain(exercise.type)
      expect([1, 2, 3], exercise.id).toContain(exercise.intensity)
      expect(exercise.equipment.trim(), exercise.id).not.toBe('')
      if (exercise.type === 'reps') {
        expect(exercise.defaultReps, exercise.id).toBeGreaterThanOrEqual(1)
        expect(exercise.defaultReps, exercise.id).toBeLessThanOrEqual(50)
      } else {
        expect(exercise.defaultSeconds, exercise.id).toBeGreaterThanOrEqual(1)
        expect(exercise.defaultSeconds, exercise.id).toBeLessThanOrEqual(180)
      }
    }
  })

  it('gives every exercise a Chinese name, a legal enum, and an in-range default', () => {
    for (const exercise of data) {
      expect(exercise.name, exercise.id).toMatch(/\p{Script=Han}/u)
      expect(MUSCLE_GROUPS, exercise.id).toContain(exercise.muscleGroup)
      expect(LIBRARIES, exercise.id).toContain(exercise.library)
      expect([1, 2, 3], exercise.id).toContain(exercise.intensity)
      if (exercise.type === 'reps') {
        expect(exercise.defaultReps, exercise.id).toBeGreaterThanOrEqual(1)
        expect(exercise.defaultReps, exercise.id).toBeLessThanOrEqual(50)
      } else {
        expect(exercise.defaultSeconds, exercise.id).toBeGreaterThanOrEqual(1)
        expect(exercise.defaultSeconds, exercise.id).toBeLessThanOrEqual(180)
      }
    }
  })

  it('stores a real photo for every strength exercise', () => {
    const strength = data.filter((exercise) => exercise.library === 'strength')
    expect(strength).toHaveLength(42)
    expect(new Set(strength.map((exercise) => exercise.muscleGroup))).toEqual(new Set(MUSCLE_GROUPS))
    for (const equipment of ['自重', '哑铃', '杠铃', '壶铃']) {
      expect(strength.some((exercise) => exercise.equipment === equipment), equipment).toBe(true)
    }
    expect(new Set(strength.map((exercise) => exercise.type))).toEqual(new Set(['reps', 'time']))

    const images = new Set<string>()
    for (const exercise of strength) {
      const image = 'image' in exercise ? exercise.image : undefined
      if (typeof image !== 'string') throw new Error(`${exercise.id} is missing image`)
      expect(image, exercise.id).toMatch(/^exercises\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/)
      expect(images.has(image), image).toBe(false)
      images.add(image)
      const file = resolve('public', image)
      expect(existsSync(file), file).toBe(true)
      expect(statSync(file).size, file).toBeGreaterThan(1000)
    }
  })

  it('leaves hyrox and hiit without photos', () => {
    const expected = { hyrox: 17, hiit: 27 } as const
    for (const library of ['hyrox', 'hiit'] as const) {
      const entries = data.filter((exercise) => exercise.library === library)
      expect(entries, library).toHaveLength(expected[library])
      expect(new Set(entries.map((exercise) => exercise.type))).toEqual(new Set(['reps', 'time']))
      for (const exercise of entries) {
        expect(exercise, exercise.id).not.toHaveProperty('image')
      }
    }
  })

  it('keeps library sizes at 42 strength, 17 HYROX, and 27 HIIT exercises', () => {
    const byLibrary = Object.fromEntries(
      LIBRARIES.map((library) => [library, data.filter((exercise) => exercise.library === library)]),
    )
    expect(byLibrary.strength).toHaveLength(42)
    expect(byLibrary.hyrox).toHaveLength(17)
    expect(byLibrary.hiit).toHaveLength(27)
    for (const library of LIBRARIES) {
      expect(new Set(byLibrary[library]?.map((exercise) => exercise.type)), library).toEqual(
        new Set(['reps', 'time']),
      )
    }
  })

  it('lists the HYROX run and eight stations, with substitutes marked on the equipment', () => {
    const hyrox = data.filter((exercise) => exercise.library === 'hyrox')
    const ids = new Set(hyrox.map((exercise) => exercise.id))
    for (const id of HYROX_STATION_IDS) expect(ids, id).toContain(id)

    const substitutes = hyrox.filter((exercise) => exercise.equipment.includes('替代'))
    expect(substitutes.map((exercise) => exercise.id)).toEqual([
      'hyrox-band-pulldown',
      'hyrox-band-lean-walk',
      'hyrox-band-row',
      'hyrox-broad-jump',
      'hyrox-bike-interval',
      'hyrox-dumbbell-carry',
      'hyrox-dumbbell-lunge',
      'hyrox-dumbbell-thruster',
    ])
    for (const exercise of substitutes) {
      expect(exercise.equipment, exercise.id).toMatch(/（替代.+）$/)
    }

    for (const exercise of hyrox) {
      if (exercise.type === 'reps') expect(exercise.defaultReps, exercise.id).toBeLessThanOrEqual(20)
      else expect(exercise.defaultSeconds, exercise.id).toBeLessThanOrEqual(90)
    }
  })

  it('merges the selected interval movements into HIIT without duplicating the originals', () => {
    const ids = new Set(data.filter((exercise) => exercise.library === 'hiit').map((exercise) => exercise.id))
    expect(HIIT_MERGED_IDS).toHaveLength(20)
    for (const id of HIIT_MERGED_IDS) expect(ids, id).toContain(id)
    expect(data.filter((exercise) => exercise.id === 'hiit-burpee')).toHaveLength(1)
    expect(data.filter((exercise) => exercise.id === 'hiit-push-up')).toHaveLength(1)
    expect(data.filter((exercise) => exercise.id === 'hiit-mountain-climber')).toHaveLength(1)
  })

  it('rejects a broken entry instead of treating the schema as optional', () => {
    const [first] = data
    const broken = { ...first, name: 'Bench press', intensity: 5, extra: true }
    const errors = validateCatalog([broken])
    expect(errors.some((error) => error.includes('name'))).toBe(true)
    expect(errors.some((error) => error.includes('intensity'))).toBe(true)
    expect(errors.some((error) => error.includes('extra'))).toBe(true)
  })

  it('allows a missing image and rejects a bad image path', () => {
    const [first] = data
    if (!first || !('image' in first) || typeof first.image !== 'string') {
      throw new Error('expected the first exercise to carry an image')
    }
    const { image, ...withoutImage } = first
    expect(image).toMatch(/^exercises\//)
    expect(validateCatalog([withoutImage])).toEqual([])
    const errors = validateCatalog([{ ...first, image: '../secret.jpg' }])
    expect(errors.some((error) => error.includes('image'))).toBe(true)
  })

  it('keeps library values inside the fixed set', () => {
    const libraries = new Set(data.map((exercise) => exercise.library))
    expect([...libraries].sort()).toEqual([...LIBRARIES].sort())
  })
})
