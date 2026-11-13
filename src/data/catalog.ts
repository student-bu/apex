import data from './exercises.json'
import { validateCatalog, type Exercise } from '../types/exercise.ts'

const errors = validateCatalog(data)
if (errors.length > 0) {
  throw new Error(`Invalid exercise catalog:\n${errors.join('\n')}`)
}

export const exercises = data as Exercise[]
