export const LIBRARIES = ['strength', 'hyrox', 'hiit'] as const
export type Library = (typeof LIBRARIES)[number]

/** Primary pattern used to keep neighboring exercises from repeating the same emphasis. */
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'fullBody',
] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const EXERCISE_TYPES = ['reps', 'time'] as const
export type ExerciseType = (typeof EXERCISE_TYPES)[number]

export type Intensity = 1 | 2 | 3

type ExerciseBase = {
  id: string
  name: string
  library: Library
  muscleGroup: MuscleGroup
  intensity: Intensity
  equipment: string
}

export type RepsExercise = ExerciseBase & {
  type: 'reps'
  defaultReps: number
}

export type TimeExercise = ExerciseBase & {
  type: 'time'
  defaultSeconds: number
}

export type Exercise = RepsExercise | TimeExercise

const SHARED_KEYS = ['id', 'name', 'library', 'muscleGroup', 'type', 'intensity', 'equipment'] as const
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HAN_PATTERN = /\p{Script=Han}/u

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max
}

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
}

function allowedKeys(type: unknown): readonly string[] {
  if (type === 'reps') return [...SHARED_KEYS, 'defaultReps']
  if (type === 'time') return [...SHARED_KEYS, 'defaultSeconds']
  return SHARED_KEYS
}

export function validateCatalog(value: unknown): string[] {
  if (!Array.isArray(value)) return ['catalog must be an array']

  const errors: string[] = []
  const seenIds = new Set<string>()

  value.forEach((entry, index) => {
    const prefix = `exercises[${index}]`
    if (!isRecord(entry)) {
      errors.push(`${prefix} must be an object`)
      return
    }

    const keys = Object.keys(entry)
    const expected = allowedKeys(entry.type)
    for (const key of keys) {
      if (!expected.includes(key)) errors.push(`${prefix} has unexpected key "${key}"`)
    }
    for (const key of expected) {
      if (!(key in entry)) errors.push(`${prefix} is missing "${key}"`)
    }

    if (typeof entry.id !== 'string' || !ID_PATTERN.test(entry.id)) {
      errors.push(`${prefix}.id must be a kebab-case string`)
    } else if (seenIds.has(entry.id)) {
      errors.push(`${prefix}.id "${entry.id}" is duplicated`)
    } else {
      seenIds.add(entry.id)
    }

    if (typeof entry.name !== 'string' || entry.name.trim() === '' || !HAN_PATTERN.test(entry.name)) {
      errors.push(`${prefix}.name must be a non-empty Chinese name`)
    }

    if (!includes(LIBRARIES, entry.library)) {
      errors.push(`${prefix}.library must be one of ${LIBRARIES.join(', ')}`)
    }

    if (!includes(MUSCLE_GROUPS, entry.muscleGroup)) {
      errors.push(`${prefix}.muscleGroup must be one of ${MUSCLE_GROUPS.join(', ')}`)
    }

    if (!includes(EXERCISE_TYPES, entry.type)) {
      errors.push(`${prefix}.type must be "reps" or "time"`)
    } else if (entry.type === 'reps' && !isPositiveInteger(entry.defaultReps, 50)) {
      errors.push(`${prefix}.defaultReps must be an integer from 1 to 50`)
    } else if (entry.type === 'time' && !isPositiveInteger(entry.defaultSeconds, 180)) {
      errors.push(`${prefix}.defaultSeconds must be an integer from 1 to 180`)
    }

    if (entry.intensity !== 1 && entry.intensity !== 2 && entry.intensity !== 3) {
      errors.push(`${prefix}.intensity must be 1, 2, or 3`)
    }

    if (typeof entry.equipment !== 'string' || entry.equipment.trim() === '') {
      errors.push(`${prefix}.equipment must be a non-empty string`)
    }
  })

  return errors
}
