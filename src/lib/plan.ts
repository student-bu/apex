import type { Exercise, MuscleGroup } from '../types/exercise.ts'
import { BMI_HIGH_THRESHOLD, GOAL_REPS, bodyMassIndex, type Profile } from './profile.ts'
import { hashSeed, mulberry32, type Rng } from './random.ts'

export const PLAN_ROLES = ['warmup', 'strength', 'bodyweight', 'stretch'] as const
export type PlanRole = (typeof PLAN_ROLES)[number]

export const PLAN_COUNTS: Record<PlanRole, number> = {
  warmup: 3,
  strength: 3,
  bodyweight: 2,
  stretch: 2,
}

export const STRENGTH_SETS = 3

export type PlanBlock = {
  exercise: Exercise
  role: PlanRole
  sets: number
  reps?: number
  seconds?: number
}

export type PlanWarning = 'incomplete'

export type Plan = {
  blocks: PlanBlock[]
  seed: string
  bmi: number
  highBmi: boolean
  warnings: PlanWarning[]
}

export type GeneratePlanOptions = {
  seed: string | number
  profile: Profile
}

/** Bodyweight equipment, including a 徒手 note such as 徒手（替代波比跳远）. */
export function isBodyweightEquipment(equipment: string): boolean {
  return (
    equipment === '徒手' ||
    equipment === '自重' ||
    equipment.startsWith('徒手（') ||
    equipment.startsWith('自重（')
  )
}

/** Local calendar day, `YYYY-MM-DD`. The page uses this as the daily seed. */
export function dailySeed(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Same date and profile always share a seed. 换一换 appends `#n`. */
export function planSeed(date: string, profile: Profile, nonce = 0): string {
  const body = [date, profile.heightCm, profile.weightKg, profile.fitness, profile.goal].join('|')
  return nonce > 0 ? `${body}#${nonce}` : body
}

export function generatePlan(catalog: readonly Exercise[], options: GeneratePlanOptions): Plan {
  const seed = String(options.seed)
  const profile = options.profile
  const bmi = bodyMassIndex(profile.heightCm, profile.weightKg)
  const highBmi = bmi >= BMI_HIGH_THRESHOLD

  const eligible = catalog.filter((exercise) => {
    if (profile.fitness === 'beginner' && exercise.intensity === 3) return false
    if (highBmi && exercise.jumping) return false
    return true
  })

  const used = new Set<string>()
  const picked = {
    warmup: pick(eligible, 'warmup', seed, used, false),
    strength: pick(eligible, 'strength', seed, used, true),
    bodyweight: pick(eligible, 'bodyweight', seed, used, false),
    stretch: pick(eligible, 'stretch', seed, used, false),
  }

  const blocks = PLAN_ROLES.flatMap((role) => picked[role].map((exercise) => toBlock(exercise, role, profile)))
  const incomplete = PLAN_ROLES.some((role) => picked[role].length < PLAN_COUNTS[role])

  return {
    blocks,
    seed,
    bmi,
    highBmi,
    warnings: incomplete ? ['incomplete'] : [],
  }
}

function poolFor(catalog: readonly Exercise[], role: PlanRole): Exercise[] {
  if (role === 'bodyweight') {
    return catalog.filter(
      (exercise) =>
        (exercise.library === 'hiit' || exercise.library === 'hyrox') &&
        isBodyweightEquipment(exercise.equipment),
    )
  }
  return catalog.filter((exercise) => exercise.library === role)
}

function pick(
  catalog: readonly Exercise[],
  role: PlanRole,
  seed: string,
  used: Set<string>,
  distinctMuscles: boolean,
): Exercise[] {
  const available = poolFor(catalog, role)
    .filter((exercise) => !used.has(exercise.id))
    .sort((left, right) => left.id.localeCompare(right.id))
  const shuffled = shuffle(available, mulberry32(hashSeed(`${seed}|${role}`)))
  const picked: Exercise[] = []
  const muscles = new Set<MuscleGroup>()
  for (const exercise of shuffled) {
    if (picked.length >= PLAN_COUNTS[role]) break
    if (distinctMuscles && muscles.has(exercise.muscleGroup)) continue
    picked.push(exercise)
    muscles.add(exercise.muscleGroup)
    used.add(exercise.id)
  }
  return picked
}

function toBlock(exercise: Exercise, role: PlanRole, profile: Profile): PlanBlock {
  if (role === 'strength') {
    if (exercise.type === 'time') {
      return { exercise, role, sets: STRENGTH_SETS, seconds: exercise.defaultSeconds }
    }
    return { exercise, role, sets: STRENGTH_SETS, reps: GOAL_REPS[profile.goal] }
  }
  if (exercise.type === 'time') return { exercise, role, sets: 1, seconds: exercise.defaultSeconds }
  return { exercise, role, sets: 1, reps: exercise.defaultReps }
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    const current = copy[index] as T
    copy[index] = copy[swapIndex] as T
    copy[swapIndex] = current
  }
  return copy
}
