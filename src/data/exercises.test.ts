import { describe, expect, it } from 'vitest'
import data from './exercises.json'
import { EXERCISE_TYPES, LIBRARIES, MUSCLE_GROUPS, validateCatalog } from '../types/exercise.ts'

const HAN_PATTERN = /\p{Script=Han}/u
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const STRENGTH_IDS = [
  'strength-bench-press',
  'strength-dumbbell-fly',
  'strength-pull-up',
  'strength-barbell-row',
  'strength-shoulder-press',
  'strength-back-squat',
  'strength-romanian-deadlift',
  'strength-hip-thrust',
  'strength-plank',
  'strength-dumbbell-curl',
]

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

  it('keeps the strength library and sizes HIIT and HYROX for interval and race-station training', () => {
    const byLibrary = Object.fromEntries(
      LIBRARIES.map((library) => [library, data.filter((exercise) => exercise.library === library)]),
    )
    expect(byLibrary.strength?.map((exercise) => exercise.id)).toEqual(STRENGTH_IDS)
    expect(byLibrary.hyrox?.length).toBeGreaterThanOrEqual(15)
    expect(byLibrary.hyrox?.length).toBeLessThanOrEqual(20)
    expect(byLibrary.hiit?.length).toBeGreaterThanOrEqual(25)
    expect(byLibrary.hiit?.length).toBeLessThanOrEqual(30)
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

  it('keeps library values inside the fixed set', () => {
    const libraries = new Set(data.map((exercise) => exercise.library))
    expect([...libraries].sort()).toEqual([...LIBRARIES].sort())
  })
})
