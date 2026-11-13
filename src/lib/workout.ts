import { hashSeed, mulberry32, type Rng } from './random.ts'
import type { Exercise, Library, MuscleGroup } from '../types/exercise.ts'

export const DURATION_OPTIONS = [20, 30, 45] as const
export type DurationMinutes = (typeof DURATION_OPTIONS)[number]

/** One repetition, counted with a controlled tempo. */
export const SECONDS_PER_REP = 4

/** Rest between sets. Harder exercises keep a longer rest. */
export const REST_SECONDS: Record<Exercise['intensity'], number> = {
  1: 45,
  2: 60,
  3: 75,
}

/** Move to the next station. Not counted after the last exercise. */
export const TRANSITION_SECONDS = 30

const MIN_SETS = 2
const MAX_SETS = 4
const START_SETS = 3
const SELECTION_ATTEMPTS = 32

export type WorkoutBlock = {
  exercise: Exercise
  sets: number
}

export type WorkoutWarning = 'no-libraries' | 'empty-pool' | 'shortened' | 'unsatisfiable'

export type Workout = {
  blocks: WorkoutBlock[]
  durationMinutes: DurationMinutes
  estimatedSeconds: number
  seed: string
  targetCount: number
  warnings: WorkoutWarning[]
}

export type GenerateWorkoutOptions = {
  libraries: readonly Library[]
  durationMinutes: DurationMinutes
  seed: string | number
}

/**
 * About one station per five or six minutes, which leaves room for 2–4 sets
 * inside the selected duration.
 */
export function targetExerciseCount(durationMinutes: DurationMinutes): number {
  switch (durationMinutes) {
    case 20:
      return 4
    case 30:
      return 6
    case 45:
      return 8
    default: {
      const unexpected: never = durationMinutes
      throw new Error(`Unsupported duration: ${String(unexpected)}`)
    }
  }
}

/** Local calendar day, `YYYY-MM-DD`. The page uses this as the daily seed. */
export function dailySeed(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function workSeconds(exercise: Exercise): number {
  return exercise.type === 'reps' ? exercise.defaultReps * SECONDS_PER_REP : exercise.defaultSeconds
}

export function estimateBlockSeconds(exercise: Exercise, sets: number): number {
  const work = workSeconds(exercise) * sets
  const rest = REST_SECONDS[exercise.intensity] * Math.max(0, sets - 1)
  return work + rest
}

export function estimateWorkoutSeconds(blocks: readonly WorkoutBlock[]): number {
  const stations = blocks.reduce(
    (total, block) => total + estimateBlockSeconds(block.exercise, block.sets),
    0,
  )
  const transitions = Math.max(0, blocks.length - 1) * TRANSITION_SECONDS
  return stations + transitions
}

export function generateWorkout(
  catalog: readonly Exercise[],
  options: GenerateWorkoutOptions,
): Workout {
  const durationMinutes = options.durationMinutes
  const seed = String(options.seed)
  const targetCount = targetExerciseCount(durationMinutes)
  const libraries = [...new Set(options.libraries)]

  if (libraries.length === 0) {
    return emptyWorkout(durationMinutes, seed, targetCount, ['no-libraries'])
  }

  const pool = catalog.filter((exercise) => libraries.includes(exercise.library))
  if (pool.length === 0) {
    return emptyWorkout(durationMinutes, seed, targetCount, ['empty-pool'])
  }

  const budget = durationMinutes * 60
  for (let length = Math.min(targetCount, pool.length); length >= 1; length -= 1) {
    const picked = selectExact(pool, length, seed)
    if (!picked) continue
    const blocks = fitBlocks(picked, budget)
    if (!blocks) continue
    const warnings: WorkoutWarning[] = blocks.length < targetCount ? ['shortened'] : []
    return {
      blocks,
      durationMinutes,
      estimatedSeconds: estimateWorkoutSeconds(blocks),
      seed,
      targetCount,
      warnings,
    }
  }

  return emptyWorkout(durationMinutes, seed, targetCount, ['unsatisfiable'])
}

function emptyWorkout(
  durationMinutes: DurationMinutes,
  seed: string,
  targetCount: number,
  warnings: WorkoutWarning[],
): Workout {
  return {
    blocks: [],
    durationMinutes,
    estimatedSeconds: 0,
    seed,
    targetCount,
    warnings,
  }
}

/**
 * Find a sequence of exactly `length` exercises.
 * Restarts are deterministic: the attempt number is part of the seed.
 * A miss steps the caller down to a shorter workout instead of breaking a rule.
 */
function selectExact(
  pool: readonly Exercise[],
  length: number,
  seed: string,
): Exercise[] | null {
  const ordered = [...pool].sort((left, right) => left.id.localeCompare(right.id))
  for (let attempt = 0; attempt < SELECTION_ATTEMPTS; attempt += 1) {
    const rng = mulberry32(hashSeed(`${seed}|${length}|${attempt}`))
    const picked = pickAlternating(ordered, length, rng)
    if (isValidSequence(picked, length)) return picked
  }
  return null
}

function pickAlternating(pool: readonly Exercise[], targetCount: number, rng: Rng): Exercise[] {
  const buckets = new Map<MuscleGroup, Exercise[]>()
  for (const exercise of shuffle(pool, rng)) {
    const list = buckets.get(exercise.muscleGroup)
    if (list) list.push(exercise)
    else buckets.set(exercise.muscleGroup, [exercise])
  }

  const selected: Exercise[] = []
  let lastGroup: MuscleGroup | null = null
  let highCount = 0
  const highLimit = Math.floor(targetCount / 2)

  while (selected.length < targetCount) {
    const options: { exercise: Exercise; group: MuscleGroup; remaining: number }[] = []
    for (const [group, list] of buckets) {
      if (list.length === 0 || group === lastGroup) continue
      const exercise = list.find(
        (candidate) => candidate.intensity < 3 || highCount + 1 <= highLimit,
      )
      if (!exercise) continue
      options.push({ exercise, group, remaining: list.length })
    }
    if (options.length === 0) break

    const fullest = Math.max(...options.map((option) => option.remaining))
    const tied = options.filter((option) => option.remaining === fullest)
    const choice = tied[Math.floor(rng() * tied.length)]
    if (!choice) break

    const list = buckets.get(choice.group)
    const index = list?.findIndex((exercise) => exercise.id === choice.exercise.id) ?? -1
    if (!list || index < 0) break
    list.splice(index, 1)

    selected.push(choice.exercise)
    lastGroup = choice.group
    if (choice.exercise.intensity === 3) highCount += 1
  }

  return selected
}

function isValidSequence(exercises: readonly Exercise[], length: number): boolean {
  if (exercises.length !== length) return false
  const seen = new Set<string>()
  let highCount = 0
  for (let index = 0; index < exercises.length; index += 1) {
    const exercise = exercises[index]
    if (!exercise || seen.has(exercise.id)) return false
    seen.add(exercise.id)
    const previous = exercises[index - 1]
    if (previous && previous.muscleGroup === exercise.muscleGroup) return false
    if (exercise.intensity === 3) highCount += 1
  }
  return highCount * 2 <= exercises.length
}

/** Sets start at 3, drop toward 2 when over budget, then rise toward 4 while time remains. */
function fitBlocks(exercises: readonly Exercise[], durationSeconds: number): WorkoutBlock[] | null {
  const sets = exercises.map(() => START_SETS)
  const total = () =>
    estimateWorkoutSeconds(exercises.map((exercise, index) => ({ exercise, sets: sets[index] ?? START_SETS })))

  while (total() > durationSeconds && sets.some((count) => count > MIN_SETS)) {
    let longestIndex = -1
    let longestSeconds = -1
    for (let index = 0; index < exercises.length; index += 1) {
      const count = sets[index] ?? START_SETS
      if (count <= MIN_SETS) continue
      const seconds = estimateBlockSeconds(exercises[index] as Exercise, count)
      if (seconds >= longestSeconds) {
        longestSeconds = seconds
        longestIndex = index
      }
    }
    if (longestIndex < 0) break
    sets[longestIndex] = (sets[longestIndex] ?? START_SETS) - 1
  }

  if (total() > durationSeconds) return null

  let progressed = true
  while (progressed) {
    progressed = false
    for (let index = 0; index < sets.length; index += 1) {
      const count = sets[index] ?? START_SETS
      if (count >= MAX_SETS) continue
      sets[index] = count + 1
      if (total() > durationSeconds) sets[index] = count
      else progressed = true
    }
  }

  return exercises.map((exercise, index) => ({
    exercise,
    sets: sets[index] ?? START_SETS,
  }))
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
