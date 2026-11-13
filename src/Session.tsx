import { useEffect, useReducer, useRef, useState, type RefObject } from 'react'
import { playBeep, primeAudio } from './lib/beep.ts'
import { LIBRARY_LABEL, MUSCLE_LABEL } from './lib/labels.ts'
import {
  createTimer,
  currentStep,
  timerReducer,
  upcomingWork,
  type SessionStep,
  type TimerState,
} from './lib/timer.ts'
import type { WorkoutBlock } from './lib/workout.ts'
import type { Exercise } from './types/exercise.ts'

type SessionProps = {
  blocks: readonly WorkoutBlock[]
  onExit: () => void
}

export default function Session({ blocks, onExit }: SessionProps) {
  const [state, dispatch] = useReducer(timerReducer, blocks, createTimer)
  const [muted, setMuted] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const resumeOnCancel = useRef(false)
  const heard = useRef<number | null>(null)
  const confirmRef = useRef<HTMLDivElement>(null)
  const step = currentStep(state)

  useEffect(() => {
    if (state.phase !== 'running') return
    let anchor = performance.now()
    const flush = () => {
      const seconds = Math.floor((performance.now() - anchor) / 1000)
      if (seconds <= 0) return
      anchor += seconds * 1000
      dispatch({ type: 'tick', seconds })
    }
    const id = window.setInterval(flush, 250)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [state.phase])

  useEffect(() => {
    if (state.cue !== 'complete') return
    if (heard.current === state.elapsed) return
    heard.current = state.elapsed
    if (!muted) playBeep()
  }, [muted, state.cue, state.elapsed])

  useEffect(() => {
    const previous = document.title
    document.title = state.phase === 'finished' ? 'Apex · 训练完成' : 'Apex · 训练中'
    return () => {
      document.title = previous
    }
  }, [state.phase])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.scrollTo(0, 0)
    return () => {
      document.body.style.overflow = previous
      window.scrollTo(0, 0)
    }
  }, [])

  useEffect(() => {
    if (!confirming) return
    confirmRef.current?.scrollIntoView({ block: 'nearest' })
    confirmRef.current?.querySelector('button')?.focus()
  }, [confirming])

  function askExit() {
    resumeOnCancel.current = state.phase === 'running'
    if (state.phase === 'running') dispatch({ type: 'pause' })
    setConfirming(true)
  }

  function cancelExit() {
    setConfirming(false)
    if (resumeOnCancel.current) dispatch({ type: 'resume' })
    resumeOnCancel.current = false
  }

  const total = blocks.length

  return (
    <div className="session-shell">
    <main className="session" onPointerDown={primeAudio}>
      <header className="session-bar">
        <div>
          <p className="mark">Apex</p>
          <p className="summary">已进行 {formatStopwatch(state.elapsed)}</p>
        </div>
        {state.phase === 'finished' ? null : (
          <div className="session-actions">
            <button
              type="button"
              className="ghost"
              aria-pressed={muted}
              onClick={() => setMuted((value) => !value)}
            >
              {muted ? '开声音' : '静音'}
            </button>
            <button type="button" className="ghost" onClick={askExit}>
              退出
            </button>
          </div>
        )}
      </header>

      {state.phase === 'finished' || !step ? (
        <Finish blocks={blocks} elapsed={state.elapsed} onExit={onExit} />
      ) : (
        <Active
          state={state}
          step={step}
          total={total}
          confirming={confirming}
          confirmRef={confirmRef}
          onComplete={() => dispatch({ type: 'complete-set' })}
          onPause={() => dispatch({ type: 'pause' })}
          onResume={() => dispatch({ type: 'resume' })}
          onSkip={() => dispatch({ type: 'skip' })}
          onStay={cancelExit}
          onExit={onExit}
        />
      )}
    </main>
    </div>
  )
}

function Finish({
  blocks,
  elapsed,
  onExit,
}: {
  blocks: readonly WorkoutBlock[]
  elapsed: number
  onExit: () => void
}) {
  return (
    <div className="session-main finish">
      <h1>训练完成</h1>
      <p className="summary">
        用时 {formatDuration(elapsed)} · {blocks.length} 个动作
      </p>
      <div className="controls">
        <button type="button" onClick={onExit}>
          回到今日训练
        </button>
      </div>
      <p className="kicker recap">这组训练</p>
      <ol className="workout">
        {blocks.map((block, index) => (
          <li key={block.exercise.id}>
            <span className="index">{index + 1}</span>
            <div>
              <p className="name">{block.exercise.name}</p>
              <p className="prescription">
                {block.sets} 组 × {dose(block.exercise)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Active({
  state,
  step,
  total,
  confirming,
  confirmRef,
  onComplete,
  onPause,
  onResume,
  onSkip,
  onStay,
  onExit,
}: {
  state: TimerState
  step: SessionStep
  total: number
  confirming: boolean
  confirmRef: RefObject<HTMLDivElement | null>
  onComplete: () => void
  onPause: () => void
  onResume: () => void
  onSkip: () => void
  onStay: () => void
  onExit: () => void
}) {
  const work = step.kind === 'work' ? step : upcomingWork(state.steps, state.index)
  const reps = step.kind === 'work' && step.exercise.type === 'reps'
  const paused = state.phase === 'paused'

  return (
    <>
      <div className="session-main">
        <p className="sr-only" role="status">
          {announcement(step, state.steps, state.index, total)}
        </p>
        {work ? (
          <p className="summary">
            动作 {work.exerciseIndex + 1} / {total} · 第 {work.setIndex + 1} / {work.sets} 组
          </p>
        ) : null}
        {step.kind === 'work' ? (
          <>
            <h1>{step.exercise.name}</h1>
            <p className="meta">{describe(step.exercise)}</p>
          </>
        ) : (
          <h1>{step.kind === 'rest' ? '休息' : '换站'}</h1>
        )}
        {step.kind === 'work' ? (
          <p className="kicker">{step.exercise.type === 'reps' ? '目标' : '倒计时'}</p>
        ) : null}
        <p className="clock" aria-label={clockLabel(step, state)}>
          {step.kind === 'work' && step.exercise.type === 'reps'
            ? step.exercise.defaultReps
            : formatStopwatch(state.remaining ?? 0)}
        </p>
        {reps ? <p className="unit">次</p> : null}
        {reps ? <p className="summary">本组 {formatStopwatch(state.stepElapsed)}</p> : null}
        {paused && !confirming ? <p className="summary">已暂停</p> : null}
        <Next step={step} steps={state.steps} index={state.index} />
      </div>

      {confirming ? (
        <div className="confirm" role="alertdialog" aria-labelledby="exit-title" aria-describedby="exit-copy" ref={confirmRef}>
          <h2 id="exit-title">结束这次训练？</h2>
          <p id="exit-copy">进度不会保存。</p>
          <div className="control-row">
            <button type="button" onClick={onStay}>
              继续训练
            </button>
            <button type="button" className="ghost" onClick={onExit}>
              退出
            </button>
          </div>
        </div>
      ) : (
        <div className="controls">
          {reps ? (
            <button type="button" onClick={onComplete}>
              完成这组
            </button>
          ) : null}
          <div className="control-row">
            {paused ? (
              <button type="button" onClick={onResume}>
                继续
              </button>
            ) : (
              <button type="button" onClick={onPause}>
                暂停
              </button>
            )}
            <button type="button" className="ghost" onClick={onSkip}>
              跳过
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Next({
  step,
  steps,
  index,
}: {
  step: SessionStep
  steps: readonly SessionStep[]
  index: number
}) {
  if (step.kind === 'work') {
    const following = steps[index + 1]
    const label = following?.kind === 'rest' ? '组间休息' : following?.kind === 'transition' ? '换站' : '完成'
    return (
      <div className="next">
        <p className="kicker">接下来</p>
        <p className="name">{label}</p>
      </div>
    )
  }

  const upcoming = upcomingWork(steps, index)
  if (!upcoming) {
    return (
      <div className="next">
        <p className="kicker">接下来</p>
        <p className="name">完成</p>
      </div>
    )
  }

  return (
    <div className="next">
      <p className="kicker">接下来</p>
      <p className="name">{upcoming.exercise.name}</p>
      <p className="meta">
        {describe(upcoming.exercise)} · {dose(upcoming.exercise)}
      </p>
    </div>
  )
}

function announcement(
  step: SessionStep,
  steps: readonly SessionStep[],
  index: number,
  total: number,
): string {
  if (step.kind === 'work') {
    const amount = step.exercise.type === 'reps' ? `目标 ${dose(step.exercise)}` : `倒计时 ${dose(step.exercise)}`
    return `${step.exercise.name}，动作 ${step.exerciseIndex + 1} / ${total}，第 ${step.setIndex + 1} / ${step.sets} 组，${amount}`
  }
  const upcoming = upcomingWork(steps, index)
  const next = upcoming ? `接下来 ${upcoming.exercise.name}` : '接下来完成'
  const label = step.kind === 'rest' ? '组间休息' : '换站'
  return `${label} ${formatDuration(step.seconds)}，${next}`
}

function clockLabel(step: SessionStep, state: TimerState): string {
  if (step.kind === 'work' && step.exercise.type === 'reps') {
    return `目标 ${dose(step.exercise)}，本组已进行 ${formatDuration(state.stepElapsed)}`
  }
  const prefix = step.kind === 'work' ? '剩余' : step.kind === 'rest' ? '休息剩余' : '换站剩余'
  return `${prefix} ${formatDuration(state.remaining ?? 0)}`
}

function describe(exercise: Exercise): string {
  return `${LIBRARY_LABEL[exercise.library]} · ${MUSCLE_LABEL[exercise.muscleGroup]} · 强度 ${exercise.intensity} · ${exercise.equipment}`
}

function dose(exercise: Exercise): string {
  return exercise.type === 'reps' ? `${exercise.defaultReps} 次` : `${exercise.defaultSeconds} 秒`
}

function formatStopwatch(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds} 秒`
  if (seconds === 0) return `${minutes} 分钟`
  return `${minutes} 分 ${seconds} 秒`
}
