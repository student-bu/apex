import type { Library, MuscleGroup } from '../types/exercise.ts'
import type { WorkoutWarning } from './workout.ts'

export const LIBRARY_LABEL: Record<Library, string> = {
  strength: '力量',
  hyrox: 'HYROX',
  hiit: 'HIIT',
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

export const WARNING_LABEL: Record<WorkoutWarning, string> = {
  'no-libraries': '请至少选择一个动作库。',
  'empty-pool': '所选动作库里没有可用动作。',
  shortened: '这些动作无法在规则内排满此时长，已缩短这组训练。',
  unsatisfiable: '按当前条件排不出一组有效训练。',
}
