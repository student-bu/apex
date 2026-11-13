import type { Exercise } from '../types/exercise.ts'
import { REST_SECONDS, TRANSITION_SECONDS, type WorkoutBlock } from './workout.ts'

export type WorkStep = {
  kind: 'work'
  exerciseIndex: number
  setIndex: number
  sets: number
  exercise: Exercise
}

export type RestStep = {
  kind: 'rest'
  seconds: number
}

export type TransitionStep = {
  kind: 'transition'
  seconds: number
}

export type SessionStep = WorkStep | RestStep | TransitionStep

export type TimerPhase = 'running' | 'paused' | 'finished'

export type TimerCue = 'complete' | null

export type TimerState = {
  phase: TimerPhase
  steps: readonly SessionStep[]
  index: number
  /** Seconds left on a countdown. Null during a rep set. */
  remaining: number | null
  /** Seconds spent on the current step while running. */
  stepElapsed: number
  /** Seconds the session has been running. Paused time is not included. */
  elapsed: number
  /** Set when the latest update ended a countdown. */
  cue: TimerCue
}

export type TimerAction =
  | { type: 'tick'; seconds?: number }
  | { type: 'complete-set' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'skip' }

/**
 * Work, then rest between sets, then a station change between exercises.
 * Durations come from the generator so the session matches its estimate.
 */
export function buildSteps(blocks: readonly WorkoutBlock[]): SessionStep[] {
  const steps: SessionStep[] = []

  blocks.forEach((block, exerciseIndex) => {
    for (let setIndex = 0; setIndex < block.sets; setIndex += 1) {
      steps.push({
        kind: 'work',
        exerciseIndex,
        setIndex,
        sets: block.sets,
        exercise: block.exercise,
      })

      const lastSet = setIndex === block.sets - 1
      const lastExercise = exerciseIndex === blocks.length - 1
      if (!lastSet) {
        steps.push({ kind: 'rest', seconds: REST_SECONDS[block.exercise.intensity] })
      } else if (!lastExercise) {
        steps.push({ kind: 'transition', seconds: TRANSITION_SECONDS })
      }
    }
  })

  return steps
}

export function createTimer(blocks: readonly WorkoutBlock[]): TimerState {
  const steps = buildSteps(blocks)
  const first = steps[0]
  if (!first) {
    return {
      phase: 'finished',
      steps,
      index: 0,
      remaining: null,
      stepElapsed: 0,
      elapsed: 0,
      cue: null,
    }
  }

  return {
    phase: 'running',
    steps,
    index: 0,
    remaining: initialRemaining(first),
    stepElapsed: 0,
    elapsed: 0,
    cue: null,
  }
}

/** The next work step after `index`, used for the "接下来" line. */
export function upcomingWork(steps: readonly SessionStep[], index: number): WorkStep | null {
  for (let cursor = index + 1; cursor < steps.length; cursor += 1) {
    const step = steps[cursor]
    if (step?.kind === 'work') return step
  }
  return null
}

export function currentStep(state: TimerState): SessionStep | null {
  return state.steps[state.index] ?? null
}

export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'tick': {
      const seconds = action.seconds ?? 1
      if (!Number.isInteger(seconds) || seconds < 1) return state
      return elapse(state, seconds)
    }
    case 'complete-set':
      return completeSet(state)
    case 'pause':
      if (state.phase !== 'running') return state
      return { ...state, phase: 'paused', cue: null }
    case 'resume':
      if (state.phase !== 'paused') return state
      return { ...state, phase: 'running', cue: null }
    case 'skip':
      if (state.phase === 'finished') return state
      return goTo(state, state.index + 1, null)
    default: {
      const unexpected: never = action
      throw new Error(`Unexpected timer action: ${String(unexpected)}`)
    }
  }
}

function initialRemaining(step: SessionStep): number | null {
  if (step.kind === 'work') return step.exercise.type === 'time' ? step.exercise.defaultSeconds : null
  return step.seconds
}

/**
 * Apply whole running seconds. When a countdown reaches zero the batch stops,
 * so time accumulated in the background cannot skip past the next step.
 */
function elapse(state: TimerState, seconds: number): TimerState {
  if (state.phase !== 'running') return state
  let next = state
  for (let count = 0; count < seconds; count += 1) {
    if (next.phase !== 'running') return next
    const stepped = tickOnce(next)
    if (stepped === next) return next
    next = stepped
    if (next.cue === 'complete') return next
  }
  return next
}

function tickOnce(state: TimerState): TimerState {
  const step = state.steps[state.index]
  if (!step || state.phase !== 'running') return state

  const elapsed = state.elapsed + 1
  if (state.remaining === null) {
    return { ...state, elapsed, stepElapsed: state.stepElapsed + 1, cue: null }
  }

  if (state.remaining > 1) {
    return {
      ...state,
      elapsed,
      stepElapsed: state.stepElapsed + 1,
      remaining: state.remaining - 1,
      cue: null,
    }
  }

  return goTo({ ...state, elapsed }, state.index + 1, 'complete')
}

function completeSet(state: TimerState): TimerState {
  if (state.phase === 'finished') return state
  const step = state.steps[state.index]
  if (!step || step.kind !== 'work' || step.exercise.type !== 'reps') return state
  return goTo({ ...state, phase: 'running' }, state.index + 1, null)
}

function goTo(state: TimerState, index: number, cue: TimerCue): TimerState {
  const step = state.steps[index]
  if (!step) {
    return {
      phase: 'finished',
      steps: state.steps,
      index: state.steps.length,
      remaining: null,
      stepElapsed: 0,
      elapsed: state.elapsed,
      cue,
    }
  }

  return {
    phase: state.phase === 'paused' ? 'paused' : 'running',
    steps: state.steps,
    index,
    remaining: initialRemaining(step),
    stepElapsed: 0,
    elapsed: state.elapsed,
    cue,
  }
}
