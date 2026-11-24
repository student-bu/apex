import { useState, type FormEvent, type ReactNode } from 'react'
import { exercises } from './data/catalog.ts'
import { FITNESS_LABEL, GOAL_LABEL, LIBRARY_LABEL, MUSCLE_LABEL, ROLE_LABEL, WARNING_LABEL } from './lib/labels.ts'
import { PLAN_ROLES, dailySeed, generatePlan, planSeed, type PlanBlock } from './lib/plan.ts'
import {
  bodyMassIndex,
  isHighBmi,
  loadProfile,
  parseHeightCm,
  parseWeightKg,
  saveProfile,
  validateDraft,
  type FitnessLevel,
  type Goal,
  FITNESS_LEVELS,
  GOALS,
  type Profile,
  type ProfileErrors,
} from './lib/profile.ts'

function formatChineseDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1)
}

function prescription(block: PlanBlock): string {
  const amount = block.reps != null ? `${block.reps} 次` : `${block.seconds} 秒`
  return block.sets > 1 ? `${block.sets} 组 × ${amount}` : amount
}

function ruleNote(fitness: FitnessLevel, highBmi: boolean): string | null {
  if (fitness === 'beginner' && highBmi) return '这一组没有强度 3 的动作，也没有跳跃。'
  if (fitness === 'beginner') return '这一组没有强度 3 的动作。'
  if (highBmi) return 'BMI 偏高，这一组没有跳跃动作。'
  return null
}

function Brand({ aside }: { aside?: ReactNode }) {
  return (
    <header className="top">
      <div className="lockup">
        <p className="wordmark">Apex</p>
      </div>
      {aside}
    </header>
  )
}

function ProfileForm({
  initial,
  editing,
  onSave,
  onCancel,
}: {
  initial: Profile | null
  editing: boolean
  onSave: (profile: Profile) => void
  onCancel?: () => void
}) {
  const [height, setHeight] = useState(initial ? String(initial.heightCm) : '')
  const [weight, setWeight] = useState(initial ? formatKg(initial.weightKg) : '')
  const [fitness, setFitness] = useState<FitnessLevel | null>(initial?.fitness ?? null)
  const [goal, setGoal] = useState<Goal | null>(initial?.goal ?? null)
  const [showErrors, setShowErrors] = useState(false)

  const draft = validateDraft({ height, weight, fitness, goal })
  const errors: ProfileErrors = showErrors ? draft.errors : {}
  const heightCm = parseHeightCm(height)
  const weightKg = parseWeightKg(weight)
  const preview = heightCm !== null && weightKg !== null ? bodyMassIndex(heightCm, weightKg) : null

  function submit(event: FormEvent) {
    event.preventDefault()
    setShowErrors(true)
    if (draft.profile) onSave(draft.profile)
  }

  return (
    <form className="glass form" onSubmit={submit} noValidate>
      <h1>{editing ? '修改资料' : '开始之前'}</h1>
      <p className="lede">
        {editing
          ? '保存后会按新的身高、体重、基础和目标，重新生成今天的训练。'
          : '先填写身高、体重、训练基础和目标。这些会留在这台设备上，之后打开直接看到今天的训练。'}
      </p>

      <div className="fields">
        <label htmlFor="height">
          身高（厘米）
          <input
            id="height"
            inputMode="numeric"
            autoComplete="off"
            value={height}
            aria-invalid={errors.height ? true : undefined}
            aria-describedby={errors.height ? 'height-error' : undefined}
            onChange={(event) => setHeight(event.target.value)}
          />
        </label>
        {errors.height ? (
          <p id="height-error" className="error" role="alert">
            {errors.height}
          </p>
        ) : null}

        <label htmlFor="weight">
          体重（公斤）
          <input
            id="weight"
            inputMode="decimal"
            autoComplete="off"
            value={weight}
            aria-invalid={errors.weight ? true : undefined}
            aria-describedby={errors.weight ? 'weight-error' : undefined}
            onChange={(event) => setWeight(event.target.value)}
          />
        </label>
        {errors.weight ? (
          <p id="weight-error" className="error" role="alert">
            {errors.weight}
          </p>
        ) : null}
      </div>

      {preview !== null ? (
        <p className="bmi" aria-live="polite">
          BMI {preview.toFixed(1)}
          {isHighBmi(preview) ? <span className="pill">偏高</span> : null}
        </p>
      ) : null}

      <fieldset>
        <legend>训练基础</legend>
        <div className="segment" role="group" aria-label="训练基础">
          {FITNESS_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={fitness === level}
              onClick={() => setFitness(level)}
            >
              {FITNESS_LABEL[level]}
            </button>
          ))}
        </div>
        {errors.fitness ? (
          <p className="error" role="alert">
            {errors.fitness}
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend>目标</legend>
        <div className="segment" role="group" aria-label="目标">
          {GOALS.map((item) => (
            <button key={item} type="button" aria-pressed={goal === item} onClick={() => setGoal(item)}>
              {GOAL_LABEL[item]}
            </button>
          ))}
        </div>
        {errors.goal ? (
          <p className="error" role="alert">
            {errors.goal}
          </p>
        ) : null}
      </fieldset>

      <div className="toolbar">
        <button type="submit" className="primary">
          {editing ? '保存并重新生成' : '生成今日训练'}
        </button>
        {onCancel ? (
          <button type="button" className="ghost" onClick={onCancel}>
            取消
          </button>
        ) : null}
      </div>
    </form>
  )
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile())
  const [editing, setEditing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const today = new Date()

  function commit(next: Profile) {
    saveProfile(next)
    setProfile(next)
    setNonce(0)
    setEditing(false)
  }

  if (!profile || editing) {
    return (
      <main className="page" data-screen="questionnaire">
        <Brand />
        <ProfileForm
          key={profile ? 'edit' : 'new'}
          initial={profile}
          editing={profile !== null}
          onSave={commit}
          onCancel={profile ? () => setEditing(false) : undefined}
        />
      </main>
    )
  }

  const dateSeed = dailySeed(today)
  const plan = generatePlan(exercises, { seed: planSeed(dateSeed, profile, nonce), profile })
  const note = ruleNote(profile.fitness, plan.highBmi)
  let cursor = 0
  const sections = PLAN_ROLES.map((role) => {
    const items = plan.blocks.filter((block) => block.role === role)
    const section = { role, items, start: cursor }
    cursor += items.length
    return section
  })

  return (
    <main className="page" data-screen="plan" data-fitness={profile.fitness} data-high-bmi={plan.highBmi ? 'true' : 'false'}>
      <Brand
        aside={
          <div className="day">
            <p>{formatChineseDate(today)}</p>
            <p className="quiet">{nonce === 0 ? '今日安排' : `换组 ${nonce}`}</p>
          </div>
        }
      />
      <h1>今日训练</h1>
      <section className="glass profile-card">
        <p className="stats">
          {profile.heightCm} cm · {formatKg(profile.weightKg)} kg · BMI {plan.bmi.toFixed(1)}
          {plan.highBmi ? <span className="pill">偏高</span> : null}
        </p>
        <p className="quiet">
          基础 {FITNESS_LABEL[profile.fitness]} · 目标 {GOAL_LABEL[profile.goal]}
        </p>
        {note ? <p className="note">{note}</p> : null}
        <div className="toolbar">
          <button type="button" className="primary" onClick={() => setNonce((current) => current + 1)}>
            换一换
          </button>
          {nonce > 0 ? (
            <button type="button" className="ghost" onClick={() => setNonce(0)}>
              回到今日
            </button>
          ) : null}
          <button type="button" className="ghost" onClick={() => setEditing(true)}>
            修改资料
          </button>
        </div>
      </section>

      {plan.warnings.map((warning) => (
        <p key={warning} className="warning" role="status">
          {WARNING_LABEL[warning]}
        </p>
      ))}

      <div className="sections">
        {sections.map((section) => (
          <section key={section.role} className="glass block" aria-labelledby={`${section.role}-title`}>
            <div className="section-head">
              <h2 id={`${section.role}-title`}>{ROLE_LABEL[section.role]}</h2>
              <p className="quiet">{section.items.length} 个动作</p>
            </div>
            {section.items.length === 0 ? (
              <p className="quiet empty">这一段没有足够的合适动作。</p>
            ) : (
              <ol>
                {section.items.map((block, offset) => (
                  <li key={block.exercise.id} className={block.exercise.image ? 'has-image' : undefined}>
                    <span className="index">{section.start + offset + 1}</span>
                    {block.exercise.image ? (
                      <img
                        className="thumb"
                        src={`${import.meta.env.BASE_URL}${block.exercise.image}`}
                        alt=""
                      />
                    ) : null}
                    <div>
                      <p className="name">{block.exercise.name}</p>
                      <p className="meta">
                        {LIBRARY_LABEL[block.exercise.library]} · {MUSCLE_LABEL[block.exercise.muscleGroup]} · 强度{' '}
                        {block.exercise.intensity} · {block.exercise.equipment}
                      </p>
                      <p className="dose">{prescription(block)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </main>
  )
}
