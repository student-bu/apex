import { describe, expect, it } from 'vitest'
import type { Exercise, Library, MuscleGroup } from '../types/exercise.ts'
import {
  buildSteps,
  createTimer,
  currentStep,
  timerReducer,
  upcomingWork,
  type SessionStep,
  type TimerState,
} from './timer.ts'
import { REST_SECONDS, TRANSITION_SECONDS } from './workout.ts'

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
    defaultReps: partial.defaultReps ?? 8,
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

function stepKey(step: SessionStep): string {
  if (step.kind === 'work') return `work:${step.exercise.id}:${step.setIndex + 1}/${step.sets}`
  return `${step.kind}:${step.seconds}`
}

describe('session steps', () => {
  const bench = reps({ id: 'bench', muscleGroup: 'chest', intensity: 2, defaultReps: 8 })
  const plank = timed({ id: 'plank', muscleGroup: 'core', defaultSeconds: 40, intensity: 1 })
  const pullUp = reps({ id: 'pull-up', muscleGroup: 'back', intensity: 3, defaultReps: 6 })
  const blocks = [
    { exercise: bench, sets: 3 },
    { exercise: plank, sets: 2 },
    { exercise: pullUp, sets: 2 },
  ]

  it('inserts intensity rest between sets and a station change between exercises', () => {
    const steps = buildSteps(blocks)
    expect(steps.map(stepKey)).toEqual([
      'work:bench:1/3',
      `rest:${REST_SECONDS[2]}`,
      'work:bench:2/3',
      `rest:${REST_SECONDS[2]}`,
      'work:bench:3/3',
      `transition:${TRANSITION_SECONDS}`,
      'work:plank:1/2',
      `rest:${REST_SECONDS[1]}`,
      'work:plank:2/2',
      `transition:${TRANSITION_SECONDS}`,
      'work:pull-up:1/2',
      `rest:${REST_SECONDS[3]}`,
      'work:pull-up:2/2',
    ])
  })

  it('does not add a station change when the workout has one exercise', () => {
    const steps = buildSteps([{ exercise: bench, sets: 2 }])
    expect(steps.map(stepKey)).toEqual([
      'work:bench:1/2',
      `rest:${REST_SECONDS[2]}`,
      'work:bench:2/2',
    ])
  })

  it('looks ahead to the next work step', () => {
    const steps = buildSteps(blocks)
    expect(upcomingWork(steps, 0)).toMatchObject({ exercise: { id: 'bench' }, setIndex: 1 })
    expect(upcomingWork(steps, 4)).toMatchObject({ exercise: { id: 'plank' }, setIndex: 0 })
    expect(upcomingWork(steps, 5)).toMatchObject({ exercise: { id: 'plank' }, setIndex: 0 })
    expect(upcomingWork(steps, steps.length - 1)).toBeNull()
  })
})

describe('timer reducer', () => {
  it('counts a timed set down and advances when it reaches zero', () => {
    const exercise = timed({ id: 'jumping-jack', muscleGroup: 'fullBody', defaultSeconds: 3, intensity: 2 })
    let state = createTimer([
      { exercise, sets: 1 },
      { exercise: reps({ id: 'row', muscleGroup: 'back' }), sets: 1 },
    ])

    expect(state.phase).toBe('running')
    expect(state.remaining).toBe(3)
    expect(timerReducer(state, { type: 'complete-set' })).toBe(state)

    state = timerReducer(state, { type: 'tick' })
    expect(state.remaining).toBe(2)
    expect(state.elapsed).toBe(1)
    expect(state.cue).toBeNull()
    expect(currentStep(state)?.kind).toBe('work')

    state = timerReducer(state, { type: 'tick', seconds: 2 })
    expect(state.cue).toBe('complete')
    expect(state.elapsed).toBe(3)
    expect(currentStep(state)).toMatchObject({ kind: 'transition', seconds: TRANSITION_SECONDS })
    expect(state.remaining).toBe(TRANSITION_SECONDS)
  })

  it('matches repeated ticks while a countdown is still running', () => {
    const start = createTimer([
      { exercise: timed({ id: 'plank', muscleGroup: 'core', defaultSeconds: 10 }), sets: 1 },
    ])
    let stepped = start
    for (let count = 0; count < 4; count += 1) stepped = timerReducer(stepped, { type: 'tick' })
    expect(timerReducer(start, { type: 'tick', seconds: 4 })).toEqual(stepped)
  })

  it('stops a catch-up on the step after a countdown instead of skipping ahead', () => {
    const exercise = reps({ id: 'squat', muscleGroup: 'quads', intensity: 1 })
    let state = createTimer([{ exercise, sets: 2 }])
    state = timerReducer(state, { type: 'complete-set' })
    expect(state.remaining).toBe(REST_SECONDS[1])

    const jumped = timerReducer(state, { type: 'tick', seconds: (state.remaining ?? 0) + 20 })
    expect(jumped.cue).toBe('complete')
    expect(jumped.phase).toBe('running')
    expect(jumped.elapsed).toBe(REST_SECONDS[1])
    expect(jumped.stepElapsed).toBe(0)
    expect(currentStep(jumped)).toMatchObject({ kind: 'work', setIndex: 1 })
  })

  it('tracks elapsed time on a rep set until the set is completed', () => {
    const exercise = reps({ id: 'curl', muscleGroup: 'arms', intensity: 3, defaultReps: 12 })
    const blocks = [{ exercise, sets: 2 }]
    const snapshot = JSON.stringify(blocks)
    let state = createTimer(blocks)

    expect(state.remaining).toBeNull()
    state = timerReducer(state, { type: 'tick', seconds: 5 })
    expect(currentStep(state)).toMatchObject({ kind: 'work', setIndex: 0 })
    expect(state.stepElapsed).toBe(5)
    expect(state.elapsed).toBe(5)
    expect(state.cue).toBeNull()

    state = timerReducer(state, { type: 'complete-set' })
    expect(state.cue).toBeNull()
    expect(state.stepElapsed).toBe(0)
    expect(state.elapsed).toBe(5)
    expect(currentStep(state)).toMatchObject({ kind: 'rest', seconds: REST_SECONDS[3] })
    expect(timerReducer(state, { type: 'complete-set' })).toBe(state)
    expect(JSON.stringify(blocks)).toBe(snapshot)
  })

  it('starts the following step when a paused rep set is completed', () => {
    let state = createTimer([{ exercise: reps({ id: 'lunge', muscleGroup: 'quads', intensity: 2 }), sets: 2 }])
    state = timerReducer(state, { type: 'pause' })
    state = timerReducer(state, { type: 'complete-set' })
    expect(state.phase).toBe('running')
    expect(currentStep(state)).toMatchObject({ kind: 'rest', seconds: REST_SECONDS[2] })
  })

  it('freezes the clock while paused and continues after resume', () => {
    let state = createTimer([
      { exercise: timed({ id: 'burpee', muscleGroup: 'fullBody', defaultSeconds: 8, intensity: 2 }), sets: 1 },
    ])
    state = timerReducer(state, { type: 'tick', seconds: 3 })
    const running = state
    const paused = timerReducer(running, { type: 'pause' })

    expect(paused.phase).toBe('paused')
    expect(paused.remaining).toBe(5)
    expect(timerReducer(paused, { type: 'tick', seconds: 4 })).toBe(paused)
    expect(timerReducer(paused, { type: 'pause' })).toBe(paused)
    expect(timerReducer(running, { type: 'resume' })).toBe(running)
    expect(timerReducer(running, { type: 'tick', seconds: 0 })).toBe(running)

    const resumed = timerReducer(paused, { type: 'resume' })
    expect(resumed.phase).toBe('running')
    const continued = timerReducer(resumed, { type: 'tick' })
    expect(continued.remaining).toBe(4)
    expect(continued.elapsed).toBe(4)
  })

  it('skips to the next step, keeps a pause, and can finish the session', () => {
    const blocks = [
      { exercise: reps({ id: 'press', muscleGroup: 'chest', intensity: 1 }), sets: 2 },
      { exercise: timed({ id: 'plank', muscleGroup: 'core', defaultSeconds: 5 }), sets: 1 },
    ]
    let state = createTimer(blocks)
    const steps = state.steps

    state = timerReducer(state, { type: 'skip' })
    expect(state.steps).toBe(steps)
    expect(state.cue).toBeNull()
    expect(currentStep(state)).toMatchObject({ kind: 'rest' })

    state = timerReducer(state, { type: 'pause' })
    state = timerReducer(state, { type: 'skip' })
    expect(state.phase).toBe('paused')
    expect(currentStep(state)).toMatchObject({ kind: 'work', exercise: { id: 'press' }, setIndex: 1 })

    state = timerReducer(state, { type: 'skip' })
    expect(currentStep(state)?.kind).toBe('transition')
    state = timerReducer(state, { type: 'resume' })
    state = timerReducer(state, { type: 'skip' })
    expect(currentStep(state)).toMatchObject({ kind: 'work', exercise: { id: 'plank' } })
    state = timerReducer(state, { type: 'skip' })
    expect(finished(state)).toBe(true)
    expect(state.cue).toBeNull()
  })

  it('finishes when the last countdown ends and then ignores further actions', () => {
    let state = createTimer([
      { exercise: timed({ id: 'mountain', muscleGroup: 'core', defaultSeconds: 2 }), sets: 1 },
    ])
    state = timerReducer(state, { type: 'tick', seconds: 2 })
    expect(finished(state)).toBe(true)
    expect(state.cue).toBe('complete')
    expect(state.elapsed).toBe(2)
    expect(state.remaining).toBeNull()
    expect(timerReducer(state, { type: 'tick', seconds: 5 })).toBe(state)
    expect(timerReducer(state, { type: 'skip' })).toBe(state)
    expect(timerReducer(state, { type: 'pause' })).toBe(state)
    expect(timerReducer(state, { type: 'resume' })).toBe(state)
    expect(timerReducer(state, { type: 'complete-set' })).toBe(state)
  })

  it('is already finished when the workout is empty', () => {
    const state = createTimer([])
    expect(state.phase).toBe('finished')
    expect(state.steps).toEqual([])
    expect(timerReducer(state, { type: 'tick' })).toBe(state)
  })
})

function finished(state: TimerState): boolean {
  return state.phase === 'finished' && state.index === state.steps.length && currentStep(state) === null
}
