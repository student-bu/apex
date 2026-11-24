import type { Library, MuscleGroup } from '../types/exercise.ts'
import type { PlanRole, PlanWarning } from './plan.ts'
import type { FitnessLevel, Goal } from './profile.ts'

export const LIBRARY_LABEL: Record<Library, string> = {
  strength: '力量',
  hyrox: 'HYROX',
  hiit: 'HIIT',
  warmup: '热身',
  stretch: '拉伸',
}

export const ROLE_LABEL: Record<PlanRole, string> = {
  warmup: '热身',
  strength: '力量',
  bodyweight: '徒手',
  stretch: '拉伸',
}

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: '胸',
  back: '背',
  shoulders: '肩',
  arms: '手臂',
  core: '核心',
  quads: '股四头',
  hamstrings: '腘绳肌',
  glutes: '臀',
  fullBody: '全身',
}

export const FITNESS_LABEL: Record<FitnessLevel, string> = {
  beginner: '新手',
  foundation: '有基础',
  advanced: '进阶',
}

export const GOAL_LABEL: Record<Goal, string> = {
  muscle: '增肌',
  fatLoss: '减脂',
  strength: '力量',
}

export const WARNING_LABEL: Record<PlanWarning, string> = {
  incomplete: '可用动作不够排满完整课表，已按规则尽量安排。',
}
