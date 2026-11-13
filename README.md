# Apex

Apex 是一个混合健身挑战小站：每天从力量、HYROX 功能性动作和 HIIT 间歇里，生成一组随机但合理的训练，帮你走出固定课表。

Apex is a small open-source web app for hybrid fitness. It keeps three exercise libraries — strength, HYROX functional movements, and HIIT intervals — and builds one sensible workout for the day instead of repeating a fixed plan.

## MVP

This foundation includes:

- Three exercise libraries stored as JSON, with one shared schema
- A pure workout generator, covered by unit tests
- A single page that shows today's workout and lets you filter libraries, pick 20 / 30 / 45 minutes, or shuffle
- A guided timer for that workout, covered by unit tests

Local completion records and the streak count can come later. The timer does not store a session.

## Run and test

Requires Node.js 22+.

```bash
npm install
npm run dev
npm test
npm run build
```

`npm run dev` starts the Vite dev server. `npm test` runs Vitest once. `npm run build` typechecks the project and writes a static build to `dist/`.

## Preview

[https://student-bu.github.io/apex/](https://student-bu.github.io/apex/)

A push to `main` runs the tests and production build in GitHub Actions, then deploys `dist/` to GitHub Pages.

## How a workout is chosen

`generateWorkout` takes the selected libraries, a duration of 20, 30, or 45 minutes, and a seed. The page uses the local date (`YYYY-MM-DD`) as the daily seed. **换一换** appends a counter (`2026-11-13#1`) for another arrangement; that counter lives in memory and resets on refresh. **回到今日** returns to the date seed.

The generator follows these rules:

- No exercise is repeated in the workout
- Adjacent exercises do not share a `muscleGroup`
- The target count is 4, 6, or 8 exercises for 20, 30, or 45 minutes
- Each exercise is given 2–4 sets. Reps or seconds stay at the library default
- Estimated time is work + rest between sets + 30 seconds to change stations, and it never exceeds the selected duration
- Intensity `3` is at most half of the exercises
- The same seed, libraries, and duration always produce the same workout

Estimated work is 4 seconds per rep, or `defaultSeconds` for timed exercises. Rest between sets is 45 / 60 / 75 seconds for intensity 1 / 2 / 3.

If a library cannot fill the target without breaking a rule, the result is a shorter valid workout (`shortened`) or an empty one (`unsatisfiable`). An empty selection returns `no-libraries`. The page shows these states in Chinese and does not throw.

`muscleGroup` is the primary pattern used for sequencing, not a complete anatomy label. The HYROX list includes the race stations plus kettlebell swings and dumbbell snatches, which are common accessories in that style of training.

## Guided timer

**开始训练** walks the generated workout one set at a time. The sequence lives in `src/lib/timer.ts` and reuses `REST_SECONDS` and `TRANSITION_SECONDS` from the generator.

- A timed exercise counts down from `defaultSeconds`, then advances on its own
- A rep exercise shows the target and waits for **完成这组**. Elapsed time still advances
- Rest between sets uses that exercise's intensity rest. The break between exercises is the 30 second station change. Nothing follows the last set
- **暂停** freezes the clock. **跳过** moves to the next step and stays paused if the session was already paused. **退出** asks for confirmation, then drops the session
- **完成这组** still works while paused, and the next step starts running
- A countdown that hits zero plays a short Web Audio beep. **静音** mutes it for this session only
- Counted seconds follow wall time while the session is running, including time in a background tab. If a countdown ends in the background, the session stops on the following step instead of skipping past it
- The finish screen shows the running time. Nothing is written to local storage

## Project layout

```
src/data/exercises.json    seeded libraries
src/types/exercise.ts      schema, type, and runtime checks
src/lib/workout.ts         pure generator
src/lib/timer.ts           pure session timer
src/lib/beep.ts            countdown beep
src/App.tsx                today's workout page
src/Session.tsx            guided session screen
```

## License

MIT © 2026 Brian / student-bu. See [LICENSE](LICENSE).
