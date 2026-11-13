import { describe, expect, it } from 'vitest'
import data from './exercises.json'
import { LIBRARIES, validateCatalog } from '../types/exercise.ts'

describe('exercise catalog', () => {
  it('validates every entry against the schema', () => {
    expect(validateCatalog(data)).toEqual([])
  })

  it('seeds 10 exercises in each library, covering both prescriptions', () => {
    for (const library of LIBRARIES) {
      const entries = data.filter((exercise) => exercise.library === library)
      expect(entries, library).toHaveLength(10)
      expect(new Set(entries.map((exercise) => exercise.type))).toEqual(new Set(['reps', 'time']))
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

  it('keeps library values inside the fixed set', () => {
    const libraries = new Set(data.map((exercise) => exercise.library))
    expect([...libraries].sort()).toEqual([...LIBRARIES].sort())
  })
})
