export const FITNESS_LEVELS = ['beginner', 'foundation', 'advanced'] as const
export type FitnessLevel = (typeof FITNESS_LEVELS)[number]

export const GOALS = ['muscle', 'fatLoss', 'strength'] as const
export type Goal = (typeof GOALS)[number]

/** Reps for a strength movement. Timed strength movements keep their own seconds. */
export const GOAL_REPS: Record<Goal, number> = {
  muscle: 10,
  fatLoss: 12,
  strength: 8,
}

/**
 * Chinese adult BMI cutoff. 24 and above is 偏高.
 * BMI is kilograms divided by meters squared.
 */
export const BMI_HIGH_THRESHOLD = 24

export const HEIGHT_CM_MIN = 120
export const HEIGHT_CM_MAX = 230
export const WEIGHT_KG_MIN = 30
export const WEIGHT_KG_MAX = 250

export const PROFILE_STORAGE_KEY = 'apex-profile'

export type Profile = {
  heightCm: number
  weightKg: number
  fitness: FitnessLevel
  goal: Goal
}

export type ProfileDraft = {
  height: string
  weight: string
  fitness: FitnessLevel | null
  goal: Goal | null
}

export type ProfileErrors = {
  height?: string
  weight?: string
  fitness?: string
  goal?: string
}

export function bodyMassIndex(heightCm: number, weightKg: number): number {
  const meters = heightCm / 100
  return weightKg / (meters * meters)
}

export function isHighBmi(bmi: number): boolean {
  return bmi >= BMI_HIGH_THRESHOLD
}

function isFitness(value: unknown): value is FitnessLevel {
  return typeof value === 'string' && (FITNESS_LEVELS as readonly string[]).includes(value)
}

function isGoal(value: unknown): value is Goal {
  return typeof value === 'string' && (GOALS as readonly string[]).includes(value)
}

function atMostOneDecimal(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value * 10 - Math.round(value * 10)) < 1e-6
}

export function parseHeightCm(text: string): number | null {
  const trimmed = text.trim()
  if (!/^[1-9]\d*$/.test(trimmed)) return null
  const value = Number(trimmed)
  if (!Number.isInteger(value) || value < HEIGHT_CM_MIN || value > HEIGHT_CM_MAX) return null
  return value
}

export function parseWeightKg(text: string): number | null {
  const trimmed = text.trim()
  if (!/^(?:[1-9]\d*|0)(?:\.\d)?$/.test(trimmed)) return null
  const value = Number(trimmed)
  if (!atMostOneDecimal(value) || value < WEIGHT_KG_MIN || value > WEIGHT_KG_MAX) return null
  return value
}

export function validateDraft(draft: ProfileDraft): { profile: Profile | null; errors: ProfileErrors } {
  const errors: ProfileErrors = {}
  const heightCm = parseHeightCm(draft.height)
  const weightKg = parseWeightKg(draft.weight)
  if (heightCm === null) {
    errors.height = `请填写 ${HEIGHT_CM_MIN}–${HEIGHT_CM_MAX} 之间的整数身高（厘米）`
  }
  if (weightKg === null) {
    errors.weight = `请填写 ${WEIGHT_KG_MIN}–${WEIGHT_KG_MAX} 之间的体重（公斤），最多一位小数`
  }
  if (!draft.fitness) errors.fitness = '请选择训练基础'
  if (!draft.goal) errors.goal = '请选择目标'
  if (heightCm === null || weightKg === null || !draft.fitness || !draft.goal) {
    return { profile: null, errors }
  }
  return {
    profile: { heightCm, weightKg, fitness: draft.fitness, goal: draft.goal },
    errors,
  }
}

export function parseProfile(value: unknown): Profile | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const { heightCm, weightKg, fitness, goal } = record
  if (typeof heightCm !== 'number' || !Number.isInteger(heightCm)) return null
  if (heightCm < HEIGHT_CM_MIN || heightCm > HEIGHT_CM_MAX) return null
  if (typeof weightKg !== 'number' || !atMostOneDecimal(weightKg)) return null
  if (weightKg < WEIGHT_KG_MIN || weightKg > WEIGHT_KG_MAX) return null
  if (!isFitness(fitness) || !isGoal(goal)) return null
  return { heightCm, weightKg, fitness, goal }
}

function browserStore(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

export function loadProfile(store: Pick<Storage, 'getItem'> | null = browserStore()): Profile | null {
  if (!store) return null
  const raw = store.getItem(PROFILE_STORAGE_KEY)
  if (!raw) return null
  try {
    return parseProfile(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveProfile(profile: Profile, store: Pick<Storage, 'setItem'> | null = browserStore()): void {
  if (!store) return
  store.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
}
