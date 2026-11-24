import { describe, expect, it } from 'vitest'
import {
  BMI_HIGH_THRESHOLD,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  PROFILE_STORAGE_KEY,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  bodyMassIndex,
  isHighBmi,
  loadProfile,
  parseHeightCm,
  parseProfile,
  parseWeightKg,
  saveProfile,
  validateDraft,
  type Profile,
} from './profile.ts'

const profile: Profile = {
  heightCm: 175,
  weightKg: 70.5,
  fitness: 'foundation',
  goal: 'fatLoss',
}

describe('profile', () => {
  it('computes BMI as kilograms over meters squared and treats 24 as 偏高', () => {
    expect(BMI_HIGH_THRESHOLD).toBe(24)
    expect(bodyMassIndex(200, 96)).toBe(24)
    expect(bodyMassIndex(200, 95)).toBe(23.75)
    expect(isHighBmi(BMI_HIGH_THRESHOLD)).toBe(true)
    expect(isHighBmi(BMI_HIGH_THRESHOLD - 0.001)).toBe(false)
    expect(isHighBmi(bodyMassIndex(170, 80))).toBe(true)
    expect(isHighBmi(bodyMassIndex(175, 70))).toBe(false)
  })

  it('accepts sane heights and weights and rejects the rest', () => {
    expect(parseHeightCm(String(HEIGHT_CM_MIN))).toBe(HEIGHT_CM_MIN)
    expect(parseHeightCm(String(HEIGHT_CM_MAX))).toBe(HEIGHT_CM_MAX)
    expect(parseHeightCm('175')).toBe(175)
    for (const text of ['', 'abc', '175.5', '119', '231', '0', '-5', '0175', '1e2']) {
      expect(parseHeightCm(text), text).toBeNull()
    }

    expect(parseWeightKg(String(WEIGHT_KG_MIN))).toBe(WEIGHT_KG_MIN)
    expect(parseWeightKg(String(WEIGHT_KG_MAX))).toBe(WEIGHT_KG_MAX)
    expect(parseWeightKg('70.5')).toBe(70.5)
    for (const text of ['', 'abc', '29', '251', '70.55', '70.', '.5', '-3', '007']) {
      expect(parseWeightKg(text), text).toBeNull()
    }
  })

  it('requires a fitness base and a goal before it builds a profile', () => {
    expect(
      validateDraft({ height: '175', weight: '70', fitness: 'beginner', goal: 'muscle' }).profile,
    ).toEqual({ heightCm: 175, weightKg: 70, fitness: 'beginner', goal: 'muscle' })

    const missing = validateDraft({ height: '90', weight: '', fitness: null, goal: null })
    expect(missing.profile).toBeNull()
    expect(missing.errors.height).toBeTruthy()
    expect(missing.errors.weight).toBeTruthy()
    expect(missing.errors.fitness).toBeTruthy()
    expect(missing.errors.goal).toBeTruthy()
  })

  it('reads a stored profile and drops corrupt values', () => {
    expect(parseProfile(profile)).toEqual(profile)
    expect(parseProfile({ ...profile, note: 'ignored' })).toEqual(profile)
    expect(parseProfile(null)).toBeNull()
    expect(parseProfile({ ...profile, heightCm: 90 })).toBeNull()
    expect(parseProfile({ ...profile, weightKg: 70.55 })).toBeNull()
    expect(parseProfile({ ...profile, fitness: 'pro' })).toBeNull()
    expect(parseProfile({ ...profile, goal: '增肌' })).toBeNull()

    const memory = new Map<string, string>()
    const store = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
    }
    expect(loadProfile(store)).toBeNull()
    saveProfile(profile, store)
    expect(memory.get(PROFILE_STORAGE_KEY)).toBe(JSON.stringify(profile))
    expect(loadProfile(store)).toEqual(profile)
    memory.set(PROFILE_STORAGE_KEY, '{')
    expect(loadProfile(store)).toBeNull()
  })
})
