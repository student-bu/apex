import { describe, expect, it } from 'vitest'
import { exercises } from '../data/catalog.ts'
import type { Exercise, Intensity, Library, MuscleGroup } from '../types/exercise.ts'
import {
  PLAN_COUNTS,
  PLAN_ROLES,
  STRENGTH_SETS,
  dailySeed,
  generatePlan,
  isBodyweightEquipment,
  planSeed,
  type Plan,
} from './plan.ts'
import { FITNESS_LEVELS, GOAL_REPS, GOALS, isHighBmi, type FitnessLevel, type Goal, type Profile } from './profile.ts'

const DATES = [
  '2026-01-01',
  '2026-02-17',
  '2026-03-08',
  '2026-04-15',
  '2026-05-20',
  '2026-06-01',
  '2026-07-04',
  '2026-08-18',
  '2026-09-30',
  '2026-10-10',
  '2026-11-13',
  '2026-11-24',
  '2026-12-31',
  'portfolio',
  'shuffle-9',
]

const BODIES = [
  { heightCm: 175, weightKg: 70 },
  { heightCm: 160, weightKg: 75 },
]

function reps(partial: {
  id: string
  muscleGroup: MuscleGroup
  library?: Library
  intensity?: Intensity
  defaultReps?: number
  equipment?: string
  jumping?: boolean
}): Exercise {
  return {
    id: partial.id,
    name: partial.id,
    library: partial.library ?? 'strength',
    muscleGroup: partial.muscleGroup,
    type: 'reps',
    defaultReps: partial.defaultReps ?? 8,
    intensity: partial.intensity ?? 1,
    equipment: partial.equipment ?? '杠铃',
    jumping: partial.jumping ?? false,
  }
}

function timed(partial: {
  id: string
  muscleGroup: MuscleGroup
  library?: Library
  defaultSeconds: number
  intensity?: Intensity
  equipment?: string
  jumping?: boolean
}): Exercise {
  return {
    id: partial.id,
    name: partial.id,
    library: partial.library ?? 'strength',
    muscleGroup: partial.muscleGroup,
    type: 'time',
    defaultSeconds: partial.defaultSeconds,
    intensity: partial.intensity ?? 1,
    equipment: partial.equipment ?? '徒手',
    jumping: partial.jumping ?? false,
  }
}

function profile(partial: Partial<Profile> = {}): Profile {
  return {
    heightCm: 175,
    weightKg: 70,
    fitness: 'foundation',
    goal: 'muscle',
    ...partial,
  }
}

function ids(plan: Plan): string[] {
  return plan.blocks.map((block) => block.exercise.id)
}

function fullCatalog(): Exercise[] {
  const warmups = ['shoulders', 'hamstrings', 'glutes', 'core'].map((muscleGroup, index) =>
    reps({ id: `w-${index}`, library: 'warmup', muscleGroup: muscleGroup as MuscleGroup, equipment: '徒手' }),
  )
  const strength = ['chest', 'back', 'quads', 'core'].map((muscleGroup, index) =>
    reps({ id: `s-${index}`, muscleGroup: muscleGroup as MuscleGroup }),
  )
  const bodyweight = ['fullBody', 'quads'].map((muscleGroup, index) =>
    reps({ id: `b-${index}`, library: 'hiit', muscleGroup: muscleGroup as MuscleGroup, equipment: '徒手' }),
  )
  const stretches = ['hamstrings', 'chest'].map((muscleGroup, index) =>
    timed({
      id: `t-${index}`,
      library: 'stretch',
      muscleGroup: muscleGroup as MuscleGroup,
      defaultSeconds: 30,
    }),
  )
  return [...warmups, ...strength, ...bodyweight, ...stretches]
}

function expectRules(plan: Plan, person: Profile) {
  const seen = new Set<string>()
  let cursor = 0
  for (const role of PLAN_ROLES) {
    const section = plan.blocks.slice(cursor).filter((block) => block.role === role)
    const taken = plan.blocks.filter((block) => block.role === role)
    expect(plan.blocks.slice(cursor, cursor + taken.length).every((block) => block.role === role)).toBe(true)
    cursor += taken.length
    expect(section).toEqual(taken)

    if (role === 'strength') {
      const muscles = taken.map((block) => block.exercise.muscleGroup)
      expect(new Set(muscles).size).toBe(muscles.length)
      for (let index = 1; index < taken.length; index += 1) {
        expect(taken[index]?.exercise.muscleGroup).not.toBe(taken[index - 1]?.exercise.muscleGroup)
      }
    }

    for (const block of taken) {
      expect(seen.has(block.exercise.id), block.exercise.id).toBe(false)
      seen.add(block.exercise.id)
      if (person.fitness === 'beginner') expect(block.exercise.intensity).not.toBe(3)
      if (plan.highBmi) expect(block.exercise.jumping).toBe(false)
      if (role === 'strength') {
        expect(block.sets).toBe(STRENGTH_SETS)
        if (block.exercise.type === 'time') {
          expect(block.seconds).toBe(block.exercise.defaultSeconds)
          expect(block.reps).toBeUndefined()
        } else {
          expect(block.reps).toBe(GOAL_REPS[person.goal])
          expect(block.seconds).toBeUndefined()
        }
      } else if (block.exercise.type === 'time') {
        expect(block.sets).toBe(1)
        expect(block.seconds).toBe(block.exercise.defaultSeconds)
      } else {
        expect(block.sets).toBe(1)
        expect(block.reps).toBe(block.exercise.defaultReps)
      }
      if (role === 'bodyweight') {
        expect(['hiit', 'hyrox']).toContain(block.exercise.library)
        expect(isBodyweightEquipment(block.exercise.equipment)).toBe(true)
      } else {
        expect(block.exercise.library).toBe(role)
      }
    }
  }
  expect(cursor).toBe(plan.blocks.length)
  expect(plan.highBmi).toBe(isHighBmi(plan.bmi))
}

describe('daily plan', () => {
  it('formats the daily seed and folds the profile into it', () => {
    expect(dailySeed(new Date(2026, 10, 13, 23, 45))).toBe('2026-11-13')
    const person = profile()
    expect(planSeed('2026-11-24', person)).toBe('2026-11-24|175|70|foundation|muscle')
    expect(planSeed('2026-11-24', person, 2)).toBe('2026-11-24|175|70|foundation|muscle#2')
    expect(planSeed('2026-11-24', profile({ goal: 'fatLoss' }))).not.toBe(planSeed('2026-11-24', person))
    expect(planSeed('2026-11-24', profile({ fitness: 'beginner' }))).not.toBe(planSeed('2026-11-24', person))
    expect(planSeed('2026-11-24', profile({ weightKg: 80 }))).not.toBe(planSeed('2026-11-24', person))
  })

  it('treats 徒手 and 自重 as bodyweight, including a 徒手 substitute note', () => {
    expect(isBodyweightEquipment('徒手')).toBe(true)
    expect(isBodyweightEquipment('自重')).toBe(true)
    expect(isBodyweightEquipment('徒手（替代波比跳远）')).toBe(true)
    expect(isBodyweightEquipment('雪橇')).toBe(false)
    expect(isBodyweightEquipment('划船机')).toBe(false)
    expect(isBodyweightEquipment('哑铃（替代农夫行走）')).toBe(false)
    expect(isBodyweightEquipment('跳绳')).toBe(false)
    expect(isBodyweightEquipment('跳箱')).toBe(false)
  })

  it('builds 3 warm-ups, 3 strength, 2 bodyweight, and 2 stretches for every profile and seed', () => {
    let sawIntensity3 = false
    let sawJump = false
    let sawHighBmiIntensity3 = false
    for (const date of DATES) {
      for (const fitness of FITNESS_LEVELS) {
        for (const goal of GOALS) {
          for (const body of BODIES) {
            const person = profile({ ...body, fitness, goal })
            const seed = planSeed(date, person)
            const plan = generatePlan(exercises, { seed, profile: person })
            const label = `${date} ${fitness} ${goal} ${body.heightCm}`
            expect(plan.warnings, label).toEqual([])
            expect(plan.blocks, label).toHaveLength(10)
            for (const role of PLAN_ROLES) {
              expect(plan.blocks.filter((block) => block.role === role), `${label} ${role}`).toHaveLength(
                PLAN_COUNTS[role],
              )
            }
            expect(plan.blocks.map((block) => block.role), label).toEqual([
              'warmup',
              'warmup',
              'warmup',
              'strength',
              'strength',
              'strength',
              'bodyweight',
              'bodyweight',
              'stretch',
              'stretch',
            ])
            expectRules(plan, person)
            if (plan.blocks.some((block) => block.exercise.intensity === 3)) {
              sawIntensity3 = true
              if (plan.highBmi) sawHighBmiIntensity3 = true
            }
            if (plan.blocks.some((block) => block.exercise.jumping)) sawJump = true
          }
        }
      }
    }
    expect(sawIntensity3).toBe(true)
    expect(sawJump).toBe(true)
    expect(sawHighBmiIntensity3).toBe(true)
  })

  it('is deterministic for a date seed and profile, and a new seed reshuffles', () => {
    const person = profile({ fitness: 'advanced', goal: 'strength' })
    const seed = planSeed('2026-11-24', person)
    expect(generatePlan(exercises, { seed, profile: person })).toEqual(
      generatePlan(exercises, { seed, profile: person }),
    )
    const reshuffled = generatePlan(exercises, { seed: planSeed('2026-11-24', person, 1), profile: person })
    expect(ids(reshuffled)).not.toEqual(ids(generatePlan(exercises, { seed, profile: person })))
  })

  it('keeps the same movements when only the goal changes, and swaps the strength reps', () => {
    const seed = 'goal-only'
    const muscle = generatePlan(exercises, { seed, profile: profile({ goal: 'muscle' }) })
    const fatLoss = generatePlan(exercises, { seed, profile: profile({ goal: 'fatLoss' }) })
    const strength = generatePlan(exercises, { seed, profile: profile({ goal: 'strength' }) })
    expect(ids(fatLoss)).toEqual(ids(muscle))
    expect(ids(strength)).toEqual(ids(muscle))
    for (const block of muscle.blocks) {
      if (block.role !== 'strength' || block.exercise.type !== 'reps') continue
      const match = (goal: Goal) =>
        (goal === 'muscle' ? muscle : goal === 'fatLoss' ? fatLoss : strength).blocks.find(
          (candidate) => candidate.exercise.id === block.exercise.id,
        )
      expect(match('muscle')?.reps).toBe(10)
      expect(match('fatLoss')?.reps).toBe(12)
      expect(match('strength')?.reps).toBe(8)
    }
    expect(muscle.blocks.some((block) => block.role === 'strength' && block.reps === 10)).toBe(true)
  })

  it('keeps seconds on timed strength work such as a plank', () => {
    const catalog = [
      ...fullCatalog().filter((exercise) => exercise.library !== 'strength'),
      timed({ id: 'plank', muscleGroup: 'core', defaultSeconds: 40 }),
      reps({ id: 'press', muscleGroup: 'chest', defaultReps: 5 }),
      reps({ id: 'row', muscleGroup: 'back', defaultReps: 5 }),
    ]
    for (const goal of GOALS) {
      const plan = generatePlan(catalog, { seed: 'plank', profile: profile({ goal }) })
      const strength = plan.blocks.filter((block) => block.role === 'strength')
      expect(strength.map((block) => block.exercise.id).sort()).toEqual(['plank', 'press', 'row'])
      const plank = strength.find((block) => block.exercise.id === 'plank')
      expect(plank).toMatchObject({ sets: 3, seconds: 40 })
      expect(plank?.reps).toBeUndefined()
      const press = strength.find((block) => block.exercise.id === 'press')
      expect(press?.reps).toBe(GOAL_REPS[goal])
    }
  })

  it('does not repeat an exercise, and strength covers different muscle groups', () => {
    const catalog = [
      ...fullCatalog().filter((exercise) => exercise.library !== 'strength'),
      reps({ id: 'chest-a', muscleGroup: 'chest' }),
      reps({ id: 'chest-b', muscleGroup: 'chest' }),
      reps({ id: 'chest-c', muscleGroup: 'chest' }),
      reps({ id: 'back-a', muscleGroup: 'back' }),
      reps({ id: 'same', muscleGroup: 'shoulders' }),
      reps({ id: 'same', muscleGroup: 'shoulders' }),
    ]
    const plan = generatePlan(catalog, { seed: 'muscles', profile: profile() })
    const strength = plan.blocks.filter((block) => block.role === 'strength')
    expect(strength).toHaveLength(3)
    expect(new Set(strength.map((block) => block.exercise.muscleGroup)).size).toBe(3)
    expect(new Set(ids(plan)).size).toBe(ids(plan).length)
    expect(plan.warnings).toEqual([])
  })

  it('never gives a beginner an intensity-3 movement', () => {
    const catalog = [
      ...[0, 1, 2].map((index) =>
        reps({
          id: `hard-warm-${index}`,
          library: 'warmup',
          muscleGroup: 'fullBody',
          intensity: 3,
          equipment: '徒手',
        }),
      ),
      ...fullCatalog().filter((exercise) => exercise.library !== 'warmup'),
    ]
    const beginner = generatePlan(catalog, { seed: 'levels', profile: profile({ fitness: 'beginner' }) })
    expect(beginner.blocks.some((block) => block.exercise.intensity === 3)).toBe(false)
    expect(beginner.blocks.some((block) => block.role === 'warmup')).toBe(false)
    expect(beginner.warnings).toEqual(['incomplete'])
    const advanced = generatePlan(catalog, { seed: 'levels', profile: profile({ fitness: 'advanced' }) })
    expect(advanced.blocks.filter((block) => block.role === 'warmup').map((block) => block.exercise.intensity)).toEqual([
      3, 3, 3,
    ])
  })

  it('drops jumping movements when BMI is 偏高', () => {
    const catalog = [
      ...fullCatalog().filter((exercise) => exercise.library !== 'warmup' && exercise.library !== 'hiit'),
      reps({ id: 'jack', library: 'warmup', muscleGroup: 'fullBody', equipment: '徒手', jumping: true }),
      reps({ id: 'circle', library: 'warmup', muscleGroup: 'shoulders', equipment: '徒手' }),
      reps({ id: 'swing', library: 'warmup', muscleGroup: 'hamstrings', equipment: '徒手' }),
      reps({ id: 'burpee', library: 'hiit', muscleGroup: 'fullBody', equipment: '徒手', jumping: true }),
      reps({ id: 'squat', library: 'hiit', muscleGroup: 'quads', equipment: '徒手' }),
      reps({ id: 'push', library: 'hyrox', muscleGroup: 'chest', equipment: '徒手' }),
      reps({ id: 'sled', library: 'hyrox', muscleGroup: 'quads', equipment: '雪橇' }),
      timed({ id: 'row', library: 'hyrox', muscleGroup: 'back', defaultSeconds: 60, equipment: '划船机' }),
    ]
    const high = generatePlan(catalog, { seed: 'bmi', profile: profile({ heightCm: 160, weightKg: 75 }) })
    expect(high.highBmi).toBe(true)
    expect(high.blocks.some((block) => block.exercise.jumping)).toBe(false)
    expect(ids(high)).not.toContain('jack')
    expect(ids(high)).not.toContain('burpee')
    expect(ids(high)).not.toContain('sled')
    expect(ids(high)).not.toContain('row')
    const low = generatePlan(catalog, { seed: 'bmi', profile: profile() })
    expect(low.highBmi).toBe(false)
    expect(low.blocks.some((block) => block.exercise.jumping)).toBe(true)
  })

  it('returns a shorter plan when a pool cannot fill, and does not throw', () => {
    const catalog = [
      reps({ id: 'only-warm', library: 'warmup', muscleGroup: 'shoulders', equipment: '徒手' }),
      reps({ id: 'chest-1', muscleGroup: 'chest' }),
      reps({ id: 'chest-2', muscleGroup: 'chest' }),
      reps({ id: 'air', library: 'hiit', muscleGroup: 'quads', equipment: '徒手' }),
    ]
    const plan = generatePlan(catalog, { seed: 'short', profile: profile() })
    expect(plan.blocks.map((block) => block.role)).toEqual(['warmup', 'strength', 'bodyweight'])
    expect(plan.warnings).toEqual(['incomplete'])
    expectRules(plan, profile())

    expect(generatePlan([], { seed: 'empty', profile: profile() })).toMatchObject({
      blocks: [],
      warnings: ['incomplete'],
    })
  })

  it('does not mutate the catalog, and catalog order does not change the plan', () => {
    const snapshot = structuredClone(exercises)
    const frozen = Object.freeze(exercises.map((exercise) => Object.freeze({ ...exercise })))
    const person = profile({ fitness: 'advanced' as FitnessLevel, heightCm: 160, weightKg: 75 })
    const seed = planSeed('2026-11-24', person)
    const plan = generatePlan(frozen, { seed, profile: person })
    expect(exercises).toEqual(snapshot)
    expect(frozen.map((exercise) => exercise.id)).toEqual(exercises.map((exercise) => exercise.id))
    const reversed = generatePlan([...exercises].reverse(), { seed, profile: person })
    expect(ids(reversed)).toEqual(ids(plan))
  })

  it('on the real catalog, a beginner with 偏高 BMI gets no jumps and no intensity 3', () => {
    const person = profile({ heightCm: 160, weightKg: 75, fitness: 'beginner', goal: 'fatLoss' })
    const plan = generatePlan(exercises, { seed: planSeed('2026-11-24', person), profile: person })
    expect(plan.highBmi).toBe(true)
    expect(plan.blocks).toHaveLength(10)
    for (const block of plan.blocks) {
      expect(block.exercise.jumping, block.exercise.id).toBe(false)
      expect(block.exercise.intensity, block.exercise.id).not.toBe(3)
    }
    const names = plan.blocks.map((block) => block.exercise.name).join(' ')
    for (const word of ['开合跳', '波比', '高抬腿', '深蹲跳', '滑冰跳', '跳箱', '双摇', '立定跳远']) {
      expect(names, word).not.toContain(word)
    }
  })
})
