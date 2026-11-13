import { useState } from 'react'
import { exercises } from './data/catalog.ts'
import { primeAudio } from './lib/beep.ts'
import { LIBRARY_LABEL, MUSCLE_LABEL, WARNING_LABEL } from './lib/labels.ts'
import {
  DURATION_OPTIONS,
  dailySeed,
  generateWorkout,
  type DurationMinutes,
} from './lib/workout.ts'
import Session from './Session.tsx'
import { LIBRARIES, type Library } from './types/exercise.ts'

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (seconds === 0) return `${minutes} 分钟`
  return `${minutes} 分 ${seconds} 秒`
}

function formatChineseDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function prescription(block: { sets: number; exercise: (typeof exercises)[number] }): string {
  const dose =
    block.exercise.type === 'reps'
      ? `${block.exercise.defaultReps} 次`
      : `${block.exercise.defaultSeconds} 秒`
  return `${block.sets} 组 × ${dose}`
}

export default function App() {
  const [libraries, setLibraries] = useState<Library[]>([...LIBRARIES])
  const [duration, setDuration] = useState<DurationMinutes>(30)
  const [nonce, setNonce] = useState(0)
  const [training, setTraining] = useState(false)

  const today = new Date()
  const dateSeed = dailySeed(today)
  const seed = nonce === 0 ? dateSeed : `${dateSeed}#${nonce}`
  const workout = generateWorkout(exercises, {
    libraries,
    durationMinutes: duration,
    seed,
  })

  function toggleLibrary(library: Library) {
    setLibraries((current) =>
      current.includes(library)
        ? current.filter((item) => item !== library)
        : [...current, library],
    )
  }

  function startTraining() {
    primeAudio()
    setTraining(true)
  }

  if (training && workout.blocks.length > 0) {
    const sessionKey = workout.blocks.map((block) => `${block.exercise.id}:${block.sets}`).join('|')
    return <Session key={sessionKey} blocks={workout.blocks} onExit={() => setTraining(false)} />
  }

  return (
    <main className="page">
      <header className="brand">
        <div>
          <p className="mark">Apex</p>
          <h1>今日训练</h1>
        </div>
        <div className="day">
          <p>{formatChineseDate(today)}</p>
          <p className="seed">{nonce === 0 ? '今日安排' : `换组 ${nonce}`}</p>
        </div>
      </header>
      <p className="tagline">从力量、HYROX 和 HIIT 里生成一组随机但合理的训练。</p>

      <div className="toolbar">
        <button type="button" onClick={() => setNonce((current) => current + 1)}>
          换一换
        </button>
        {nonce > 0 ? (
          <button type="button" className="ghost" onClick={() => setNonce(0)}>
            回到今日
          </button>
        ) : null}
      </div>

      <fieldset>
        <legend>动作库</legend>
        <div className="choices">
          {LIBRARIES.map((library) => (
            <button
              key={library}
              type="button"
              className="chip"
              aria-pressed={libraries.includes(library)}
              onClick={() => toggleLibrary(library)}
            >
              {LIBRARY_LABEL[library]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>时长</legend>
        <div className="choices">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={duration === option}
              onClick={() => setDuration(option)}
            >
              {option} 分钟
            </button>
          ))}
        </div>
      </fieldset>

      {workout.warnings.map((warning) => (
        <p key={warning} className="warning" role="status">
          {WARNING_LABEL[warning]}
        </p>
      ))}

      {workout.blocks.length > 0 ? (
        <>
          <p className="summary">
            预计用时 {formatClock(workout.estimatedSeconds)} · {workout.blocks.length} 个动作
          </p>
          <button type="button" className="start" onClick={startTraining}>
            开始训练
          </button>
          <ol className="workout">
            {workout.blocks.map((block, index) => (
              <li key={block.exercise.id}>
                <span className="index">{index + 1}</span>
                <div>
                  <p className="name">{block.exercise.name}</p>
                  <p className="meta">
                    {LIBRARY_LABEL[block.exercise.library]} · {MUSCLE_LABEL[block.exercise.muscleGroup]} ·
                    强度 {block.exercise.intensity} · {block.exercise.equipment}
                  </p>
                  <p className="prescription">{prescription(block)}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </main>
  )
}
