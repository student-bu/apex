import { describe, expect, it } from 'vitest'
import { exercises } from '../data/catalog.ts'
import { LIBRARIES, type Exercise, type Library, type MuscleGroup } from '../types/exercise.ts'
import {
  DURATION_OPTIONS,
  dailySeed,
  estimateBlockSeconds,
  estimateWorkoutSeconds,
  generateWorkout,
  targetExerciseCount,
  type DurationMinutes,
  type Workout,
} from './workout.ts'

const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'fullBody',
]

function reps(partial: {
  id: string
  muscleGroup: MuscleGroup
  intensity?: 1 | 2 | 3
  defaultReps?: number
  library?: Library
}): Exercise {
  return {
    id: partial.id,
    name: partial.id,
    library: partial.library ?? 'strength',
    muscleGroup: partial.muscleGroup,
    type: 'reps',
    defaultReps: partial.defaultReps ?? 10,
    intensity: partial.intensity ?? 1,
    equipment: '徒手',
  }
}

function timed(partial: {
  id: string
  muscleGroup: MuscleGroup
  defaultSeconds: number
  intensity?: 1 | 2 | 3
}): Exercise {
  return {
    id: partial.id,
    name: partial.id,
    library: 'hiit',
    muscleGroup: partial.muscleGroup,
    type: 'time',
    defaultSeconds: partial.defaultSeconds,
    intensity: partial.intensity ?? 1,
    equipment: '徒手',
  }
}

function expectInvariants(workout: Workout, libraries: readonly Library[], duration: DurationMinutes) {
  const ids = workout.blocks.map((block) => block.exercise.id)
  expect(new Set(ids).size).toBe(ids.length)
  expect(workout.blocks.length).toBeLessThanOrEqual(workout.targetCount)
  expect(workout.targetCount).toBe(targetExerciseCount(duration))
  expect(workout.durationMinutes).toBe(duration)
  expect(workout.estimatedSeconds).toBe(estimateWorkoutSeconds(workout.blocks))
  expect(workout.estimatedSeconds).toBeLessThanOrEqual(duration * 60)

  let highCount = 0
  for (let index = 0; index < workout.blocks.length; index += 1) {
    const block = workout.blocks[index]
    expect(block).toBeDefined()
    if (!block) continue
    expect(block.sets).toBeGreaterThanOrEqual(2)
    expect(block.sets).toBeLessThanOrEqual(4)
    expect(libraries).toContain(block.exercise.library)
    const previous = workout.blocks[index - 1]
    if (previous) expect(block.exercise.muscleGroup).not.toBe(previous.exercise.muscleGroup)
    if (block.exercise.intensity === 3) highCount += 1
  }
  expect(highCount * 2).toBeLessThanOrEqual(workout.blocks.length)
}

describe('workout generator', () => {
  it('derives the exercise count from the duration', () => {
    expect(targetExerciseCount(20)).toBe(4)
    expect(targetExerciseCount(30)).toBe(6)
    expect(targetExerciseCount(45)).toBe(8)
  })

  it('estimates time from reps or seconds, rest, and transitions', () => {
    const exercise = reps({ id: 'tempo', muscleGroup: 'chest', intensity: 1, defaultReps: 10 })
    expect(estimateBlockSeconds(exercise, 3)).toBe(10 * 4 * 3 + 45 * 2)
    const stations = [
      { exercise, sets: 3 },
      { exercise: reps({ id: 'other', muscleGroup: 'back' }), sets: 2 },
    ]
    expect(estimateWorkoutSeconds(stations)).toBe(
      estimateBlockSeconds(stations[0].exercise, 3) + estimateBlockSeconds(stations[1].exercise, 2) + 30,
    )
  })

  it('formats the daily seed from the local calendar date', () => {
    expect(dailySeed(new Date(2026, 10, 13, 23, 45))).toBe('2026-11-13')
  })

  it('is deterministic for a seed and ignores library order', () => {
    const left = generateWorkout(exercises, {
      libraries: ['hiit', 'strength'],
      durationMinutes: 30,
      seed: '2026-11-13',
    })
    const right = generateWorkout(exercises, {
      libraries: ['strength', 'hiit', 'strength'],
      durationMinutes: 30,
      seed: '2026-11-13',
    })
    expect(left).toEqual(right)
    expect(generateWorkout(exercises, { libraries: ['strength'], durationMinutes: 30, seed: 7 })).toEqual(
      generateWorkout(exercises, { libraries: ['strength'], durationMinutes: 30, seed: 7 }),
    )
  })

  it('changes the workout when the seed changes', () => {
    const today = generateWorkout(exercises, {
      libraries: [...LIBRARIES],
      durationMinutes: 30,
      seed: '2026-11-13',
    })
    const shuffled = generateWorkout(exercises, {
      libraries: [...LIBRARIES],
      durationMinutes: 30,
      seed: '2026-11-13#1',
    })
    expect(today.blocks.map((block) => block.exercise.id)).not.toEqual(
      shuffled.blocks.map((block) => block.exercise.id),
    )
  })

  it('fills a valid target workout from the seeded libraries', () => {
    const seeds = ['2026-11-13', '2026-01-01', '2026-07-04', 'portfolio', 'shuffle-9']
    const selections: Library[][] = [['strength'], ['hyrox'], ['hiit'], ['strength', 'hyrox', 'hiit']]
    for (const libraries of selections) {
      for (const durationMinutes of DURATION_OPTIONS) {
        for (const seed of seeds) {
          const workout = generateWorkout(exercises, { libraries, durationMinutes, seed })
          expect(workout.blocks, `${libraries.join('+')} ${durationMinutes} ${seed}`).toHaveLength(
            targetExerciseCount(durationMinutes),
          )
          expect(workout.warnings, `${libraries.join('+')} ${durationMinutes} ${seed}`).toEqual([])
          expectInvariants(workout, libraries, durationMinutes)
        }
      }
    }
  })

  it('does not repeat an exercise or a neighboring muscle group', () => {
    const catalog = ['chest', 'chest', 'chest', 'back', 'back', 'back'].map((group, index) =>
      reps({ id: `move-${index}`, muscleGroup: group as MuscleGroup }),
    )
    const workout = generateWorkout(catalog, {
      libraries: ['strength'],
      durationMinutes: 20,
      seed: 'alternate',
    })
    expect(workout.blocks).toHaveLength(4)
    expectInvariants(workout, ['strength'], 20)
  })

  it('keeps high-intensity work to at most half the workout', () => {
    const catalog = MUSCLE_GROUPS.slice(0, 8).map((muscleGroup, index) =>
      reps({
        id: `slot-${index}`,
        muscleGroup,
        intensity: index < 6 ? 3 : 1,
      }),
    )
    const workout = generateWorkout(catalog, {
      libraries: ['strength'],
      durationMinutes: 20,
      seed: 'intensity-cap',
    })
    const highCount = workout.blocks.filter((block) => block.exercise.intensity === 3).length
    expect(workout.blocks).toHaveLength(4)
    expect(highCount).toBe(2)
    expectInvariants(workout, ['strength'], 20)
  })

  it('uses 2–4 sets and stays inside a tight duration', () => {
    const catalog = ['chest', 'back', 'shoulders', 'arms'].map((muscleGroup, index) =>
      timed({ id: `long-${index}`, muscleGroup: muscleGroup as MuscleGroup, defaultSeconds: 200 }),
    )
    const workout = generateWorkout(catalog, {
      libraries: ['hiit'],
      durationMinutes: 20,
      seed: 'budget',
    })
    expect(workout.blocks.length).toBeGreaterThan(0)
    expect(workout.blocks.length).toBeLessThan(4)
    expect(workout.warnings).toContain('shortened')
    expect(workout.blocks.some((block) => block.sets === 2)).toBe(true)
    expectInvariants(workout, ['hiit'], 20)
  })

  it('returns no workout when every exercise is too long for the duration', () => {
    const catalog = [
      timed({ id: 'too-long-a', muscleGroup: 'chest', defaultSeconds: 2000 }),
      timed({ id: 'too-long-b', muscleGroup: 'back', defaultSeconds: 2000 }),
    ]
    const workout = generateWorkout(catalog, {
      libraries: ['hiit'],
      durationMinutes: 20,
      seed: 'too-long',
    })
    expect(workout.blocks).toEqual([])
    expect(workout.warnings).toEqual(['unsatisfiable'])
  })

  it('keeps a single shared muscle group to one exercise', () => {
    const catalog = Array.from({ length: 6 }, (_, index) =>
      reps({ id: `chest-${index}`, muscleGroup: 'chest' }),
    )
    const workout = generateWorkout(catalog, {
      libraries: ['strength'],
      durationMinutes: 45,
      seed: 'one-group',
    })
    expect(workout.blocks).toHaveLength(1)
    expect(workout.warnings).toEqual(['shortened'])
    expectInvariants(workout, ['strength'], 45)
  })

  it('returns an empty workout when every option is high intensity', () => {
    const catalog = MUSCLE_GROUPS.map((muscleGroup) =>
      reps({ id: muscleGroup, muscleGroup, intensity: 3 }),
    )
    const workout = generateWorkout(catalog, {
      libraries: ['strength'],
      durationMinutes: 30,
      seed: 'all-hard',
    })
    expect(workout.blocks).toEqual([])
    expect(workout.warnings).toEqual(['unsatisfiable'])
  })

  it('handles an empty library selection and an empty pool without throwing', () => {
    expect(
      generateWorkout(exercises, { libraries: [], durationMinutes: 20, seed: 'none' }).warnings,
    ).toEqual(['no-libraries'])
    expect(
      generateWorkout([], { libraries: ['hyrox'], durationMinutes: 45, seed: 'missing' }).warnings,
    ).toEqual(['empty-pool'])
  })

  it('does not mutate the catalog', () => {
    const snapshot = JSON.stringify(exercises)
    generateWorkout(exercises, {
      libraries: ['strength', 'hyrox', 'hiit'],
      durationMinutes: 45,
      seed: '2026-11-13',
    })
    expect(JSON.stringify(exercises)).toBe(snapshot)
  })
})
