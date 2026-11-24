import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import data from './exercises.json'
import { LIBRARIES, MUSCLE_GROUPS, validateCatalog } from '../types/exercise.ts'

describe('exercise catalog', () => {
  it('validates every entry against the schema', () => {
    expect(validateCatalog(data)).toEqual([])
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

  it('leaves hyrox and hiit at their original ten exercises, without photos', () => {
    for (const library of ['hyrox', 'hiit'] as const) {
      const entries = data.filter((exercise) => exercise.library === library)
      expect(entries, library).toHaveLength(10)
      expect(new Set(entries.map((exercise) => exercise.type))).toEqual(new Set(['reps', 'time']))
      for (const exercise of entries) {
        expect(exercise, exercise.id).not.toHaveProperty('image')
      }
    }
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
